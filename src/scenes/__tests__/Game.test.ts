import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Game } from "../Game";
import { Cell } from "../../types";
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

  describe("Game of Life Rules", () => {
    let grid: Cell[][];

    beforeEach(() => {
      grid = (game as unknown as { grid: Cell[][] }).grid;
    });

    describe("Underpopulation Rule", () => {
      it("happy: live cell with no neighbors should die", () => {
        // set up initial state
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1);

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        expect(grid[1][1].isAlive).toBe(false);
      });

      it("happy: live cell with one neighbor should die", () => {
        // set up initial state
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        expect(grid[1][1].isAlive).toBe(false);
        expect(grid[1][2].isAlive).toBe(false);
      });
    });

    describe("Survival Rule", () => {
      it("happy: live cell with two neighbors should survive", () => {
        // set up initial state
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(2, 1);

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        expect(grid[1][1].isAlive).toBe(true);
      });

      it("happy: live cell with three neighbors should survive", () => {
        // set up initial state
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(2, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(2, 2);

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        expect(grid[1][1].isAlive).toBe(true);
      });
    });

    describe("Overcrowding Rule", () => {
      it("happy: live cell with more than three neighbors should die", () => {
        // set up initial state with 4 neighbors
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1); // center
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1); // top
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0); // left
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2); // right
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(2, 1); // bottom

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        expect(grid[1][1].isAlive).toBe(false);
      });
    });

    describe("Reproduction Rule", () => {
      it("happy: dead cell with exactly three neighbors should become alive", () => {
        // set up initial state
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        expect(grid[1][1].isAlive).toBe(true);
      });

      it("happy: dead cell with two or four neighbors should stay dead", () => {
        // set up initial state with 2 neighbors
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0);

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        expect(grid[1][1].isAlive).toBe(false);

        // add two more neighbors (4 total)
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(2, 1);

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        expect(grid[1][1].isAlive).toBe(false);
      });
    });

    describe("Edge Cases", () => {
      it("happy: should handle cells on grid borders correctly", () => {
        // corner cell with two neighbors
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 0); // corner
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0);

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        expect(grid[0][0].isAlive).toBe(true);
      });

      it("happy: should handle stable patterns (still lifes)", () => {
        // create a block pattern
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(2, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(2, 2);

        // simulate multiple generations
        (game as unknown as { nextGeneration: () => void }).nextGeneration();
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        // block should remain stable
        expect(grid[1][1].isAlive).toBe(true); // center
        expect(grid[1][2].isAlive).toBe(true); // right
        expect(grid[2][1].isAlive).toBe(true); // bottom
        expect(grid[2][2].isAlive).toBe(true); // bottom-right
      });

      it("sad: should handle empty grid", () => {
        // no cells are alive
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        // grid should remain empty
        for (let row = 0; row < constants.GRID_ROWS; row++) {
          for (let col = 0; col < constants.GRID_COLS; col++) {
            expect(grid[row][col].isAlive).toBe(false);
          }
        }
      });

      it("sad: should handle all cells alive", () => {
        // set all cells alive
        for (let row = 0; row < constants.GRID_ROWS; row++) {
          for (let col = 0; col < constants.GRID_COLS; col++) {
            (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(row, col);
          }
        }

        // next generation - most cells should die due to overcrowding
        // corner cells have 3 neighbors (survive)
        // edge cells have 5 neighbors (die)
        // inner cells have 8 neighbors (die)
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        // verify corners survive (they have exactly 3 neighbors)
        expect(grid[0][0].isAlive).toBe(true);
        expect(grid[0][constants.GRID_COLS - 1].isAlive).toBe(true);
        expect(grid[constants.GRID_ROWS - 1][0].isAlive).toBe(true);
        expect(grid[constants.GRID_ROWS - 1][constants.GRID_COLS - 1].isAlive).toBe(true);

        // verify some non-corner cells die (they have more than 3 neighbors)
        expect(grid[0][1].isAlive).toBe(false); // edge cell (5 neighbors)
        expect(grid[1][1].isAlive).toBe(false); // inner cell (8 neighbors)
      });
    });
  });
});
