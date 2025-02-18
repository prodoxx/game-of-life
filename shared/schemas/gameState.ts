import { z } from "zod";
import { isCuid } from "@paralleldrive/cuid2";

// represents a cell in the game grid
export const CellStateSchema = z.object({
  isAlive: z.boolean(),
  ownerId: z.string().refine(isCuid).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(), // hex color string
});

// represents a single cell update
export const CellUpdateSchema = z.object({
  row: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
  state: CellStateSchema,
  timestamp: z.number(),
  userId: z.string().refine(isCuid),
  roomId: z.string().refine(isCuid),
  generation: z.number().int().nonnegative(),
  isHeartbeat: z.boolean().optional(),
});

// represents the entire game state
export const GameStateSchema = z.object({
  grid: z.array(z.array(CellStateSchema)),
  generation: z.number().int().nonnegative(),
  lastUpdated: z.string().datetime(),
});

export type CellState = z.infer<typeof CellStateSchema>;
export type CellUpdate = z.infer<typeof CellUpdateSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
