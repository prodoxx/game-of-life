import { io, Socket } from "socket.io-client";
import { config } from "../config";
import type { GameRoomMetadata, CellState, GameStatus, CellUpdate } from "@game/shared";

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private pendingUpdates: Map<string, CellUpdate> = new Map();
  private currentUserId?: string;
  constructor() {
    this.init();
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        if (this.socket?.connected) {
          this.socket.disconnect();
        }
      });
    }
  }

  private init(): void {
    this.socket = io(config.apiUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this.isConnected = true;
    });

    this.socket.on("disconnect", () => {
      this.isConnected = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });
  }

  public connect(): void {
    if (!this.socket || this.isConnected) return;
    this.socket.connect();
  }

  public disconnect(): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.disconnect();
  }

  public joinRoom(roomId: string, userId: string, name: string): Promise<GameRoomMetadata> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not initialized"));
        return;
      }

      this.currentUserId = userId;

      // handle room state response
      this.socket.once("game:room-state", (state: GameRoomMetadata) => {
        resolve(state);
      });

      // emit join event
      this.socket.emit("game:join", { roomId, userId, name });
    });
  }

  public leaveRoom(roomId: string): void {
    if (!this.socket) return;
    this.socket.emit("game:leave", { roomId });
  }

  public onRoomState(callback: (state: GameRoomMetadata) => void): void {
    this.socket?.on("game:room-state", callback);
  }

  public onPlayerJoined(
    callback: (data: {
      userId: string;
      socketId: string;
      name: string;
      color: string;
      isHost: boolean;
      status: string;
      lastStatusChange: string;
      totalMembers: number;
      isReconnected: boolean;
    }) => void,
  ): void {
    this.socket?.on("game:player-joined", callback);
  }

  public onPlayerLeft(
    callback: (data: {
      userId: string;
      socketId: string;
      name: string;
      color: string;
      totalMembers: number;
    }) => void,
  ): void {
    this.socket?.on("game:player-left", callback);
  }

  public onError(callback: (error: { message: string }) => void): void {
    this.socket?.on("game:error", callback);
  }

  public startGame(roomId: string): void {
    if (!this.socket) return;
    this.socket.emit("game:start", { roomId });
  }

  public onGameStarted(callback: (gameRoomMetadata: GameRoomMetadata) => void): void {
    this.socket?.on("game:started", callback);
  }

  public updateGameState(
    roomId: string,
    updates: CellUpdate[],
    reset: boolean = false,
    generation?: number,
  ): void {
    if (!this.socket) return;

    // store pending updates
    for (const update of updates) {
      const key = `${update.roomId}:${update.row}:${update.col}:${update.timestamp}`;
      this.pendingUpdates.set(key, update);
    }

    this.socket.emit("game:update", { roomId, updates, reset, generation });
  }

  public onGameStateUpdated(
    callback: (data: { grid: CellState[][]; generation: number; lastUpdated: string }) => void,
  ): void {
    this.socket?.on("game:state-updated", (data) => {
      // clear pending updates as they've been confirmed
      this.pendingUpdates.clear();
      callback(data);
    });
  }

  public updateGameStatus(roomId: string, status: GameStatus): void {
    if (!this.socket) return;
    this.socket.emit("game:status-update", { roomId, status });
  }

  public onGameStatusUpdated(callback: (data: { status: GameStatus }) => void): void {
    this.socket?.on("game:status-updated", callback);
  }

  public getPendingUpdates(): CellUpdate[] {
    return Array.from(this.pendingUpdates.values());
  }

  public onPlayerDisconnected(
    callback: (data: {
      userId: string;
      socketId: string;
      name: string;
      color: string;
      status: string;
    }) => void,
  ): void {
    this.socket?.on("game:player-disconnected", callback);
  }

  public onPlayerReconnected(
    callback: (data: {
      userId: string;
      socketId: string;
      name: string;
      color: string;
      status: string;
      isReconnected: boolean;
    }) => void,
  ): void {
    this.socket?.on("game:player-joined", (data) => {
      if (data.isReconnected) {
        callback(data);
      }
    });
  }
}

export const socketService = new SocketService();
