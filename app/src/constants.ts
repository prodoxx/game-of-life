import { Offset, GameRule } from "./types";
import { GRID_ROWS, GRID_COLS, GRID_WIDTH, GRID_HEIGHT, CELL_SIZE } from "@game/shared";

export const GAME_WIDTH = typeof window !== "undefined" ? window.innerWidth : 1024;
export const GAME_HEIGHT = typeof window !== "undefined" ? window.innerHeight : 768;
export const GENERATION_TICK_MS = 1000;

// grid dimensions (fixed size that will be centered)
export { GRID_WIDTH, GRID_HEIGHT, CELL_SIZE, GRID_COLS, GRID_ROWS };

// colors
export const GRID_BORDER_COLOR = 0x666666; // lighter gray for better visibility
export const ALIVE_COLOR = 0x00ff00; // green
export const DEAD_COLOR = 0x111111; // very dark gray instead of pure black
export const DEAD_CELL_OPACITY = 0.85; // opacity for dead cells

export enum CellAction {
  SURVIVE = "SURVIVE",
  DIE = "DIE",
  REPRODUCE = "REPRODUCE",
}

export const GAME_RULES: GameRule[] = [
  {
    // rule 2: any live cell with two or three neighbors lives on
    when: { currentState: true, neighborCount: 2 },
    then: true,
    reason: CellAction.SURVIVE,
  },
  {
    // rule 2: any live cell with two or three neighbors lives on
    when: { currentState: true, neighborCount: 3 },
    then: true,
    reason: CellAction.SURVIVE,
  },
  {
    // rule 4: any dead cell with exactly three neighbors becomes alive
    when: { currentState: false, neighborCount: 3 },
    then: true,
    reason: CellAction.REPRODUCE,
  },
  {
    // rule 3: any live cell with more than three neighbors dies
    when: { currentState: true, neighborCount: 4 },
    then: false,
    reason: CellAction.DIE,
  },
  {
    // rule 1: any live cell with fewer than two neighbors dies
    when: { currentState: true, neighborCount: 1 },
    then: false,
    reason: CellAction.DIE,
  },
  {
    // rule 1: any live cell with fewer than two neighbors dies
    when: { currentState: true, neighborCount: 0 },
    then: false,
    reason: CellAction.DIE,
  },
];

export enum Direction {
  TOP_LEFT = "TOP_LEFT",
  TOP = "TOP",
  TOP_RIGHT = "TOP_RIGHT",
  LEFT = "LEFT",
  RIGHT = "RIGHT",
  BOTTOM_LEFT = "BOTTOM_LEFT",
  BOTTOM = "BOTTOM",
  BOTTOM_RIGHT = "BOTTOM_RIGHT",
}

export const NEIGHBOR_OFFSETS: Map<Direction, Offset> = new Map([
  [Direction.TOP_LEFT, [-1, -1]],
  [Direction.TOP, [-1, 0]],
  [Direction.TOP_RIGHT, [-1, 1]],
  [Direction.LEFT, [0, -1]],
  [Direction.RIGHT, [0, 1]],
  [Direction.BOTTOM_LEFT, [1, -1]],
  [Direction.BOTTOM, [1, 0]],
  [Direction.BOTTOM_RIGHT, [1, 1]],
]);

export const UI_VIEW = {
  CREATE_ROOM_VIEW: "create-room-view",
  JOIN_ROOM_VIEW: "join-room-view",
  JOIN_FORM_VIEW: "join-form-view",
} as const;
