import { Scene } from "phaser";
import { GRID_COLS, GRID_ROWS, CELL_SIZE, GRID_BORDER_COLOR, ALIVE_COLOR, DEAD_COLOR } from "../constants";

export interface Cell {
  isAlive: boolean;
  sprite: Phaser.GameObjects.Rectangle;
}

export class Game extends Scene {
  private grid: Cell[][] = [];

  constructor() {
    super("Game");
  }

  create() {
    this.createGrid();
    this.setupInteraction();
  }

  private createGrid(): void {
    // validate grid dimensions
    if (GRID_ROWS <= 0 || GRID_COLS <= 0) {
      throw new Error("Grid dimensions must be positive numbers");
    }

    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;

        const cell = this.add.rectangle(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE - 1, CELL_SIZE - 1, DEAD_COLOR);

        cell.setStrokeStyle(1, GRID_BORDER_COLOR);
        cell.setOrigin(0.5);
        cell.setInteractive();

        cell.setData("row", row);
        cell.setData("col", col);

        this.grid[row][col] = {
          isAlive: false,
          sprite: cell,
        };
      }
    }
  }

  private setupInteraction(): void {
    this.input.on("gameobjectdown", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Rectangle) => {
      const row = gameObject.getData("row");
      const col = gameObject.getData("col");
      this.toggleCell(row, col);
    });
  }

  private toggleCell(row: number, col: number): void {
    const cell = this.grid[row][col];
    cell.isAlive = !cell.isAlive;
    cell.sprite.setFillStyle(cell.isAlive ? ALIVE_COLOR : DEAD_COLOR);
  }
}
