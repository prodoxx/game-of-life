import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Game } from "../Game";
import { Cell } from "../../types";
import * as constants from "../../constants";
import { MockRectangle, MockPointerEvent } from "./mocks/phaser";
import { PlayerStatus } from "@game/shared";
import { PATTERNS } from "../../patterns";

type Mock = ReturnType<typeof vi.fn>;

// helper function to safely cast Rectangle to MockRectangle
const asMockRectangle = (sprite: Phaser.GameObjects.Rectangle): MockRectangle =>
  sprite as unknown as MockRectangle;

// mock document for pattern tests
const mockDocument = {
  getElementById: vi.fn(),
};

describe("Game Scene", () => {
  let game: Game;
  let inputCallback: (pointer: MockPointerEvent, gameObject: MockRectangle) => void;
  let originalGridCols: number;
  let originalGridRows: number;
  let mockStatusElement: { textContent?: string };

  beforeEach(() => {
    vi.clearAllMocks();
    originalGridCols = constants.GRID_COLS;
    originalGridRows = constants.GRID_ROWS;

    // setup document mock
    mockStatusElement = {};
    vi.stubGlobal("document", {
      getElementById: vi.fn((id: string) => {
        if (id === "game-status") return mockStatusElement;
        if (id === "pattern-selection") {
          return {
            querySelectorAll: vi.fn().mockReturnValue([
              { getAttribute: () => "flower", addEventListener: vi.fn() },
              { getAttribute: () => "blinker", addEventListener: vi.fn() },
              { getAttribute: () => "glider", addEventListener: vi.fn() },
            ]),
          };
        }
        return null;
      }),
    });

    game = new Game();
    game.create();

    // capture the input callback for testing
    inputCallback = (game.input.on as unknown as Mock).mock.calls[0][1];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

      const lastCell = asMockRectangle(
        grid[constants.GRID_ROWS - 1][constants.GRID_COLS - 1].sprite,
      );
      expect(lastCell.x).toBe(
        (constants.GRID_COLS - 1) * constants.CELL_SIZE + constants.CELL_SIZE / 2,
      );
      expect(lastCell.y).toBe(
        (constants.GRID_ROWS - 1) * constants.CELL_SIZE + constants.CELL_SIZE / 2,
      );
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

      (
        game as unknown as { toggleCell: (row: number, col: number, forceAlive?: boolean) => void }
      ).toggleCell(0, 0);
      expect(cell.isAlive).toBe(true);

      (
        game as unknown as { toggleCell: (row: number, col: number, forceAlive?: boolean) => void }
      ).toggleCell(0, 0);
      expect(cell.isAlive).toBe(false);
    });

    it("happy: should handle force alive parameter", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      const cell = grid[0][0];

      // Force alive should make cell alive regardless of current state
      (
        game as unknown as { toggleCell: (row: number, col: number, forceAlive?: boolean) => void }
      ).toggleCell(0, 0, true);
      expect(cell.isAlive).toBe(true);

      (
        game as unknown as { toggleCell: (row: number, col: number, forceAlive?: boolean) => void }
      ).toggleCell(0, 0, true);
      expect(cell.isAlive).toBe(true);
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
      const cornerCell = asMockRectangle(
        grid[constants.GRID_ROWS - 1][constants.GRID_COLS - 1].sprite,
      );

      inputCallback({ x: 0, y: 0 }, cornerCell);
      expect(grid[constants.GRID_ROWS - 1][constants.GRID_COLS - 1].isAlive).toBe(true);
    });
  });

  describe("Game of Life Rules", () => {
    let grid: Cell[][];

    beforeEach(() => {
      grid = (game as unknown as { grid: Cell[][] }).grid;
      game["roomMetadata"] = {
        id: "test-room",
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        hasStarted: true,
        players: [
          {
            id: "player1",
            name: "Player 1",
            color: "#FF0000",
            status: PlayerStatus.Active,
            isHost: true,
            lastStatusChange: new Date().toISOString(),
          },
          {
            id: "player2",
            name: "Player 2",
            color: "#00FF00",
            status: PlayerStatus.Active,
            isHost: false,
            lastStatusChange: new Date().toISOString(),
          },
        ],
      };
    });

    describe("Core Rules", () => {
      it("happy: live cell with no neighbors should die", () => {
        game["currentPlayerId"] = "player1";
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1);
        (game as unknown as { nextGeneration: () => void }).nextGeneration();
        expect(grid[1][1].isAlive).toBe(false);
      });

      it("happy: live cell with two or three neighbors should survive", () => {
        game["currentPlayerId"] = "player1";
        // set up initial state
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1); // center
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2); // right
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(2, 1); // bottom

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();
        expect(grid[1][1].isAlive).toBe(true);
        expect(grid[1][1].color).toBe("#FF0000");
        expect(grid[1][1].ownerId).toBe("player1");
      });

      it("happy: dead cell with exactly three neighbors should become alive", () => {
        game["currentPlayerId"] = "player1";
        // set up initial state
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();
        expect(grid[1][1].isAlive).toBe(true);
      });
    });

    describe("Color Reproduction Rules", () => {
      it("happy: should calculate average color from different neighbors", () => {
        // set up two neighbors with different colors
        game["currentPlayerId"] = "player1";
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1); // red

        game["currentPlayerId"] = "player2";
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0); // green
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2); // green

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        // verify the new cell is alive with averaged color
        expect(grid[1][1].isAlive).toBe(true);
        expect(grid[1][1].color).toBe("#55AA00"); // Two-thirds of FF is AA for green component
      });

      it("happy: should handle same colored neighbors", () => {
        // set up three neighbors with the same color
        game["currentPlayerId"] = "player1";
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1); // red
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0); // red
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2); // red

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        // verify the new cell inherits the color and owner
        expect(grid[1][1].isAlive).toBe(true);
        expect(grid[1][1].color).toBe("#FF0000");
        expect(grid[1][1].ownerId).toBe("player1");
      });

      it("happy: should handle dead neighbors", () => {
        // set up two live neighbors and one dead
        game["currentPlayerId"] = "player1";
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1); // red
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0); // red

        // verify dead neighbor properties
        expect(grid[1][2].isAlive).toBe(false);
        expect(grid[1][2].color).toBeUndefined();
        expect(grid[1][2].ownerId).toBeUndefined();

        // simulate next generation
        (game as unknown as { nextGeneration: () => void }).nextGeneration();

        // verify target cell stays dead (needs exactly 3 neighbors)
        expect(grid[1][1].isAlive).toBe(false);
        expect(grid[1][1].color).toBeUndefined();
        expect(grid[1][1].ownerId).toBeUndefined();
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
            (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(
              row,
              col,
            );
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

  describe("Game Controls", () => {
    describe("Happy Paths", () => {
      it("happy: should update game status when starting generations", () => {
        game.startGenerations();
        expect(mockStatusElement.textContent).toBe("Running");
      });

      it("happy: should update game status when stopping generations", () => {
        game.startGenerations();
        game.stopGenerations();
        expect(mockStatusElement.textContent).toBe("Stopped");
      });

      it("happy: should update game status when pausing generations", () => {
        game.startGenerations();
        game.pauseGenerations();
        expect(mockStatusElement.textContent).toBe("Paused");
      });

      it("happy: should update game status when resuming generations", () => {
        game.startGenerations();
        game.pauseGenerations();
        game.resumeGenerations();
        expect(mockStatusElement.textContent).toBe("Running");
      });

      it("happy: should start generations when not running", () => {
        expect(game["isRunning"]).toBe(false);
        game.startGenerations();
        expect(game["isRunning"]).toBe(true);
        expect(game["generationTimer"]).toBeDefined();
      });

      it("happy: should not create multiple timers when starting generations multiple times", () => {
        game.startGenerations();
        const firstTimer = game["generationTimer"];
        const firstAddEventCall = (game.time.addEvent as Mock).mock.calls.length;

        game.startGenerations();
        const secondTimer = game["generationTimer"];
        const secondAddEventCall = (game.time.addEvent as Mock).mock.calls.length;

        expect(firstTimer).toBe(secondTimer);
        expect(secondAddEventCall).toBe(firstAddEventCall);
        expect(game["isRunning"]).toBe(true);
      });

      it("happy: should stop generations when running", () => {
        game.startGenerations();
        expect(game["isRunning"]).toBe(true);
        game.stopGenerations();
        expect(game["isRunning"]).toBe(false);
        expect(game["generationTimer"]).toBeUndefined();
      });

      it("happy: should toggle generations on when not running", () => {
        expect(game["isRunning"]).toBe(false);
        game.toggleGenerations();
        expect(game["isRunning"]).toBe(true);
        expect(game["generationTimer"]).toBeDefined();
      });

      it("happy: should toggle generations off when running", () => {
        game.startGenerations();
        expect(game["isRunning"]).toBe(true);
        game.toggleGenerations();
        expect(game["isRunning"]).toBe(false);
        expect(game["generationTimer"]).toBeUndefined();
      });

      it("happy: should use correct tick interval from constants", () => {
        game.startGenerations();
        expect(game["generationTimer"]?.delay).toBe(constants.GENERATION_TICK_MS);
      });

      it("happy: should pause generations when running", () => {
        game.startGenerations();
        expect(game["isRunning"]).toBe(true);
        expect(game["isPaused"]).toBe(false);

        game.pauseGenerations();
        expect(game["isRunning"]).toBe(true);
        expect(game["isPaused"]).toBe(true);
        expect(game["generationTimer"]?.paused).toBe(true);
      });

      it("happy: should resume generations when paused", () => {
        game.startGenerations();
        game.pauseGenerations();
        expect(game["isPaused"]).toBe(true);

        game.resumeGenerations();
        expect(game["isRunning"]).toBe(true);
        expect(game["isPaused"]).toBe(false);
        expect(game["generationTimer"]?.paused).toBe(false);
      });

      it("happy: should maintain game state while paused", () => {
        // set up initial state
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);

        game.startGenerations();
        game.pauseGenerations();

        const grid = (game as unknown as { grid: Cell[][] }).grid;
        expect(grid[1][1].isAlive).toBe(true);
        expect(grid[1][2].isAlive).toBe(true);
      });
    });

    describe("Sad Paths", () => {
      it("sad: should handle stopping generations when not running", () => {
        expect(game["isRunning"]).toBe(false);
        game.stopGenerations();
        expect(game["isRunning"]).toBe(false);
        expect(game["generationTimer"]).toBeUndefined();
      });

      it("sad: should handle timer destruction when timer is already destroyed", () => {
        game.startGenerations();
        const timer = game["generationTimer"];
        const destroyFn = timer?.destroy as Mock;

        // verify destroy was called
        destroyFn();
        expect(destroyFn).toHaveBeenCalled();

        game.stopGenerations();
        expect(game["isRunning"]).toBe(false);
        expect(game["generationTimer"]).toBeUndefined();
      });

      it("sad: should handle rapid start/stop toggling", () => {
        // verify initial state
        expect(game["isRunning"]).toBe(false);

        // toggle 10 times and verify each state change
        for (let i = 0; i < 10; i++) {
          game.toggleGenerations();
          // on odd iterations (1,3,5,7,9) should be running
          // on even iterations (2,4,6,8,10) should not be running
          const expectedState = (i + 1) % 2 === 1;
          expect(game["isRunning"]).toBe(expectedState);
          if (expectedState) {
            expect(game["generationTimer"]).toBeDefined();
          } else {
            expect(game["generationTimer"]).toBeUndefined();
          }
        }
      });

      it("sad: should handle undefined timer when stopping generations", () => {
        game.startGenerations();
        game["generationTimer"] = undefined;
        game.stopGenerations();
        expect(game["isRunning"]).toBe(false);
        expect(game["generationTimer"]).toBeUndefined();
      });

      it("sad: should not pause when not running", () => {
        game.pauseGenerations();
        expect(game["isRunning"]).toBe(false);
        expect(game["isPaused"]).toBe(false);
        expect(game["generationTimer"]).toBeUndefined();
      });

      it("sad: should not resume when not paused", () => {
        game.startGenerations();
        game.resumeGenerations();
        expect(game["isRunning"]).toBe(true);
        expect(game["isPaused"]).toBe(false);
      });

      it("sad: should handle pause/resume when timer is undefined", () => {
        game.startGenerations();
        game["generationTimer"] = undefined;

        game.pauseGenerations();
        expect(game["isPaused"]).toBe(false);

        game.resumeGenerations();
        expect(game["isPaused"]).toBe(false);
      });

      it("sad: should handle multiple pause/resume toggles", () => {
        game.startGenerations();

        for (let i = 0; i < 5; i++) {
          game.pauseGenerations();
          expect(game["isPaused"]).toBe(true);
          expect(game["generationTimer"]?.paused).toBe(true);

          game.resumeGenerations();
          expect(game["isPaused"]).toBe(false);
          expect(game["generationTimer"]?.paused).toBe(false);
        }
      });
    });
  });

  describe("Helper Functions", () => {
    beforeEach(() => {
      game["roomMetadata"] = {
        id: "test-room",
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        hasStarted: true,
        players: [
          {
            id: "player1",
            name: "Player 1",
            color: "#FF0000",
            status: PlayerStatus.Active,
            isHost: true,
            lastStatusChange: new Date().toISOString(),
          },
        ],
      };
    });

    describe("getPlayerColor", () => {
      it("happy: should return player's color as number", () => {
        const color = (game as any).getPlayerColor("player1");
        expect(color).toBe(parseInt("FF0000", 16));
      });

      it("sad: should return DEAD_COLOR for non-existent player", () => {
        const color = (game as any).getPlayerColor("nonexistent");
        expect(color).toBe(constants.DEAD_COLOR);
      });

      it("sad: should return DEAD_COLOR for undefined playerId", () => {
        const color = (game as any).getPlayerColor(undefined);
        expect(color).toBe(constants.DEAD_COLOR);
      });

      describe("Edge Cases", () => {
        describe("getPlayerColor", () => {
          it("sad: should handle undefined roomMetadata", () => {
            game["roomMetadata"] = undefined;
            const color = (game as any).getPlayerColor("player1");
            expect(color).toBe(constants.DEAD_COLOR);
          });

          it("sad: should handle empty players array", () => {
            game["roomMetadata"] = {
              id: "test-room",
              createdAt: new Date().toISOString(),
              lastActivity: new Date().toISOString(),
              hasStarted: true,
              players: [],
            };
            const color = (game as any).getPlayerColor("player1");
            expect(color).toBe(constants.DEAD_COLOR);
          });
        });
      });
    });

    describe("getAverageColor", () => {
      it("happy: should calculate average of multiple colors", () => {
        const result = (game as any).getAverageColor(["#FF0000", "#00FF00"]);
        expect(result.color).toBe("#7F7F00");
        expect(result.ownerId).toBeUndefined();
      });

      it("happy: should return exact color when all colors are the same", () => {
        const result = (game as any).getAverageColor(["#FF0000", "#FF0000"]);
        expect(result.color).toBe("#FF0000");
        expect(result.ownerId).toBe("player1");
      });
    });
  });

  describe("Pattern Management", () => {
    beforeEach(() => {
      // Setup document mock
      vi.stubGlobal("document", mockDocument);

      // Mock pattern selection element
      const mockPatternSelection = {
        querySelectorAll: vi.fn().mockReturnValue([
          { getAttribute: () => "flower", addEventListener: vi.fn() },
          { getAttribute: () => "blinker", addEventListener: vi.fn() },
          { getAttribute: () => "glider", addEventListener: vi.fn() },
        ]),
      };
      mockDocument.getElementById.mockReturnValue(mockPatternSelection);

      // Initialize game with room metadata and player ID
      game["roomMetadata"] = {
        id: "test-room",
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        hasStarted: true,
        players: [
          {
            id: "player1",
            name: "Player 1",
            color: "#FF0000",
            status: PlayerStatus.Active,
            isHost: true,
            lastStatusChange: new Date().toISOString(),
          },
        ],
      };
      game["currentPlayerId"] = "player1";
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("happy: should setup pattern selection listeners", () => {
      (game as any).setupPatternSelection();
      expect(mockDocument.getElementById).toHaveBeenCalledWith("pattern-selection");
    });

    it("happy: should place flower pattern within grid bounds", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      (game as any).placePatternRandomly(PATTERNS.flower);

      // Count alive cells that match the pattern
      let aliveCount = 0;
      for (let row = 0; row < constants.GRID_ROWS; row++) {
        for (let col = 0; col < constants.GRID_COLS; col++) {
          if (grid[row][col].isAlive) {
            aliveCount++;
          }
        }
      }
      expect(aliveCount).toBe(PATTERNS.flower.cells.length);
    });

    it("happy: should place blinker pattern within grid bounds", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      (game as any).placePatternRandomly(PATTERNS.blinker);

      // Count alive cells that match the pattern
      let aliveCount = 0;
      for (let row = 0; row < constants.GRID_ROWS; row++) {
        for (let col = 0; col < constants.GRID_COLS; col++) {
          if (grid[row][col].isAlive) {
            aliveCount++;
          }
        }
      }
      expect(aliveCount).toBe(PATTERNS.blinker.cells.length);
    });

    it("happy: should place glider pattern within grid bounds", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      (game as any).placePatternRandomly(PATTERNS.glider);

      // Count alive cells that match the pattern
      let aliveCount = 0;
      for (let row = 0; row < constants.GRID_ROWS; row++) {
        for (let col = 0; col < constants.GRID_COLS; col++) {
          if (grid[row][col].isAlive) {
            aliveCount++;
          }
        }
      }
      expect(aliveCount).toBe(PATTERNS.glider.cells.length);
    });

    it("happy: should override existing live cells when placing pattern", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;

      // First place a flower pattern
      (game as any).placePatternRandomly(PATTERNS.flower);
      const firstPatternCount = PATTERNS.flower.cells.length;

      // Then place a blinker pattern
      (game as any).placePatternRandomly(PATTERNS.blinker);

      // Count total alive cells
      let aliveCount = 0;
      for (let row = 0; row < constants.GRID_ROWS; row++) {
        for (let col = 0; col < constants.GRID_COLS; col++) {
          if (grid[row][col].isAlive) {
            aliveCount++;
          }
        }
      }

      // The alive count should be between blinker length and total of both patterns
      expect(aliveCount).toBeGreaterThanOrEqual(PATTERNS.blinker.cells.length);
      expect(aliveCount).toBeLessThanOrEqual(firstPatternCount + PATTERNS.blinker.cells.length);
    });

    it("sad: should handle invalid pattern selection", () => {
      const mockPatternSelection = {
        querySelectorAll: vi
          .fn()
          .mockReturnValue([{ getAttribute: () => "invalid-pattern", addEventListener: vi.fn() }]),
      };
      mockDocument.getElementById.mockReturnValue(mockPatternSelection);

      expect(() => {
        (game as any).setupPatternSelection();
      }).not.toThrow();
    });

    it("sad: should handle missing pattern selection element", () => {
      mockDocument.getElementById.mockReturnValue(null);
      expect(() => {
        (game as any).setupPatternSelection();
      }).not.toThrow();
    });
  });
});
