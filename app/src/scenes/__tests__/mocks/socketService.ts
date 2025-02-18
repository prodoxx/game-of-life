import { vi } from "vitest";
import * as constants from "../../../constants";

export const mockSocketService = {
  updateGameStatus: vi.fn(),
  onGameStateUpdated: vi.fn((callback) => {
    // create a properly sized empty grid state
    const gridState = Array(constants.GRID_ROWS)
      .fill(null)
      .map(() =>
        Array(constants.GRID_COLS)
          .fill(null)
          .map(() => ({
            isAlive: false,
            ownerId: undefined,
            color: undefined,
          })),
      );
    callback({ grid: gridState, generation: 0, lastUpdated: new Date().toISOString() });
  }),
  onGameStatusUpdated: vi.fn((callback) => {
    callback({ status: "stopped" });
  }),
  onPlayerJoined: vi.fn(),
  onPlayerLeft: vi.fn(),
  onError: vi.fn(),
  onGameStarted: vi.fn(),
  updateGameState: vi.fn(),
  getPendingUpdates: vi.fn().mockReturnValue([]),
  connect: vi.fn(),
  disconnect: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
};
