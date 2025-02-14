import { z } from "zod";
import { isCuid } from "@paralleldrive/cuid2";

// represents a cell in the game grid
export const CellStateSchema = z.object({
  isAlive: z.boolean(),
  ownerId: z.string().refine(isCuid).optional(),
});

export type CellState = z.infer<typeof CellStateSchema>;

// represents the entire game state
export const GameStateSchema = z.object({
  grid: z.array(z.array(CellStateSchema)),
  generation: z.number().int().nonnegative(),
  lastUpdated: z.string().datetime(),
});

export type GameState = z.infer<typeof GameStateSchema>;
