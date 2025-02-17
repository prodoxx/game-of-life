import { describe, it, expect, vi, beforeEach } from "vitest";
import redisClient from "../../init/redis";
import { PlayerStatus } from "@game/shared";

vi.mock("../../init/redis", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    watch: vi.fn(),
    unwatch: vi.fn(),
    multi: vi.fn(() => ({
      set: vi.fn(),
      exec: vi.fn(),
    })),
  },
}));

vi.mock("@/config/config", () => ({
  config: {
    maxUpdateRetries: 3,
    roomExpiration: 3600,
    playerLimit: 4,
    playerColor: "#ff0000",
  },
}));

import { gameRoomService } from "../gameRoom";

describe("GameRoomService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGameRoom", () => {
    it("should create a new game room and save it to redis", async () => {
      // arrange
      const hostName = "testHost";
      const hostId = "clh3f8zd50000356mpgju7qp1";
      const redisSpy = vi.spyOn(redisClient, "set");

      // act
      const result = await gameRoomService.createGameRoom(hostName, hostId);

      // assert
      expect(result.players[0].name).toBe(hostName);
      expect(result.players[0].id).toBe(hostId);
      expect(result.players[0].isHost).toBe(true);
      expect(redisSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("joinGameRoom", () => {
    it("should add a new player to an existing room", async () => {
      // arrange
      const gameRoomId = "clh3f8zd50000356mpgju7q22";
      const existingRoom = {
        id: gameRoomId,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        players: [],
        hasStarted: false,
      };

      vi.spyOn(redisClient, "get").mockResolvedValueOnce(JSON.stringify(existingRoom));
      const saveSpy = vi.spyOn(redisClient, "set");

      // act
      const result = await gameRoomService.joinGameRoom(
        gameRoomId,
        "newPlayer",
        "clh3f8zd50000356mpgju7q33",
      );

      // assert
      expect(result.players).toHaveLength(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("startGame", () => {
    it("should not start game with inactive players", async () => {
      // arrange
      const gameRoomId = "clh3f8zd50000356mpgju7q22";
      const existingRoom = {
        id: gameRoomId,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        players: [
          {
            id: "player1",
            name: "Player 1",
            color: "#ff0000",
            isHost: true,
            status: PlayerStatus.Inactive,
            lastStatusChange: new Date().toISOString(),
          },
        ],
        hasStarted: false,
      };

      vi.spyOn(redisClient, "get").mockResolvedValueOnce(JSON.stringify(existingRoom));

      // act & assert
      await expect(gameRoomService.startGame(gameRoomId)).rejects.toThrow(
        "Cannot start game with inactive players",
      );
    });
  });
});
