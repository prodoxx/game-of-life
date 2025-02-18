export type Offset = [number, number];

export interface Cell {
  isAlive: boolean;
  sprite: Phaser.GameObjects.Rectangle;
  ownerId?: string; // the player who owns this cell
  color?: string; // hex color string for cells with averaged colors
}
