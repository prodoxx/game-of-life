import { vi } from "vitest";
import { mockPhaser } from "./mocks/phaser";

vi.mock("phaser", () => mockPhaser);

(global as any).Phaser = {
  Math: mockPhaser.Math,
};

// mock constants module with default values
vi.mock("../constants", () => ({
  GRID_SIZE: 16,
  CELL_SIZE: 32,
  GRID_BORDER_COLOR: 0x333333, // gray
  ALIVE_COLOR: 0x00ff00, // green
  DEAD_COLOR: 0x000000, // black
}));
