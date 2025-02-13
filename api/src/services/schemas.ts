import { z } from "zod";
import { isCuid } from "@paralleldrive/cuid2";

export const PlayerSchema = z.object({
  id: z.string().refine(isCuid, "Invalid player ID format"),
  name: z.string().trim().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  isHost: z.boolean(),
});

export const GameRoomMetadataSchema = z.object({
  id: z.string().refine(isCuid, "Invalid room ID format"),
  createdAt: z.string().datetime(),
  lastActivity: z.string().datetime(),
  players: z.array(PlayerSchema),
  hasStarted: z.boolean().default(false),
});

export type Player = z.infer<typeof PlayerSchema>;
export type GameRoomMetadata = z.infer<typeof GameRoomMetadataSchema>;

export const CreateGameRoomSchema = z.object({
  hostName: z.string().trim().min(1, "Host name is required"),
  hostId: z.string().refine(isCuid, "Invalid host ID format"),
});
