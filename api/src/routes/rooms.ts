import { Router, Request, Response } from "express";
import { z } from "zod";
import { gameRoomService } from "@/services/gameRoom";
import { isCuid } from "@paralleldrive/cuid2";
import { CreateGameRoomSchema } from "@/services/schemas";

const router: Router = Router();

type CreateRoomRequest = z.infer<typeof CreateGameRoomSchema>;
interface RoomParams {
  roomId: string;
}

interface JoinRoomRequest {
  playerName: string;
  playerId: string;
}

const createRoom = async (
  req: Request<Record<string, never>, Record<string, never>, CreateRoomRequest>,
  res: Response,
) => {
  try {
    const { hostName, hostId } = CreateGameRoomSchema.parse(req.body);
    const room = await gameRoomService.createGameRoom(hostName, hostId);
    res.status(201).json({ data: room });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({ error: "Failed to create game room" });
  }
};

const getRoom = async (req: Request<RoomParams>, res: Response) => {
  try {
    const { roomId } = req.params;

    if (!isCuid(roomId)) {
      res.status(400).json({ error: "Invalid room ID format" });
      return;
    }

    const room = await gameRoomService.getGameRoom(roomId);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    res.status(200).json({ data: room });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch game room" });
  }
};

const joinRoom = async (
  req: Request<RoomParams, Record<string, never>, JoinRoomRequest>,
  res: Response,
) => {
  try {
    const { roomId } = req.params;
    const { playerName, playerId } = req.body;

    if (!isCuid(roomId)) {
      res.status(400).json({ error: "Invalid room ID format" });
      return;
    }

    const room = await gameRoomService.joinGameRoom(roomId, playerName, playerId);
    res.status(200).json({ data: room });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message === "Game room not found") {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === "Game room is full") {
        res.status(409).json({ error: error.message });
        return;
      }
    }

    res.status(500).json({ error: "Failed to join game room" });
  }
};

router.post("/rooms", createRoom);
router.get("/rooms/:roomId", getRoom);
router.post("/rooms/:roomId/join", joinRoom);

export default router;
