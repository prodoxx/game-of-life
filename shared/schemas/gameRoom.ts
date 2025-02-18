import { z } from "zod";
import { isCuid } from "@paralleldrive/cuid2";
import { PlayerWithStatusSchema } from "./player";

export const GameStatus = z.enum(["stopped", "running", "paused"]);
export type GameStatus = z.infer<typeof GameStatus>;

export const GameRoomMetadataSchema = z.object({
  id: z.string().refine(isCuid, "Invalid room ID format"),
  createdAt: z.string().datetime(),
  lastActivity: z.string().datetime(),
  players: z.array(PlayerWithStatusSchema),
  hasStarted: z.boolean().default(false),
  gameStatus: GameStatus.default("stopped"),
});

export const CreateGameRoomSchema = z.object({
  hostName: z.string().trim().min(1, "Host name is required"),
  hostId: z.string().refine(isCuid, "Invalid host ID format"),
});

export type GameRoomMetadata = z.infer<typeof GameRoomMetadataSchema>;
