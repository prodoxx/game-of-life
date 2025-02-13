import { createId, isCuid } from "@paralleldrive/cuid2";
import redisClient from "../init/redis";
import { config } from "@/config/config";
import { GameRoomMetadata, Player, GameRoomMetadataSchema, CreateGameRoomSchema } from "@game/shared";
import { getRandomUnusedColor } from "@game/shared";

class GameRoomService {
  async getGameRoom(gameRoomId: string) {
    if (!isCuid(gameRoomId)) {
      throw new Error("Invalid game room ID format");
    }

    const gameRoom = await redisClient.get(`gameRoom:${gameRoomId}`);
    return gameRoom ? JSON.parse(gameRoom) : null;
  }

  async joinGameRoom(gameRoomId: string, playerName: string, playerId: string): Promise<GameRoomMetadata> {
    const gameRoom = await this.getGameRoom(gameRoomId);

    if (!gameRoom) {
      throw new Error("Game room not found");
    }

    // check if player is already in the game
    const existingPlayer = gameRoom.players.find((p: Player) => p.id === playerId);
    if (existingPlayer) {
      return gameRoom;
    }

    // check if game is at capacity
    if (gameRoom.players.length >= config.playerLimit) {
      throw new Error("Game room is full");
    }

    // get used colors and assign a new random color
    const usedColors = gameRoom.players.map((p: Player) => p.color);
    const newColor = getRandomUnusedColor(usedColors);

    // add new player
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      color: newColor,
      isHost: false,
    };

    gameRoom.players.push(newPlayer);
    gameRoom.lastActivity = new Date().toISOString();

    // validate and save updated game room
    GameRoomMetadataSchema.parse(gameRoom);
    await redisClient.set(`gameRoom:${gameRoomId}`, JSON.stringify(gameRoom), {
      EX: config.roomExpiration,
    });

    return gameRoom;
  }

  async createGameRoom(hostName: string, hostId: string): Promise<GameRoomMetadata> {
    // validate inputs using zod schema
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
        },
      ],
      hasStarted: false,
    };

    GameRoomMetadataSchema.parse(metadata);

    await redisClient.set(`gameRoom:${gameRoomId}`, JSON.stringify(metadata), {
      EX: config.roomExpiration,
    });

    return metadata;
  }
}

const gameRoomService = new GameRoomService();
export { gameRoomService, type GameRoomMetadata, type Player };
