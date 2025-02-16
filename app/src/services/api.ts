import axios from "axios";
import type { GameRoomMetadata } from "@game/shared";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

class ApiService {
  public async getRoomById(roomId: string): Promise<GameRoomMetadata> {
    const response = await api.get<{ data: GameRoomMetadata }>(`/v1/rooms/${roomId}`);
    console.log(response.data);
    return response.data.data;
  }

  public async createRoom(hostName: string, hostId: string): Promise<GameRoomMetadata> {
    const response = await api.post<{ data: GameRoomMetadata }>("/v1/rooms", {
      hostName,
      hostId,
    });
    return response.data.data;
  }

  public async joinRoom(
    roomId: string,
    playerName: string,
    playerId: string,
  ): Promise<GameRoomMetadata> {
    const response = await api.post<{ data: GameRoomMetadata }>(`/v1/rooms/${roomId}/join`, {
      playerName,
      playerId,
    });
    return response.data.data;
  }
}

export const apiService = new ApiService();
