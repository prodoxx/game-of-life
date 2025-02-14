import { z } from "zod";
import { isCuid } from "@paralleldrive/cuid2";

export enum PlayerStatus {
  Active = "active",
  Inactive = "inactive",
}

export const PlayerSchema = z.object({
  id: z.string().refine(isCuid, "Invalid player ID format"),
  name: z.string().trim().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  isHost: z.boolean(),
});

export const PlayerWithStatusSchema = PlayerSchema.extend({
  status: z.nativeEnum(PlayerStatus).default(PlayerStatus.Active),
  lastStatusChange: z.string().datetime().default(new Date().toISOString()),
});

export type Player = z.infer<typeof PlayerSchema>;
export type PlayerWithStatus = z.infer<typeof PlayerWithStatusSchema>;
