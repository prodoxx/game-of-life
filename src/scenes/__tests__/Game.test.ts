import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Game, Cell } from "../Game";
import * as constants from "../../constants";
import { MockRectangle, MockPointerEvent } from "./mocks/phaser";

type Mock = ReturnType<typeof vi.fn>;

// helper function to safely cast Rectangle to MockRectangle
const asMockRectangle = (sprite: Phaser.GameObjects.Rectangle): MockRectangle => sprite as unknown as MockRectangle;

describe("Game Scene", () => {
  let game: Game;
  let inputCallback: (pointer: MockPointerEvent, gameObject: MockRectangle) => void;
  let originalGridCols: number;
  let originalGridRows: number;

  beforeEach(() => {
    vi.clearAllMocks();
    originalGridCols = constants.GRID_COLS;
    originalGridRows = constants.GRID_ROWS;
    game = new Game();
    game.create();

    // capture the input callback for testing
    inputCallback = (game.input.on as unknown as Mock).mock.calls[0][1];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(constants, "GRID_COLS", { value: originalGridCols });
    Object.defineProperty(constants, "GRID_ROWS", { value: originalGridRows });
  });

  describe("Grid Creation", () => {
    it("happy: should create a grid of correct size", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      expect(grid.length).toBe(constants.GRID_ROWS);
      expect(grid[0].length).toBe(constants.GRID_COLS);
    });

    it("happy: should initialize all cells as dead", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      for (let row = 0; row < constants.GRID_ROWS; row++) {
        for (let col = 0; col < constants.GRID_COLS; col++) {
          const cell = grid[row][col];
          expect(cell.isAlive).toBe(false);
        }
      }
    });

    it("happy: should position grid starting from top-left", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;

      const firstCell = asMockRectangle(grid[0][0].sprite);
      expect(firstCell.x).toBe(constants.CELL_SIZE / 2);
      expect(firstCell.y).toBe(constants.CELL_SIZE / 2);

      const lastCell = asMockRectangle(grid[constants.GRID_ROWS - 1][constants.GRID_COLS - 1].sprite);
      expect(lastCell.x).toBe((constants.GRID_COLS - 1) * constants.CELL_SIZE + constants.CELL_SIZE / 2);
      expect(lastCell.y).toBe((constants.GRID_ROWS - 1) * constants.CELL_SIZE + constants.CELL_SIZE / 2);
    });

    describe("Edge Cases", () => {
      it("happy: should handle 1x1 grid", () => {
        Object.defineProperty(constants, "GRID_COLS", { value: 1 });
        Object.defineProperty(constants, "GRID_ROWS", { value: 1 });

        const minGame = new Game();
        minGame.create();

        const grid = (minGame as unknown as { grid: Cell[][] }).grid;
        expect(grid.length).toBe(1);
        expect(grid[0].length).toBe(1);
      });

      it("sad: should handle zero or negative grid dimensions", () => {
        Object.defineProperty(constants, "GRID_COLS", { value: 0 });
        Object.defineProperty(constants, "GRID_ROWS", { value: -1 });

        expect(() => {
          const invalidGame = new Game();
          invalidGame.create();
        }).toThrow("Grid dimensions must be positive numbers");
      });
    });
  });

  describe("Cell State Management", () => {
    it("happy: should maintain consistent state after multiple toggles", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      const cell = grid[0][0];

      (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 0);
      expect(cell.isAlive).toBe(true);

      (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 0);
      expect(cell.isAlive).toBe(false);
    });

    it("happy: should handle rapid multiple clicks on same cell", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      const cell = asMockRectangle(grid[0][0].sprite);

      inputCallback({ x: 0, y: 0 }, cell);
      inputCallback({ x: 0, y: 0 }, cell);
      inputCallback({ x: 0, y: 0 }, cell);

      expect(grid[0][0].isAlive).toBe(true);
    });

    it("happy: should handle clicks on grid boundaries", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      const cornerCell = asMockRectangle(grid[constants.GRID_ROWS - 1][constants.GRID_COLS - 1].sprite);

      inputCallback({ x: 0, y: 0 }, cornerCell);
      expect(grid[constants.GRID_ROWS - 1][constants.GRID_COLS - 1].isAlive).toBe(true);
    });
  });
});
