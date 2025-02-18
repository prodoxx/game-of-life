import { z } from "zod";
import { isCuid } from "@paralleldrive/cuid2";
import { isValidPlayerName, sanitizePlayerName } from "../utils/sanitize";

export enum PlayerStatus {
  Active = "active",
  Inactive = "inactive",
}

export const PlayerSchema = z.object({
  id: z.string().refine(isCuid, "Invalid player ID format"),
  name: z.string().transform(sanitizePlayerName).refine(isValidPlayerName, {
    message:
      "Name must be between 1 and 20 characters and contain only letters, numbers, spaces, and hyphens",
  }),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  isHost: z.boolean(),
});

export const PlayerWithStatusSchema = PlayerSchema.extend({
  status: z.nativeEnum(PlayerStatus).default(PlayerStatus.Active),
  lastStatusChange: z.string().datetime().default(new Date().toISOString()),
});

export type Player = z.infer<typeof PlayerSchema>;
export type PlayerWithStatus = z.infer<typeof PlayerWithStatusSchema>;
