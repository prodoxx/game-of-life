import { vi } from "vitest";

export interface MockRectangleProps {
  x: number;
  y: number;
  fillStyle: number;
  strokeStyle: { width: number; color: number };
  data: Map<string, unknown>;
}

// mock Phaser.GameObjects.Rectangle
export class MockRectangle implements MockRectangleProps {
  x: number;
  y: number;
  fillStyle: number = 0;
  strokeStyle: { width: number; color: number } = { width: 0, color: 0 };
  data: Map<string, unknown> = new Map();

  constructor(x: number, y: number, width: number, height: number, color: number) {
    this.x = x;
    this.y = y;
    this.fillStyle = color;
  }

  setStrokeStyle(width: number, color: number): this {
    this.strokeStyle = { width, color };
    return this;
  }

  setOrigin(_value: number): this {
    return this;
  }

  setInteractive(): this {
    return this;
  }

  setData(key: string, value: unknown): this {
    this.data.set(key, value);
    return this;
  }

  getData(key: string): unknown {
    return this.data.get(key);
  }

  setFillStyle(color: number): this {
    this.fillStyle = color;
    return this;
  }

  getFillStyle(): number {
    return this.fillStyle;
  }
}

// mock Phaser Input Event
export interface MockPointerEvent {
  x: number;
  y: number;
}

// mock Phaser.Scene
const mockScene = class MockScene {
  add = {
    rectangle: vi.fn().mockImplementation((x: number, y: number, width: number, height: number, color: number) => {
      return new MockRectangle(x, y, width, height, color);
    }),
  };
  input = {
    on: vi.fn(),
  };
  cameras = {
    main: {
      width: 800,
      height: 600,
    },
  };
};

export const mockPhaser = {
  Scene: mockScene,
};
