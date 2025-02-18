import { Server, Socket } from "socket.io";
import {
  PlayerWithStatus,
  PlayerStatus,
  CellUpdate,
  GameStatus,
  GRID_ROWS,
  GRID_COLS,
} from "@game/shared";
import { gameRoomService } from "./gameRoom";
import { config } from "@/config/config";

interface JoinRoomData {
  roomId: string;
  userId: string;
  name: string;
}

interface UpdateGridData {
  roomId: string;
  updates: CellUpdate[];
  reset?: boolean;
  generation?: number;
}

export class GameEventsService {
  // store timeouts for each player to handle reconnection
  private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  // store pending updates for each room with timestamps
  private pendingUpdates: Map<string, { updates: CellUpdate[]; timestamp: number }[]> = new Map();
  private updateTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly BATCH_DELAY = 50; // ms to wait before processing updates

  constructor(private io: Server) {}

  handleConnection(socket: Socket): void {
    console.log(`client connected: ${socket.id}`);
    this.setupEventHandlers(socket);

    socket.on("disconnect", () => {
      console.log(`client disconnected: ${socket.id}`);
      this.handleDisconnect(socket);
    });

    socket.on("error", (error) => {
      console.error(`socket error from ${socket.id}:`, error);
    });
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    try {
      const roomId = socket.data.roomId;
      if (roomId) {
        const gameRoom = await gameRoomService.getGameRoom(roomId);
        if (gameRoom) {
          const player = gameRoom.players.find(
            (p: PlayerWithStatus) => p.id === socket.data.userId,
          );
          if (player) {
            await gameRoomService.updatePlayerStatus(roomId, player.id, PlayerStatus.Inactive);

            this.io.to(roomId).emit("game:player-disconnected", {
              userId: player.id,
              socketId: socket.id,
              name: player.name,
              color: player.color,
              status: "inactive",
            });

            // clear any existing timeout for this player
            const timeoutKey = `${roomId}:${player.id}`;
            const existingTimeout = this.disconnectTimeouts.get(timeoutKey);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }

            // set a timeout to remove the player if they don't reconnect
            const timeout = setTimeout(async () => {
              const currentRoom = await gameRoomService.getGameRoom(roomId);
              const playerStillExists = currentRoom?.players.some(
                (p: PlayerWithStatus) => p.id === player.id,
              );

              if (playerStillExists) {
                const updatedRoom = await gameRoomService.removePlayerFromRoom(
                  roomId,
                  socket.data.userId,
                );
                this.io.to(roomId).emit("game:player-left", {
                  userId: player.id,
                  socketId: socket.id,
                  name: player.name,
                  color: player.color,
                  totalMembers: updatedRoom.players.length,
                });
                this.disconnectTimeouts.delete(timeoutKey);
              }
            }, config.reconnectionTimeout);

            this.disconnectTimeouts.set(timeoutKey, timeout);
          }
        }
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  }

  private async processUpdates(roomId: string): Promise<void> {
    const updates = this.pendingUpdates.get(roomId);
    if (!updates || updates.length === 0) return;

    try {
      const gameRoom = await gameRoomService.getGameRoom(roomId);
      if (!gameRoom) return;

      // sort updates by timestamp to ensure correct order
      updates.sort((a, b) => a.timestamp - b.timestamp);

      // get current state
      const currentState = await gameRoomService.getGameState(roomId);
      if (!currentState) return;

      // apply all updates in sequence to the grid
      const newGrid = currentState.grid.map((row) => [...row]);
      let latestGeneration = currentState.generation;

      for (const batch of updates) {
        for (const update of batch.updates) {
          // update generation if it's newer, regardless of update type
          if (update.generation > latestGeneration) {
            latestGeneration = update.generation;
          }

          // only apply grid updates for non-heartbeat updates
          if (!update.isHeartbeat) {
            newGrid[update.row][update.col] = update.state;
          }
        }
      }

      // update the game state with all changes at once
      const finalState = await gameRoomService.updateGameState(
        roomId,
        newGrid,
        false,
        latestGeneration,
      );
      if (finalState) {
        this.io.to(roomId).emit("game:state-updated", finalState);
      }
    } catch (error) {
      console.error("Error processing updates:", error);
    } finally {
      // clear pending updates
      this.pendingUpdates.set(roomId, []);
    }
  }

  private queueUpdates(roomId: string, updates: CellUpdate[]): void {
    const roomUpdates = this.pendingUpdates.get(roomId) || [];

    roomUpdates.push({
      updates,
      timestamp: Date.now(),
    });

    this.pendingUpdates.set(roomId, roomUpdates);

    const existingTimeout = this.updateTimeouts.get(roomId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // process updates
    const timeout = setTimeout(() => {
      this.processUpdates(roomId);
      this.updateTimeouts.delete(roomId);
    }, this.BATCH_DELAY);

    this.updateTimeouts.set(roomId, timeout);
  }

  private setupEventHandlers(socket: Socket): void {
    // join / re-join a game room
    socket.on("game:join", async ({ roomId, userId, name }: JoinRoomData) => {
      try {
        const gameRoom = await gameRoomService.joinGameRoom(roomId, name, userId);
        socket.data.userId = userId;
        socket.data.roomId = roomId;
        socket.join(roomId);

        // clear any existing reconnection timeout
        const timeoutKey = `${roomId}:${userId}`;
        const existingTimeout = this.disconnectTimeouts.get(timeoutKey);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          this.disconnectTimeouts.delete(timeoutKey);
        }

        // get the player that just joined
        const player = gameRoom.players.find((p: PlayerWithStatus) => p.id === userId);
        if (!player) {
          throw new Error("Player not found after joining");
        }

        // get current game state if game has started
        const gameState = gameRoom.hasStarted ? await gameRoomService.getGameState(roomId) : null;

        // emit current room state to the new joiner
        socket.emit("game:room-state", gameRoom);
        socket.emit("game:state-updated", gameState);

        // notify others about the new/reconnected member
        this.io.to(roomId).emit("game:player-joined", {
          userId: player.id,
          socketId: socket.id,
          name: player.name,
          color: player.color,
          isHost: player.isHost,
          status: player.status,
          lastStatusChange: player.lastStatusChange,
          totalMembers: gameRoom.players.length,
          isReconnected: gameState !== null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to join room";
        socket.emit("game:error", { message });
      }
    });

    socket.on(
      "game:status-update",
      async ({ roomId, status }: { roomId: string; status: "running" | "paused" | "stopped" }) => {
        try {
          const gameRoom = await gameRoomService.getGameRoom(roomId);
          if (!gameRoom) {
            throw new Error("Game room not found");
          }

          const player = gameRoom.players.find(
            (p: PlayerWithStatus) => p.id === socket.data.userId,
          );
          if (!player) {
            throw new Error("Player not found");
          }

          if (!player.isHost) {
            throw new Error("Only host can update game status");
          }

          if (player.status === PlayerStatus.Inactive) {
            throw new Error("Cannot update game status while inactive");
          }

          // update game status based on the requested status
          switch (status) {
            case GameStatus.Enum.running:
              if (!gameRoom.hasStarted) {
                await gameRoomService.startGame(roomId);
              }
              break;
            case GameStatus.Enum.stopped:
              await gameRoomService.pauseGame(roomId);
              break;
            case GameStatus.Enum.paused:
              // game remains started but is paused
              break;
          }

          // emit the status update to all clients in the room
          this.io.to(roomId).emit("game:status-updated", { status });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to update game status";
          socket.emit("game:error", { message });
        }
      },
    );

    // TODO: add feature in the UI in the future to allow players to leave the game
    socket.on("game:leave", async ({ roomId }: { roomId: string }) => {
      try {
        const gameRoom = await gameRoomService.getGameRoom(roomId);
        if (gameRoom) {
          const player = gameRoom.players.find(
            (p: PlayerWithStatus) => p.id === socket.data.userId,
          );
          if (player) {
            // clear any existing reconnection timeout
            const timeoutKey = `${roomId}:${player.id}`;
            const existingTimeout = this.disconnectTimeouts.get(timeoutKey);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
              this.disconnectTimeouts.delete(timeoutKey);
            }

            const updatedRoom = await gameRoomService.removePlayerFromRoom(
              roomId,
              socket.data.userId,
            );
            socket.data.roomId = undefined;
            socket.leave(roomId);

            this.io.to(roomId).emit("game:player-left", {
              userId: player.id,
              socketId: socket.id,
              name: player.name,
              color: player.color,
              totalMembers: updatedRoom.players.length,
            });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to leave room";
        socket.emit("game:error", { message });
      }
    });

    socket.on("game:update", async ({ roomId, updates, reset }: UpdateGridData) => {
      try {
        const gameRoom = await gameRoomService.getGameRoom(roomId);
        if (!gameRoom) return;

        const player = gameRoom.players.find((p: PlayerWithStatus) => p.id === socket.data.userId);
        if (!player) return;

        if (reset) {
          // handle reset separately since it's a special case
          const emptyGrid = Array(GRID_ROWS)
            .fill(null)
            .map(() =>
              Array(GRID_COLS).fill({
                isAlive: false,
                ownerId: undefined,
                color: undefined,
              }),
            );
          const newState = await gameRoomService.updateGameState(roomId, emptyGrid, true, 0);
          this.io.to(roomId).emit("game:state-updated", newState);
          return;
        }

        // queue all updates for batch processing
        this.queueUpdates(roomId, updates);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update game state";
        socket.emit("game:error", { message });
      }
    });

    socket.on("game:start", async ({ roomId }: { roomId: string }) => {
      try {
        const gameRoom = await gameRoomService.getGameRoom(roomId);
        if (gameRoom) {
          const player = gameRoom.players.find(
            (p: PlayerWithStatus) => p.id === socket.data.userId,
          );
          if (player && player.isHost && player.status === "active") {
            const gameRoomMetadata = await gameRoomService.startGame(roomId);
            this.io.to(roomId).emit("game:started", gameRoomMetadata);
          } else if (player && !player.isHost) {
            socket.emit("game:error", { message: "Only host can start the game" });
          } else if (player && player.status === "inactive") {
            socket.emit("game:error", { message: "Cannot start game while inactive" });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to start game";
        socket.emit("game:error", { message });
      }
    });

    socket.on("game:pause", async ({ roomId }: { roomId: string }) => {
      try {
        const gameRoom = await gameRoomService.getGameRoom(roomId);
        if (gameRoom) {
          const player = gameRoom.players.find(
            (p: PlayerWithStatus) => p.id === socket.data.userId,
          );
          if (player && player.isHost && player.status === "active") {
            await gameRoomService.pauseGame(roomId);

            this.io.to(roomId).emit("game:paused", {
              userId: player.id,
              name: player.name,
              color: player.color,
              status: player.status,
            });
            return;
          }
          if (player && !player.isHost) {
            socket.emit("game:error", { message: "Only host can pause the game" });
            return;
          }

          if (player && player.status === PlayerStatus.Inactive) {
            socket.emit("game:error", { message: "Cannot pause game while inactive" });
            return;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to pause game";
        socket.emit("game:error", { message });
      }
    });
  }
}
