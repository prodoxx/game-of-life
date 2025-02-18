import { createId, isCuid } from "@paralleldrive/cuid2";
import redisClient from "../init/redis";
import { config } from "@/config/config";
import {
  GameRoomMetadata,
  Player,
  PlayerWithStatus,
  GameRoomMetadataSchema,
  CreateGameRoomSchema,
  PlayerStatus,
  PlayerWithStatusSchema,
  GameState,
  CellState,
  GRID_ROWS,
  GRID_COLS,
} from "@game/shared";
import { getRandomUnusedColor } from "@game/shared";
import { z } from "zod";

const GameRoomWithStatusSchema = GameRoomMetadataSchema.extend({
  players: z.array(PlayerWithStatusSchema),
});

interface GameRoomWithStatus extends Omit<GameRoomMetadata, "players"> {
  players: PlayerWithStatus[];
}

class GameRoomService {
  private getGameStateKey(gameRoomId: string): string {
    return `gameState:${gameRoomId}`;
  }

  async getGameRoom(gameRoomId: string): Promise<GameRoomMetadata | null> {
    if (!isCuid(gameRoomId)) {
      throw new Error("Invalid game room ID format");
    }

    const gameRoom = await redisClient.get(`gameRoom:${gameRoomId}`);
    return gameRoom ? JSON.parse(gameRoom) : null;
  }

  async getGameState(gameRoomId: string): Promise<GameState | null> {
    const state = await redisClient.get(this.getGameStateKey(gameRoomId));
    return state ? JSON.parse(state) : null;
  }

  async updateGameState(
    gameRoomId: string,
    grid: CellState[][],
    reset: boolean = false,
    generation?: number,
  ): Promise<GameState> {
    const stateKey = this.getGameStateKey(gameRoomId);
    let retries = config.maxUpdateRetries;

    while (retries > 0) {
      try {
        await redisClient.watch(stateKey);
        const currentState = await this.getGameState(gameRoomId);

        let mergedGrid = grid;
        if (currentState && !reset) {
          mergedGrid = this.mergeGrids(currentState.grid, grid);
        }

        let nextGeneration: number;
        if (reset) {
          nextGeneration = 0;
        } else if (generation !== undefined) {
          nextGeneration = generation;
        } else {
          nextGeneration = currentState?.generation ?? 0;
        }

        const newState: GameState = {
          grid: mergedGrid,
          generation: nextGeneration,
          lastUpdated: new Date().toISOString(),
        };

        const multi = redisClient.multi();
        multi.set(stateKey, JSON.stringify(newState), {
          EX: config.roomExpiration,
        });

        const results = await multi.exec();
        if (!results) {
          retries--;
          continue;
        }

        return newState;
      } catch (error) {
        await redisClient.unwatch();
        throw error;
      }
    }

    throw new Error("Failed to update game state after maximum retries");
  }

  private mergeGrids(grid1: CellState[][], grid2: CellState[][]): CellState[][] {
    const mergedGrid: CellState[][] = grid1.map((row) => [...row]);

    for (let i = 0; i < grid1.length; i++) {
      for (let j = 0; j < grid1[i].length; j++) {
        if (grid2[i][j] !== grid1[i][j]) {
          mergedGrid[i][j] = grid2[i][j];
        }
      }
    }

    return mergedGrid;
  }

