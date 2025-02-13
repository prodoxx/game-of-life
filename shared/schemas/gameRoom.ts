import { z } from "zod";
import { isCuid } from "@paralleldrive/cuid2";
import { PlayerSchema } from "./player";

export const GameRoomMetadataSchema = z.object({
  id: z.string().refine(isCuid, "Invalid room ID format"),
  createdAt: z.string().datetime(),
  lastActivity: z.string().datetime(),
  players: z.array(PlayerSchema),
  hasStarted: z.boolean().default(false),
});

export const CreateGameRoomSchema = z.object({
  hostName: z.string().trim().min(1, "Host name is required"),
  hostId: z.string().refine(isCuid, "Invalid host ID format"),
});

export type GameRoomMetadata = z.infer<typeof GameRoomMetadataSchema>;
