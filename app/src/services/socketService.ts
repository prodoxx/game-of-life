import { io, Socket } from "socket.io-client";
import { config } from "../config";
import type { PlayerStatus } from "@game/shared";

interface RoomMember {
  userId: string;
  name: string;
  color: string;
  isHost: boolean;
  status: PlayerStatus;
  lastStatusChange: string;
}

interface GameRoomState {
  members: RoomMember[];
  gameState: any; // TODO: define game state type
  hasStarted: boolean;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  constructor() {
    this.init();
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
      console.log("socket connected");
      this.isConnected = true;
    });

    this.socket.on("disconnect", () => {
      console.log("socket disconnected");
      this.isConnected = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("connection error:", error);
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

  public joinRoom(roomId: string, userId: string, name: string): Promise<GameRoomState> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not initialized"));
        return;
      }

      // handle room state response
      this.socket.once("game:room-state", (state: GameRoomState) => {
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

  public onRoomState(callback: (state: GameRoomState) => void): void {
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
    }) => void
  ): void {
    this.socket?.on("game:player-joined", callback);
  }

  public onPlayerLeft(
    callback: (data: { userId: string; socketId: string; name: string; color: string; totalMembers: number }) => void
  ): void {
    this.socket?.on("game:player-left", callback);
  }

  public onError(callback: (error: { message: string }) => void): void {
    this.socket?.on("game:error", callback);
  }
}

export const socketService = new SocketService();
