import { z } from "zod";
import { isCuid } from "@paralleldrive/cuid2";

export const PlayerSchema = z.object({
  id: z.string().refine(isCuid, "Invalid player ID format"),
  name: z.string().trim().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  isHost: z.boolean(),
});

export type Player = z.infer<typeof PlayerSchema>;
