import { vi } from "vitest";

export const mockConsole = {
  warn: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
};
