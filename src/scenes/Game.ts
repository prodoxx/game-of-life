import { Scene } from "phaser";
import {
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  GRID_BORDER_COLOR,
  ALIVE_COLOR,
  DEAD_COLOR,
  NEIGHBOR_OFFSETS,
  GAME_RULES,
} from "../constants";
import { Cell } from "../types";

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

  private countLiveNeighbors(row: number, col: number): number {
    let count = 0;

    for (const [_direction, [rowOffset, colOffset]] of NEIGHBOR_OFFSETS) {
      const neighborRow = row + rowOffset;
      const neighborCol = col + colOffset;

      const isWithinBounds = neighborRow >= 0 && neighborRow < GRID_ROWS && neighborCol >= 0 && neighborCol < GRID_COLS;

      if (isWithinBounds && this.grid[neighborRow][neighborCol].isAlive) {
        count++;
      }
    }

    return count;
  }

  private applyCellRules(isAlive: boolean, neighbors: number): boolean {
    const matchingRule = GAME_RULES.find(
      (rule) => rule.when.currentState === isAlive && rule.when.neighborCount === neighbors
    );

    return matchingRule?.then ?? false;
  }

  nextGeneration(): void {
    // create a copy of the current state
    const nextState: boolean[][] = Array(GRID_ROWS)
      .fill(null)
      .map(() => Array(GRID_COLS).fill(false));

    // apply rules to each cell
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const neighbors = this.countLiveNeighbors(row, col);
        const cell = this.grid[row][col];
        nextState[row][col] = this.applyCellRules(cell.isAlive, neighbors);
      }
    }

    // update the grid with new state
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = this.grid[row][col];
        cell.isAlive = nextState[row][col];
        cell.sprite.setFillStyle(cell.isAlive ? ALIVE_COLOR : DEAD_COLOR);
      }
    }
  }
}
