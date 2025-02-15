import { CellAction } from "./constants";

export type Offset = [number, number];

export interface Cell {
  isAlive: boolean;
  sprite: Phaser.GameObjects.Rectangle;
  ownerId?: string; // the player who owns this cell
  color?: string; // hex color string for cells with averaged colors
}

export interface GameRule {
  when: {
    currentState: boolean;
    neighborCount: number;
  };
  then: boolean;
  reason: CellAction;
}
