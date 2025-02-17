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

  constructor(x: number, y: number, _width: number, _height: number, color: number) {
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
    const value = this.data.get(key);
    return value;
  }

  setFillStyle(color: number): this {
    this.fillStyle = color;
    return this;
  }

  getFillStyle(): number {
    return this.fillStyle;
  }

  setAlpha(_alpha: number): this {
    return this;
  }
}

// mock Phaser Input Event
export interface MockPointerEvent {
  x: number;
  y: number;
}

// mock Phaser.GameObjects.Container
export class MockContainer {
  x: number = 0;
  y: number = 0;
  scale: number = 1;
  children: any[] = [];

  constructor(_scene: any, x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setScale(scale: number): this {
    this.scale = scale;
    return this;
  }

  add(child: any): this {
    this.children.push(child);
    return this;
  }

  getWorldTransformMatrix() {
    return {
      invert: () => ({
        transformPoint: (x: number, y: number) => ({ x, y }),
      }),
    };
  }
}

// mock Phaser.Scene
const mockScene = class MockScene {
  add = {
    rectangle: vi
      .fn()
      .mockImplementation((x: number, y: number, width: number, height: number, color: number) => {
        return new MockRectangle(x, y, width, height, color);
      }),
    container: vi.fn().mockImplementation((x: number = 0, y: number = 0) => {
      return new MockContainer(this, x, y);
    }),
  };
  input = {
    on: vi.fn(),
  };
  scale = {
    width: 800,
    height: 600,
    on: vi.fn(),
  };
  cameras = {
    main: {
      width: 800,
      height: 600,
    },
  };
  time = {
    addEvent: vi
      .fn()
      .mockImplementation(
        (config: { delay: number; callback: () => void; callbackScope: any; loop: boolean }) => {
          const destroyFn = vi.fn();
          return {
            destroy: destroyFn,
            isDestroyed: false,
            ...config,
          };
        },
      ),
  };
};

export const mockPhaser = {
  Scene: mockScene,
  Math: {
    Clamp: (value: number, min: number, max: number): number => {
      return Math.min(Math.max(value, min), max);
    },
  },
};