  async updatePlayerStatus(
    gameRoomId: string,
    playerId: string,
    status: PlayerStatus,
  ): Promise<GameRoomMetadata> {
    const gameRoom = await this.getGameRoom(gameRoomId);
    if (!gameRoom) {
      throw new Error("Game room not found");
    }

    const player = gameRoom.players.find((p: PlayerWithStatus) => p.id === playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    player.status = status;
    player.lastStatusChange = new Date().toISOString();

    return await this.saveGameRoom(gameRoomId, gameRoom);
  }

  async joinGameRoom(
    gameRoomId: string,
    playerName: string,
    playerId: string,
  ): Promise<GameRoomMetadata> {
    const gameRoom = await this.getGameRoom(gameRoomId);

    if (!gameRoom) {
      throw new Error("Game room not found");
    }

    const existingPlayer = gameRoom.players.find((p: PlayerWithStatus) => p.id === playerId);
    if (existingPlayer) {
      if (existingPlayer.name !== playerName || existingPlayer.status !== PlayerStatus.Active) {
        existingPlayer.name = playerName;
        existingPlayer.status = PlayerStatus.Active;
        existingPlayer.lastStatusChange = new Date().toISOString();
        await this.saveGameRoom(gameRoomId, gameRoom);
      }
      return gameRoom;
    }

    if (gameRoom.players.length >= config.playerLimit) {
      throw new Error("Game room is full");
    }

    const usedColors = gameRoom.players.map((p: Player) => p.color);
    const newColor = getRandomUnusedColor(usedColors);

    const newPlayer: PlayerWithStatus = {
      id: playerId,
      name: playerName,
      color: newColor,
      isHost: false,
      status: PlayerStatus.Active,
      lastStatusChange: new Date().toISOString(),
    };

    gameRoom.players.push(newPlayer);
    return await this.saveGameRoom(gameRoomId, gameRoom);
  }

  private async saveGameRoom(
    gameRoomId: string,
    gameRoom: GameRoomMetadata,
  ): Promise<GameRoomMetadata> {
    gameRoom.lastActivity = new Date().toISOString();
    GameRoomMetadataSchema.parse(gameRoom);
    await redisClient.set(`gameRoom:${gameRoomId}`, JSON.stringify(gameRoom), {
      EX: config.roomExpiration,
    });
    return gameRoom;
  }

  async removePlayerFromRoom(gameRoomId: string, playerId: string): Promise<GameRoomMetadata> {
    const gameRoom = await this.getGameRoom(gameRoomId);
    if (!gameRoom) {
      throw new Error("Game room not found");
    }

    const playerIndex = gameRoom.players.findIndex((p: PlayerWithStatus) => p.id === playerId);
    if (playerIndex === -1) {
      return gameRoom;
    }

    const isHost = gameRoom.players[playerIndex].isHost;
    gameRoom.players.splice(playerIndex, 1);

    if (isHost && gameRoom.players.length > 0) {
      gameRoom.players[0].isHost = true;
    }

    return await this.saveGameRoom(gameRoomId, gameRoom);
  }

  async startGame(gameRoomId: string): Promise<GameRoomMetadata> {
    const gameRoom = await this.getGameRoom(gameRoomId);
    if (!gameRoom) {
      throw new Error("Game room not found");
    }

    const inactivePlayers = gameRoom.players.filter(
      (p: PlayerWithStatus) => p.status === "inactive",
    );
    if (inactivePlayers.length > 0) {
      throw new Error("Cannot start game with inactive players");
    }

    // initialize empty game state
    const emptyGrid = Array(GRID_ROWS)
      .fill(null)
      .map(() =>
        Array(GRID_COLS).fill({
          isAlive: false,
          ownerId: undefined,
          color: undefined,
        }),
      );

    const initialState: GameState = {
      grid: emptyGrid,
      generation: 0,
      lastUpdated: new Date().toISOString(),
    };

    // save initial game state
    await redisClient.set(this.getGameStateKey(gameRoomId), JSON.stringify(initialState), {
      EX: config.roomExpiration,
    });

    gameRoom.hasStarted = true;
    return await this.saveGameRoom(gameRoomId, gameRoom);
  }

  async pauseGame(gameRoomId: string): Promise<GameRoomMetadata> {
    const gameRoom = await this.getGameRoom(gameRoomId);
    if (!gameRoom) {
      throw new Error("Game room not found");
    }

    gameRoom.hasStarted = false;
    return await this.saveGameRoom(gameRoomId, gameRoom);
  }

  async createGameRoom(hostName: string, hostId: string): Promise<GameRoomMetadata> {
    const validatedData = CreateGameRoomSchema.parse({ hostName, hostId });

    const gameRoomId = createId();
    const metadata: GameRoomMetadata = {
      id: gameRoomId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      players: [
        {
          id: validatedData.hostId,
          name: validatedData.hostName,
          color: config.playerColor,
          isHost: true,
          status: PlayerStatus.Active,
          lastStatusChange: new Date().toISOString(),
        },
      ],
      hasStarted: false,
      gameStatus: "stopped",
    };

    GameRoomWithStatusSchema.parse(metadata);
    await this.saveGameRoom(gameRoomId, metadata);

    return metadata;
  }
}

const gameRoomService = new GameRoomService();
export {
  gameRoomService,
  type GameRoomMetadata,
  type Player,
  type GameState,
  type PlayerStatus,
  type PlayerWithStatus,
  type GameRoomWithStatus,
};
