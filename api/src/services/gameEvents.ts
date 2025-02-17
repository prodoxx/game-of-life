import { Server, Socket } from "socket.io";
import { PlayerWithStatus, PlayerStatus, CellState } from "@game/shared";
import { gameRoomService } from "./gameRoom";
import { config } from "@/config/config";

interface JoinRoomData {
  roomId: string;
  userId: string;
  name: string;
}

interface UpdateGridData {
  roomId: string;
  grid: CellState[][];
}

export class GameEventsService {
  // store timeouts for each player to handle reconnection
  private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

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
      const roomId = Array.from(socket.rooms)[1]; // first room is socket's own room
      if (roomId) {
        const gameRoom = await gameRoomService.getGameRoom(roomId);
        if (gameRoom) {
          const player = gameRoom.players.find(
            (p: PlayerWithStatus) => p.id === socket.data.userId,
          );
          if (player) {
            // set player status to inactive
            await gameRoomService.updatePlayerStatus(roomId, player.id, PlayerStatus.Inactive);

            // note: we don't remove the player immediately on disconnect to allow for reconnection
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

  private setupEventHandlers(socket: Socket): void {
    // join / re-join a game room
    socket.on("game:join", async ({ roomId, userId, name }: JoinRoomData) => {
      try {
        const gameRoom = await gameRoomService.joinGameRoom(roomId, name, userId);
        socket.data.userId = userId;
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

    // leave a game room
    socket.on("game:leave", async ({ roomId }: { roomId: string }) => {
      try {
        const gameRoom = await gameRoomService.getGameRoom(roomId);
        if (gameRoom) {
          const player = gameRoom.players.find(
            (p: PlayerWithStatus) => p.id === socket.data.userId,
          );
          if (player) {
            // Clear any existing reconnection timeout
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

    // update game state
    socket.on("game:update", async ({ roomId, grid }: UpdateGridData) => {
      try {
        const gameRoom = await gameRoomService.getGameRoom(roomId);
        if (gameRoom) {
          const player = gameRoom.players.find(
            (p: PlayerWithStatus) => p.id === socket.data.userId,
          );
          if (player && player.status === "active") {
            const newState = await gameRoomService.updateGameState(roomId, grid);
            // broadcast state update to all clients in the room
            this.io.to(roomId).emit("game:state-updated", {
              grid: newState.grid,
              userId: player.id,
              name: player.name,
              color: player.color,
              status: player.status,
              generation: newState.generation,
              lastUpdated: newState.lastUpdated,
            });
          } else if (player && player.status === "inactive") {
            socket.emit("game:error", { message: "Cannot update game state while inactive" });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update game state";
        socket.emit("game:error", { message });
      }
    });

    // start game
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

    // pause game
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
          } else if (player && !player.isHost) {
            socket.emit("game:error", { message: "Only host can pause the game" });
          } else if (player && player.status === "inactive") {
            socket.emit("game:error", { message: "Cannot pause game while inactive" });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to pause game";
        socket.emit("game:error", { message });
      }
    });
  }
}
