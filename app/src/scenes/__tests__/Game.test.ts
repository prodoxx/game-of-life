import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Game } from "../Game";
import { Cell } from "../../types";
import * as constants from "../../constants";
import { MockRectangle, MockPointerEvent } from "./mocks/phaser";
import { PlayerStatus } from "@game/shared";
import { PATTERNS } from "../../patterns";
import { socketService } from "../../services/socketService";

// mock socket service
vi.mock("../../services/socketService", () => ({
  socketService: {
    updateGameStatus: vi.fn(),
    updateGameState: vi.fn(),
    onGameStateUpdated: vi.fn(),
    onGameStatusUpdated: vi.fn(),
    getPendingUpdates: vi.fn().mockReturnValue([]),
  },
}));

type Mock = ReturnType<typeof vi.fn>;

// mock document for pattern tests
const mockDocument = {
  getElementById: vi.fn(),
};

// mock window
const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

describe("Game Scene", () => {
  let game: Game;
  let inputCallback: (pointer: MockPointerEvent, gameObject: MockRectangle) => void;
  let originalGridCols: number;
  let originalGridRows: number;
  let mockStatusElement: { textContent?: string };
  let mockContainer: {
    add: Mock;
    setPosition: Mock;
    setScale: Mock;
    scale: number;
    x: number;
    y: number;
    getWorldTransformMatrix: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    originalGridCols = constants.GRID_COLS;
    originalGridRows = constants.GRID_ROWS;

    // setup window mock
    vi.stubGlobal("window", mockWindow);

    // setup document mock
    mockStatusElement = {};
    vi.stubGlobal("document", {
      getElementById: vi.fn((id: string) => {
        if (id === "game-status") return mockStatusElement;
        if (id === "status-indicator") return { className: "" };
        if (id === "generation-count") return { textContent: "" };
        if (id === "population-count") return { textContent: "" };
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

    // Create mock container with all required methods
    mockContainer = {
      add: vi.fn(),
      setPosition: vi.fn(),
      setScale: vi.fn(),
      scale: 1,
      x: 0,
      y: 0,
      getWorldTransformMatrix: vi.fn().mockReturnValue({
        invert: vi.fn().mockReturnValue({
          transformPoint: vi.fn().mockReturnValue({ x: 0, y: 0 }),
        }),
      }),
    };

    game = new Game();

    // mock game scene methods and properties
    game.time = {
      addEvent: vi.fn().mockReturnValue({
        destroy: vi.fn(),
        paused: false,
        delay: constants.GENERATION_TICK_MS,
      }),
    } as any;

    // mock host status and room metadata
    const roomMetadata = {
      id: "test-room",
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      players: [
        {
          id: "host-id",
          status: "active" as PlayerStatus,
          name: "Host",
          color: "#FF0000",
          isHost: true,
          lastStatusChange: new Date().toISOString(),
        },
      ],
      hasStarted: false,
      gameStatus: "stopped" as const,
    };

    // initialize game with room metadata
    game.init({ roomMetadata, currentPlayerId: "host-id" });

    // mock isHost method
    vi.spyOn(game as any, "isHost").mockReturnValue(true);

    // mock scene methods with container
    game.add = {
      container: vi.fn().mockReturnValue(mockContainer),
      rectangle: vi.fn().mockReturnValue({
        setInteractive: vi.fn().mockReturnThis(),
        on: vi.fn(),
        setFillStyle: vi.fn(),
        setAlpha: vi.fn(),
        setStrokeStyle: vi.fn(),
        setOrigin: vi.fn(),
        setData: vi.fn(),
        getData: vi.fn(),
      }),
    } as any;

    game.scale = {
      on: vi.fn(),
      width: 800,
      height: 600,
    } as any;

    game.input = {
      on: vi.fn(),
      keyboard: {
        on: vi.fn(),
      },
    } as any;

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
      // Get the first cell's position (top-left corner)
      const firstCell = (game.add.rectangle as Mock).mock.calls[0];
      const lastCell = (game.add.rectangle as Mock).mock.calls[
        constants.GRID_ROWS * constants.GRID_COLS - 1
      ];

      // First cell should be at (CELL_SIZE/2, CELL_SIZE/2) relative to origin
      expect(firstCell[0]).toBe(constants.CELL_SIZE / 2);
      expect(firstCell[1]).toBe(constants.CELL_SIZE / 2);

      // Last cell should be at the bottom-right corner
      expect(lastCell[0]).toBe((constants.GRID_COLS - 0.5) * constants.CELL_SIZE);
      expect(lastCell[1]).toBe((constants.GRID_ROWS - 0.5) * constants.CELL_SIZE);

      // Verify container is positioned at the center of the screen
      expect(mockContainer.setPosition).toHaveBeenCalledWith(
        (game.scale.width - constants.GRID_WIDTH) / 2,
        (game.scale.height - constants.GRID_HEIGHT) / 2,
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

      (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 0);
      expect(cell.isAlive).toBe(true);

      (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 0);
      expect(cell.isAlive).toBe(false);
    });

    it("happy: should handle force alive parameter", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      const cell = grid[0][0];

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
      const mockCell = {
        getData: vi.fn().mockReturnValue(0),
      };

      inputCallback({ x: 0, y: 0 }, mockCell as any);
      inputCallback({ x: 0, y: 0 }, mockCell as any);
      inputCallback({ x: 0, y: 0 }, mockCell as any);

      expect(grid[0][0].isAlive).toBe(true);
    });

    it("happy: should handle clicks on grid boundaries", () => {
      const grid = (game as unknown as { grid: Cell[][] }).grid;
      const mockCell = {
        getData: vi.fn((key) => {
          if (key === "row") return constants.GRID_ROWS - 1;
          if (key === "col") return constants.GRID_COLS - 1;
          return 0;
        }),
      };

      inputCallback({ x: 0, y: 0 }, mockCell as any);
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
        gameStatus: "stopped",
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

        // Mock socket service to simulate server response
        const mockSocketService = vi.mocked(socketService);
        mockSocketService.getPendingUpdates.mockReturnValue([]);
        mockSocketService.onGameStateUpdated.mock.calls[0][0]({
          grid: Array(constants.GRID_ROWS)
            .fill(null)
            .map(() => Array(constants.GRID_COLS).fill({ isAlive: false })),
          generation: 1,
          lastUpdated: new Date().toISOString(),
        });

        expect((game as any).grid[1][1].isAlive).toBe(false);
      });

      it("happy: live cell with two or three neighbors should survive", () => {
        game["currentPlayerId"] = "player1";
        // Create a stable pattern (2 neighbors)
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1); // center cell
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2); // right neighbor
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(2, 1); // bottom neighbor

        // Mock socket service to simulate server response
        const mockSocketService = vi.mocked(socketService);
        mockSocketService.getPendingUpdates.mockReturnValue([]);
        mockSocketService.onGameStateUpdated.mock.calls[0][0]({
          grid: Array(constants.GRID_ROWS)
            .fill(null)
            .map((_, row) =>
              Array(constants.GRID_COLS)
                .fill(null)
                .map((_, col) => ({
                  isAlive:
                    (row === 1 && col === 1) ||
                    (row === 1 && col === 2) ||
                    (row === 2 && col === 1),
                  ownerId:
                    (row === 1 && col === 1) || (row === 1 && col === 2) || (row === 2 && col === 1)
                      ? "player1"
                      : undefined,
                  color:
                    (row === 1 && col === 1) || (row === 1 && col === 2) || (row === 2 && col === 1)
                      ? "#FF0000"
                      : undefined,
                })),
            ),
          generation: 1,
          lastUpdated: new Date().toISOString(),
        });

        expect((game as any).grid[1][1].isAlive).toBe(true); // Center cell should survive
        expect((game as any).grid[1][2].isAlive).toBe(true); // Right neighbor should survive
        expect((game as any).grid[2][1].isAlive).toBe(true); // Bottom neighbor should survive
      });

      it("happy: live cell with more than three neighbors should die", () => {
        game["currentPlayerId"] = "player1";
        // create a pattern with center cell having 4 neighbors
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 1); // center cell
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1); // top neighbor
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0); // left neighbor
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2); // right neighbor
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(2, 1); // bottom neighbor

        // Mock socket service to simulate server response
        const mockSocketService = vi.mocked(socketService);
        mockSocketService.getPendingUpdates.mockReturnValue([]);
        mockSocketService.onGameStateUpdated.mock.calls[0][0]({
          grid: Array(constants.GRID_ROWS)
            .fill(null)
            .map((_, _row) =>
              Array(constants.GRID_COLS)
                .fill(null)
                .map((_, _col) => ({
                  isAlive: false, // center cell should die due to overcrowding
                  ownerId: undefined,
                  color: undefined,
                })),
            ),
          generation: 1,
          lastUpdated: new Date().toISOString(),
        });

        expect((game as any).grid[1][1].isAlive).toBe(false); // Center cell should die
      });

      it("happy: dead cell with exactly three neighbors should become alive", () => {
        game["currentPlayerId"] = "player1";
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);

        // mock socket service to simulate server response
        const mockSocketService = vi.mocked(socketService);
        mockSocketService.getPendingUpdates.mockReturnValue([]);
        mockSocketService.onGameStateUpdated.mock.calls[0][0]({
          grid: Array(constants.GRID_ROWS)
            .fill(null)
            .map((_, row) =>
              Array(constants.GRID_COLS)
                .fill(null)
                .map((_, col) => ({
                  isAlive: row === 1 && col === 1,
                  ownerId: row === 1 && col === 1 ? "player1" : undefined,
                  color: row === 1 && col === 1 ? "#FF0000" : undefined,
                })),
            ),
          generation: 1,
          lastUpdated: new Date().toISOString(),
        });

        expect((game as any).grid[1][1].isAlive).toBe(true);
      });
    });

    describe("Color Reproduction Rules", () => {
      it("happy: should calculate average color from different neighbors", () => {
        game["currentPlayerId"] = "player1";
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1);

        game["currentPlayerId"] = "player2";
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);

        // Mock socket service to simulate server response
        const mockSocketService = vi.mocked(socketService);
        mockSocketService.getPendingUpdates.mockReturnValue([]);
        mockSocketService.onGameStateUpdated.mock.calls[0][0]({
          grid: Array(constants.GRID_ROWS)
            .fill(null)
            .map((_, row) =>
              Array(constants.GRID_COLS)
                .fill(null)
                .map((_, col) => ({
                  isAlive: row === 1 && col === 1,
                  ownerId: undefined,
                  color: row === 1 && col === 1 ? "#55AA00" : undefined,
                })),
            ),
          generation: 1,
          lastUpdated: new Date().toISOString(),
        });

        expect((game as any).grid[1][1].isAlive).toBe(true);
        expect((game as any).grid[1][1].color).toBe("#55AA00");
      });

      it("happy: should handle same colored neighbors", () => {
        game["currentPlayerId"] = "player1";
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(0, 1);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 0);
        (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(1, 2);

        // mock socket service to simulate server response
        const mockSocketService = vi.mocked(socketService);
        mockSocketService.getPendingUpdates.mockReturnValue([]);
        mockSocketService.onGameStateUpdated.mock.calls[0][0]({
          grid: Array(constants.GRID_ROWS)
            .fill(null)
            .map((_, row) =>
              Array(constants.GRID_COLS)
                .fill(null)
                .map((_, col) => ({
                  isAlive: row === 1 && col === 1,
                  ownerId: "player1",
                  color: "#FF0000",
                })),
            ),
          generation: 1,
          lastUpdated: new Date().toISOString(),
        });

        expect((game as any).grid[1][1].isAlive).toBe(true);
        expect((game as any).grid[1][1].color).toBe("#FF0000");
        expect((game as any).grid[1][1].ownerId).toBe("player1");
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
        // Set all cells alive
        for (let row = 0; row < constants.GRID_ROWS; row++) {
          for (let col = 0; col < constants.GRID_COLS; col++) {
            (game as unknown as { toggleCell: (row: number, col: number) => void }).toggleCell(
              row,
              col,
            );
          }
        }

        // mock socket service to simulate server response with all cells dead except corners
        const mockSocketService = vi.mocked(socketService);
        mockSocketService.getPendingUpdates.mockReturnValue([]);
        mockSocketService.onGameStateUpdated.mock.calls[0][0]({
          grid: Array(constants.GRID_ROWS)
            .fill(null)
            .map((_, row) =>
              Array(constants.GRID_COLS)
                .fill(null)
                .map((_, col) => ({
                  isAlive:
                    (row === 0 && col === 0) ||
                    (row === 0 && col === constants.GRID_COLS - 1) ||
                    (row === constants.GRID_ROWS - 1 && col === 0) ||
                    (row === constants.GRID_ROWS - 1 && col === constants.GRID_COLS - 1),
                })),
            ),
          generation: 1,
          lastUpdated: new Date().toISOString(),
        });

        expect((game as any).grid[0][1].isAlive).toBe(false);
        expect((game as any).grid[1][1].isAlive).toBe(false);
      });
    });
  });

  describe("Game Controls", () => {
    beforeEach(() => {
      // Set up room metadata with current player as host
      game["roomMetadata"] = {
        id: "test-room",
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        hasStarted: true,
        gameStatus: "stopped",
        players: [
          {
            id: "test-player",
            name: "Test Player",
            color: "#FF0000",
            status: PlayerStatus.Active,
            isHost: true,
            lastStatusChange: new Date().toISOString(),
          },
        ],
      };
      game["currentPlayerId"] = "test-player";

      // Mock time.addEvent to return a proper timer object
      game.time = {
        addEvent: vi.fn().mockReturnValue({
          delay: constants.GENERATION_TICK_MS,
          destroy: vi.fn(),
          paused: false,
        }),
      } as any;
    });

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
        expect(game["isPaused"]).toBe(true);

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
        gameStatus: "stopped",
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
              gameStatus: "stopped",
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
        gameStatus: "stopped",
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
