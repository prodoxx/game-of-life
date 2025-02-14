import { Scene } from "phaser";
import {
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  GRID_BORDER_COLOR,
  DEAD_COLOR,
  NEIGHBOR_OFFSETS,
  GAME_RULES,
  GENERATION_TICK_MS,
} from "../constants";
import { Cell } from "../types";
import { GameRoomMetadata, CellState } from "@game/shared";
import { socketService } from "../services/socketService";

export class Game extends Scene {
  private grid: Cell[][] = [];
  private generationTimer?: Phaser.Time.TimerEvent;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private gridContainer!: Phaser.GameObjects.Container;
  private roomMetadata?: GameRoomMetadata;
  private currentPlayerId: string | undefined = undefined;

  constructor() {
    super("Game");
  }

  init(data: { roomMetadata: GameRoomMetadata; currentPlayerId: string }) {
    this.roomMetadata = data.roomMetadata;
    this.currentPlayerId = data.currentPlayerId;
  }

  create() {
    this.gridContainer = this.add.container(0, 0);
    this.createGrid();
    this.setupInteraction();
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    // handle grid state updates from other players
    socketService.onGameStateUpdated((data) => {
      this.updateGridFromState(data.grid);
    });
  }

  private updateGridFromState(gridState: CellState[][]): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cellState = gridState[row][col];
        const cell = this.grid[row][col];
        cell.isAlive = cellState.isAlive;
        cell.ownerId = cellState.ownerId;
        cell.sprite.setFillStyle(cell.isAlive ? this.getPlayerColor(cell.ownerId!) : DEAD_COLOR);
      }
    }
  }

  private getGridState(): CellState[][] {
    return this.grid.map((row) =>
      row.map((cell) => ({
        isAlive: cell.isAlive,
        ownerId: cell.ownerId,
      }))
    );
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

  private getPlayerColor(playerId: string): number {
    const player = this.roomMetadata?.players.find((p) => p.id === playerId);
    if (!player) return DEAD_COLOR;

    const playerColor = player.color;
    // convert hex color to number
    return parseInt(playerColor.slice(1), 16);
  }

  private toggleCell(row: number, col: number): void {
    const cell = this.grid[row][col];
    cell.isAlive = !cell.isAlive;
    cell.ownerId = cell.isAlive ? this.currentPlayerId : undefined;
    cell.sprite.setFillStyle(cell.isAlive ? this.getPlayerColor(this.currentPlayerId!) : DEAD_COLOR);

    // emit grid update to other players
    if (this.roomMetadata) {
      socketService.updateGameState(this.roomMetadata.id, this.getGridState());
    }
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

  private applyCellRules(cell: Cell, neighbors: number): { willLive: boolean; newOwnerId?: string } {
    const matchingRule = GAME_RULES.find(
      (rule) => rule.when.currentState === cell.isAlive && rule.when.neighborCount === neighbors
    );

    const willLive = matchingRule?.then ?? false;

    // if the cell will live, determine ownership
    if (willLive) {
      if (cell.isAlive) {
        // surviving cell keeps its owner
        return { willLive, newOwnerId: cell.ownerId };
      } else {
        // reproducing cell - find majority (average) owner among live neighbors
        const neighborOwners = this.getAliveNeighborOwners(cell);
        return { willLive, newOwnerId: this.getMajorityOwner(neighborOwners) };
      }
    }

    return { willLive };
  }

  private getAliveNeighborOwners(cell: Cell): string[] {
    const owners: string[] = [];
    const row = this.grid.findIndex((r) => r.includes(cell));
    const col = this.grid[row].findIndex((c) => c === cell);

    for (const [_direction, [rowOffset, colOffset]] of NEIGHBOR_OFFSETS) {
      const neighborRow = row + rowOffset;
      const neighborCol = col + colOffset;

      const isWithinBounds = neighborRow >= 0 && neighborRow < GRID_ROWS && neighborCol >= 0 && neighborCol < GRID_COLS;

      if (isWithinBounds) {
        const neighbor = this.grid[neighborRow][neighborCol];
        if (neighbor.isAlive && neighbor.ownerId) {
          owners.push(neighbor.ownerId);
        }
      }
    }

    return owners;
  }

  private getMajorityOwner(owners: string[]): string {
    if (owners.length === 0) {
      if (!this.currentPlayerId) {
        throw new Error("Current player ID is required");
      }
      return this.currentPlayerId;
    }

    const ownerCounts = owners.reduce((acc, owner) => {
      acc[owner] = (acc[owner] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let maxOwner = owners[0];
    let maxCount = ownerCounts[maxOwner];

    for (const [owner, count] of Object.entries(ownerCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxOwner = owner;
      }
    }

    return maxOwner;
  }

  nextGeneration(): void {
    // create a copy of the current state
    const nextState: { isAlive: boolean; ownerId?: string }[][] = Array(GRID_ROWS)
      .fill(null)
      .map(() => Array(GRID_COLS).fill({ isAlive: false }));

    // apply rules to each cell
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const neighbors = this.countLiveNeighbors(row, col);
        const cell = this.grid[row][col];
        const { willLive, newOwnerId } = this.applyCellRules(cell, neighbors);
        nextState[row][col] = { isAlive: willLive, ownerId: willLive ? newOwnerId : undefined };
      }
    }

    // update the grid with new state
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = this.grid[row][col];
        const newState = nextState[row][col];
        cell.isAlive = newState.isAlive;
        cell.ownerId = newState.ownerId;
        cell.sprite.setFillStyle(cell.isAlive ? this.getPlayerColor(cell.ownerId!) : DEAD_COLOR);
      }
    }

    // emit grid update to other players
    if (this.roomMetadata) {
      socketService.updateGameState(this.roomMetadata.id, this.getGridState());
    }
  }
}
