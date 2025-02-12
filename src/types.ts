import { CellAction } from "./constants";

export type Offset = [number, number];

export interface Cell {
  isAlive: boolean;
  sprite: Phaser.GameObjects.Rectangle;
}

export interface GameRule {
  when: {
    currentState: boolean;
    neighborCount: number;
  };
  then: boolean;
  reason: CellAction;
}
