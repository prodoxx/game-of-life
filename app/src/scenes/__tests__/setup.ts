import { vi } from "vitest";
import { mockPhaser } from "./mocks/phaser";

vi.mock("phaser", () => mockPhaser);

(global as any).Phaser = {
  Math: mockPhaser.Math,
};

// mock constants module with default values
vi.mock("../constants", () => ({
  GRID_ROWS: 30,
  GRID_COLS: 30,
  GRID_SIZE: 16,
  CELL_SIZE: 32,
  GRID_BORDER_COLOR: 0x333333, // gray
  ALIVE_COLOR: 0x00ff00, // green
  DEAD_COLOR: 0x000000, // black
  DEAD_CELL_OPACITY: 0.3,
  GRID_WIDTH: 30 * 32, // GRID_COLS * CELL_SIZE
  GRID_HEIGHT: 30 * 32, // GRID_ROWS * CELL_SIZE
  GENERATION_TICK_MS: 1000, // 1 second per generation
  NEIGHBOR_OFFSETS: new Map([
    ["TOP_LEFT", [-1, -1]],
    ["TOP", [-1, 0]],
    ["TOP_RIGHT", [-1, 1]],
    ["LEFT", [0, -1]],
    ["RIGHT", [0, 1]],
    ["BOTTOM_LEFT", [1, -1]],
    ["BOTTOM", [1, 0]],
    ["BOTTOM_RIGHT", [1, 1]],
  ]),
}));
