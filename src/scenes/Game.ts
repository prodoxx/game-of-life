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
  GENERATION_TICK_MS,
} from "../constants";
import { Cell } from "../types";

export class Game extends Scene {
  private grid: Cell[][] = [];
  private generationTimer?: Phaser.Time.TimerEvent;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private gridContainer!: Phaser.GameObjects.Container;

  constructor() {
    super("Game");
  }

  create() {
    this.gridContainer = this.add.container(0, 0);
    this.createGrid();
    this.setupInteraction();
  }

  private setupGenerationKeyboardControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    // prevent default browser behavior for game controls
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Escape") {
        e.preventDefault();
      }
    });

    // space to play/pause
    keyboard.on("keydown-SPACE", () => {
      if (this.isRunning && this.isPaused) {
        this.resumeGenerations();
      } else if (this.isRunning && !this.isPaused) {
        this.pauseGenerations();
      } else {
        this.startGenerations();
      }
    });

    // esc to stop
    keyboard.on("keydown-ESC", () => {
      this.stopGenerations();
    });
  }

  // for convenience
  private handleZoom(scaleDelta: number, pointer: Phaser.Input.Pointer): void {
    // prevent zooming out beyond initial scale (1)
    if (scaleDelta < 1 && this.gridContainer.scale <= 1) {
      return;
    }

    const newScale = Phaser.Math.Clamp(this.gridContainer.scale * scaleDelta, 1, 1.8);

    // convert pointer position to world space before zoom
    const worldPoint = this.gridContainer.getWorldTransformMatrix().invert().transformPoint(pointer.x, pointer.y);

    // update scale
    this.gridContainer.setScale(newScale);

    // convert same pointer position back to world space after scale change
    const newWorldPoint = this.gridContainer.getWorldTransformMatrix().invert().transformPoint(pointer.x, pointer.y);

    // zoom towards pointer
    this.gridContainer.x += (newWorldPoint.x - worldPoint.x) * newScale;
    this.gridContainer.y += (newWorldPoint.y - worldPoint.y) * newScale;
  }

  startGenerations(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      this.isPaused = false;
      this.generationTimer = this.time.addEvent({
        delay: GENERATION_TICK_MS,
        callback: this.nextGeneration,
        callbackScope: this,
        loop: true,
      });
    }
  }

  stopGenerations(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.isPaused = false;
      this.generationTimer?.destroy();
      this.generationTimer = undefined;
    }
  }

  pauseGenerations(): void {
    if (this.isRunning && !this.isPaused && this.generationTimer) {
      this.isPaused = true;
      this.generationTimer.paused = true;
    }
  }

  resumeGenerations(): void {
    if (this.isRunning && this.isPaused && this.generationTimer) {
      this.isPaused = false;
      this.generationTimer.paused = false;
    }
  }

  toggleGenerations(): void {
    if (this.isRunning) {
      this.stopGenerations();
    } else {
      this.startGenerations();
    }
  }

  private setupInteraction(): void {
    this.input.on("gameobjectdown", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Rectangle) => {
      const row = gameObject.getData("row");
      const col = gameObject.getData("col");
      this.toggleCell(row, col);
    });

    this.input.on("wheel", (pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
      // use a smaller zoom factor for slower zooming
      const zoomFactor = deltaY > 0 ? 0.98 : 1.02;
      this.handleZoom(zoomFactor, pointer);
    });

    this.setupGenerationKeyboardControls();
  }

  private createGrid(): void {
    // validate grid dimensions
    if (GRID_ROWS <= 0 || GRID_COLS <= 0) {
      throw new Error("Grid dimensions must be positive numbers");
    }

    // calculate offsets to center the grid
    const totalGridWidth = GRID_COLS * CELL_SIZE;
    const totalGridHeight = GRID_ROWS * CELL_SIZE;
    const offsetX = (this.scale.width - totalGridWidth) / 2;
    const offsetY = (this.scale.height - totalGridHeight) / 2;

    // set initial container position to center
    this.gridContainer.setPosition(offsetX, offsetY);

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

        this.gridContainer.add(cell);

        this.grid[row][col] = {
          isAlive: false,
          sprite: cell,
        };
      }
    }
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
