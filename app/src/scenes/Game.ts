import { Scene } from "phaser";
import {
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  GRID_BORDER_COLOR,
  DEAD_COLOR,
  NEIGHBOR_OFFSETS,
  GENERATION_TICK_MS,
  GRID_WIDTH,
  GRID_HEIGHT,
  DEAD_CELL_OPACITY,
} from "../constants";
import { Cell } from "../types";
import { GameRoomMetadata, CellState } from "@game/shared";
import { socketService } from "../services/socketService";
import { PATTERNS, Pattern } from "../patterns";

export class Game extends Scene {
  private grid: Cell[][] = [];
  private generationTimer?: Phaser.Time.TimerEvent;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private gridContainer!: Phaser.GameObjects.Container;
  private roomMetadata?: GameRoomMetadata;
  private currentPlayerId: string | undefined = undefined;
  private generation: number = 0;

  constructor() {
    super("Game");
  }

  init(data: { roomMetadata: GameRoomMetadata; currentPlayerId: string }) {
    this.roomMetadata = data.roomMetadata;
    this.currentPlayerId = data.currentPlayerId;
    this.setupPatternSelection();
  }

  create() {
    // create grid container
    this.gridContainer = this.add.container(0, 0);
    const gridBackground = this.add.rectangle(0, 0, GRID_WIDTH, GRID_HEIGHT, 0x000000, 0.5);
    this.gridContainer.add(gridBackground);

    this.createGrid();
    this.setupInteraction();
    this.setupSocketHandlers();
    this.updateGameStatus();

    // update container position when game is resized
    this.scale.on("resize", () => {
      this.centerGridContainer();
    });

    this.centerGridContainer();
  }

  private centerGridContainer(): void {
    const offsetX = (this.scale.width - GRID_WIDTH) / 2;
    const offsetY = (this.scale.height - GRID_HEIGHT) / 2;
    this.gridContainer.setPosition(offsetX, offsetY);
  }

  private setupSocketHandlers(): void {
    // handle grid state updates from other players
    socketService.onGameStateUpdated((data) => {
      this.updateGridFromState(data.grid);
      this.updateGenerationCount(data.generation);
      this.updatePopulationCount();
    });

    // handle game status updates
    socketService.onGameStatusUpdated(({ status }) => {
      switch (status) {
        case "running":
          if (!this.isRunning) this.startGenerations();
          break;
        case "paused":
          if (this.isRunning && !this.isPaused) this.pauseGenerations();
          break;
        case "stopped":
          if (this.isRunning) this.stopGenerations();
          break;
      }
    });
  }

  private updateGenerationCount(generation: number): void {
    const generationElement = document.getElementById("generation-count");
    if (generationElement) {
      generationElement.textContent = generation.toString();
    }
  }

  private updatePopulationCount(): void {
    const populationElement = document.getElementById("population-count");
    if (!populationElement) return;

    let liveCount = 0;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this.grid[row][col].isAlive) {
          liveCount++;
        }
      }
    }
    populationElement.textContent = liveCount.toString();
  }

  private updateGridFromState(gridState: CellState[][]): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cellState = gridState[row][col];
        const cell = this.grid[row][col];
        cell.isAlive = cellState.isAlive;
        cell.ownerId = cellState.ownerId;
        cell.color = cellState.color;
        this.updateCellVisuals(cell);
      }
    }
  }

  private getGridState(): CellState[][] {
    return this.grid.map((row) =>
      row.map((cell) => ({
        isAlive: cell.isAlive,
        ownerId: cell.ownerId,
        color: cell.color,
      })),
    );
  }

  private setupGenerationKeyboardControls(): void {
    // only setup controls for host
    if (!this.isHost()) return;

    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    // prevent default browser behavior for game controls
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Escape" || e.code === "KeyR") {
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

    // r to reset
    keyboard.on("keydown-R", () => {
      this.resetGrid();
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
    const worldPoint = this.gridContainer
      .getWorldTransformMatrix()
      .invert()
      .transformPoint(pointer.x, pointer.y);

    // update scale
    this.gridContainer.setScale(newScale);

    // convert same pointer position back to world space after scale change
    const newWorldPoint = this.gridContainer
      .getWorldTransformMatrix()
      .invert()
      .transformPoint(pointer.x, pointer.y);

    // zoom towards pointer
    this.gridContainer.x += (newWorldPoint.x - worldPoint.x) * newScale;
    this.gridContainer.y += (newWorldPoint.y - worldPoint.y) * newScale;
  }

  private updateGameStatus(): void {
    const statusElement = document.getElementById("game-status");
    if (!statusElement) return;

    let status = "Stopped";
    if (this.isRunning) {
      status = this.isPaused ? "Paused" : "Running";
    }
    statusElement.textContent = status;
  }

  private isHost(): boolean {
    if (!this.roomMetadata || !this.currentPlayerId) return false;
    const currentPlayer = this.roomMetadata.players.find((p) => p.id === this.currentPlayerId);
    return currentPlayer?.isHost ?? false;
  }

  startGenerations(): void {
    if (!this.isHost()) return;

    // don't start if already running
    if (this.isRunning && !this.isPaused) return;

    // if paused, resume instead
    if (this.isRunning && this.isPaused) {
      this.resumeGenerations();
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.generationTimer = this.time.addEvent({
      delay: GENERATION_TICK_MS,
      callback: this.nextGeneration,
      callbackScope: this,
      loop: true,
    });
    this.updateGameStatus();

    // emit game status update
    if (this.roomMetadata) {
      socketService.updateGameStatus(this.roomMetadata.id, "running");
    }
  }

  stopGenerations(): void {
    if (!this.isHost()) return;

    if (this.isRunning || this.isPaused) {
      this.isRunning = false;
      this.isPaused = false;
      if (this.generationTimer) {
        this.generationTimer.destroy();
        this.generationTimer = undefined;
      }
      this.updateGameStatus();

      // emit game status update
      if (this.roomMetadata) {
        socketService.updateGameStatus(this.roomMetadata.id, "stopped");
      }
    }
  }

  pauseGenerations(): void {
    if (!this.isHost()) return;

    if (this.isRunning && !this.isPaused && this.generationTimer) {
      this.isPaused = true;
      this.generationTimer.paused = true;
      this.updateGameStatus();

      // emit game status update
      if (this.roomMetadata) {
        socketService.updateGameStatus(this.roomMetadata.id, "paused");
      }
    }
  }

  resumeGenerations(): void {
    if (!this.isHost()) return;

    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      if (this.generationTimer) {
        this.generationTimer.paused = false;
      }
      this.updateGameStatus();

      // emit game status update
      if (this.roomMetadata) {
        socketService.updateGameStatus(this.roomMetadata.id, "running");
      }
    }
  }

  toggleGenerations(): void {
    if (!this.isHost()) return;

    if (!this.isRunning) {
      this.startGenerations();
    } else if (this.isPaused) {
      this.resumeGenerations();
    } else {
      this.stopGenerations();
    }
  }

  private setupInteraction(): void {
    this.input.on(
      "gameobjectdown",
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Rectangle) => {
        const row = gameObject.getData("row");
        const col = gameObject.getData("col");
        this.toggleCell(row, col);
      },
    );

    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        // use a smaller zoom factor for slower zooming
        const zoomFactor = deltaY > 0 ? 0.98 : 1.02;
        this.handleZoom(zoomFactor, pointer);
      },
    );

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

        const cell = this.add.rectangle(
          x + CELL_SIZE / 2,
          y + CELL_SIZE / 2,
          CELL_SIZE - 1,
          CELL_SIZE - 1,
          DEAD_COLOR,
        );

        cell.setStrokeStyle(1, GRID_BORDER_COLOR);
        cell.setOrigin(0.5);
        cell.setInteractive();
        cell.setAlpha(DEAD_CELL_OPACITY);

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

  private updateCellVisuals(cell: Cell): void {
    if (cell.isAlive) {
      cell.sprite.setAlpha(1);
      if (cell.color) {
        cell.sprite.setFillStyle(parseInt(cell.color.slice(1), 16));
      } else if (cell.ownerId) {
        cell.sprite.setFillStyle(this.getPlayerColor(cell.ownerId));
      }
    } else {
      cell.sprite.setAlpha(DEAD_CELL_OPACITY);
      cell.sprite.setFillStyle(DEAD_COLOR);
    }
  }

  private getPlayerColor(playerId: string): number {
    const player = this.roomMetadata?.players.find((p) => p.id === playerId);
    if (!player) return DEAD_COLOR;

    const playerColor = player.color;
    // convert hex color to number, handle invalid colors by returning DEAD_COLOR
    const colorNum = parseInt(playerColor.slice(1), 16);
    return isNaN(colorNum) ? DEAD_COLOR : colorNum;
  }

  private getAverageColor(neighborColors: string[]): { color: string; ownerId?: string } {
    if (neighborColors.length === 0)
      return { color: `#${DEAD_COLOR.toString(16).padStart(6, "0").toUpperCase()}` };

    // convert hex to rgb components and calculate totals
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;

    for (const color of neighborColors) {
      if (color.startsWith("#") && color.length === 7) {
        totalR += parseInt(color.slice(1, 3), 16);
        totalG += parseInt(color.slice(3, 5), 16);
        totalB += parseInt(color.slice(5, 7), 16);
      }
    }

    // calculate average for each component
    const avgColor = {
      r: Math.floor(totalR / neighborColors.length),
      g: Math.floor(totalG / neighborColors.length),
      b: Math.floor(totalB / neighborColors.length),
    };

    // convert back to hex (ensuring uppercase)
    const hexColor =
      "#" +
      avgColor.r.toString(16).padStart(2, "0").toUpperCase() +
      avgColor.g.toString(16).padStart(2, "0").toUpperCase() +
      avgColor.b.toString(16).padStart(2, "0").toUpperCase();

    // find if this exact color belongs to any player
    const matchingPlayer = this.roomMetadata?.players.find(
      (p) => p.color.toUpperCase() === hexColor,
    );

    return {
      color: hexColor,
      ownerId: matchingPlayer?.id,
    };
  }

  private getAliveNeighborColors(cell: Cell): { colors: string[]; owners: string[] } {
    const colors: string[] = [];
    const owners: string[] = [];
    const row = this.grid.findIndex((r) => r.includes(cell));
    const col = this.grid[row].findIndex((c) => c === cell);

    for (const [, [rowOffset, colOffset]] of NEIGHBOR_OFFSETS) {
      const neighborRow = row + rowOffset;
      const neighborCol = col + colOffset;

      const isWithinBounds =
        neighborRow >= 0 && neighborRow < GRID_ROWS && neighborCol >= 0 && neighborCol < GRID_COLS;

      if (isWithinBounds) {
        const neighbor = this.grid[neighborRow][neighborCol];
        if (neighbor.isAlive && neighbor.ownerId) {
          const player = this.roomMetadata?.players.find((p) => p.id === neighbor.ownerId);
          if (player) {
            colors.push(player.color);
            owners.push(neighbor.ownerId);
          }
        }
      }
    }

    return { colors, owners };
  }

  private applyCellRules(
    cell: Cell,
    neighbors: number,
  ): { willLive: boolean; newOwnerId?: string; color?: string } {
    // a cell survives if it has 2 or 3 neighbors
    if (cell.isAlive && (neighbors === 2 || neighbors === 3)) {
      return { willLive: true, newOwnerId: cell.ownerId, color: cell.color };
    }

    // a dead cell becomes alive if it has exactly 3 neighbors
    if (!cell.isAlive && neighbors === 3) {
      const { colors } = this.getAliveNeighborColors(cell);
      const { color, ownerId } = this.getAverageColor(colors);
      return { willLive: true, newOwnerId: ownerId, color };
    }

    // in all other cases, the cell dies or stays dead
    return { willLive: false };
  }

  private toggleCell(row: number, col: number, forceAlive: boolean = false): void {
    const cell = this.grid[row][col];
    cell.isAlive = forceAlive || !cell.isAlive;

    if (cell.isAlive && this.currentPlayerId) {
      const player = this.roomMetadata?.players.find((p) => p.id === this.currentPlayerId);
      cell.ownerId = this.currentPlayerId;
      cell.color = player?.color;
      this.updateCellVisuals(cell);
    } else {
      cell.ownerId = undefined;
      cell.color = undefined;
      this.updateCellVisuals(cell);
    }

    // update population count
    this.updatePopulationCount();

    // emit grid update to other players without incrementing generation
    if (this.roomMetadata) {
      socketService.updateGameState(
        this.roomMetadata.id,
        this.getGridState(),
        false,
        this.generation,
      );
    }
  }

  private countLiveNeighbors(row: number, col: number): number {
    let count = 0;

    for (const [, [rowOffset, colOffset]] of NEIGHBOR_OFFSETS) {
      const neighborRow = row + rowOffset;
      const neighborCol = col + colOffset;

      const isWithinBounds =
        neighborRow >= 0 && neighborRow < GRID_ROWS && neighborCol >= 0 && neighborCol < GRID_COLS;

      if (isWithinBounds && this.grid[neighborRow][neighborCol].isAlive) {
        count++;
      }
    }

    return count;
  }

  nextGeneration(): void {
    if (this.isRunning && !this.isPaused) {
      this.generation++;
      this.updateGenerationCount(this.generation);
    }

    // create a copy of the current state
    const nextState: { isAlive: boolean; ownerId?: string; color?: string }[][] = Array(GRID_ROWS)
      .fill(null)
      .map(() => Array(GRID_COLS).fill({ isAlive: false }));

    // apply rules to each cell
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const neighbors = this.countLiveNeighbors(row, col);
        const cell = this.grid[row][col];
        const { willLive, newOwnerId, color } = this.applyCellRules(cell, neighbors);
        nextState[row][col] = {
          isAlive: willLive,
          ownerId: willLive ? newOwnerId : undefined,
          color,
        };
      }
    }

    // update the grid with new state
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = this.grid[row][col];
        const newState = nextState[row][col];
        cell.isAlive = newState.isAlive;
        cell.ownerId = newState.ownerId;
        cell.color = newState.color;
        this.updateCellVisuals(cell);
      }
    }

    // update population count
    this.updatePopulationCount();

    // emit grid update to other players
    if (this.roomMetadata) {
      socketService.updateGameState(
        this.roomMetadata.id,
        this.getGridState(),
        false,
        this.generation,
      );
    }
  }

  private setupPatternSelection(): void {
    const patternSelection = document.getElementById("pattern-selection");
    if (!patternSelection) return;

    const patternImages = patternSelection.querySelectorAll("img[data-pattern]");
    patternImages.forEach((img) => {
      img.addEventListener("click", () => {
        const patternName = img.getAttribute("data-pattern");
        if (patternName && PATTERNS[patternName]) {
          this.placePatternRandomly(PATTERNS[patternName]);
        }
      });
    });
  }

  private placePatternRandomly(pattern: Pattern): void {
    // calculate valid placement area considering pattern dimensions
    const validStartRow = Math.floor(pattern.height / 2);
    const validEndRow = GRID_ROWS - Math.ceil(pattern.height / 2);
    const validStartCol = Math.floor(pattern.width / 2);
    const validEndCol = GRID_COLS - Math.ceil(pattern.width / 2);

    // randomly select center position for pattern
    const centerRow = Math.floor(Math.random() * (validEndRow - validStartRow)) + validStartRow;
    const centerCol = Math.floor(Math.random() * (validEndCol - validStartCol)) + validStartCol;

    // create a copy of the current grid state
    const newGridState = this.grid.map((row) =>
      row.map((cell) => ({
        isAlive: cell.isAlive,
        ownerId: cell.ownerId,
        color: cell.color,
      })),
    );

    // update the grid state copy with pattern cells
    pattern.cells.forEach(([rowOffset, colOffset]) => {
      const row = centerRow + rowOffset;
      const col = centerCol + colOffset;

      // ensure we're within grid bounds
      if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
        newGridState[row][col] = {
          isAlive: true,
          ownerId: this.currentPlayerId,
          color: this.currentPlayerId
            ? this.roomMetadata?.players.find((p) => p.id === this.currentPlayerId)?.color
            : undefined,
        };
      }
    });

    // apply all updates to the actual grid at once
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const newState = newGridState[row][col];
        const cell = this.grid[row][col];
        cell.isAlive = newState.isAlive;
        cell.ownerId = newState.ownerId;
        cell.color = newState.color;
        this.updateCellVisuals(cell);
      }
    }

    // update population count once after all cells are placed
    this.updatePopulationCount();

    // emit a single grid update to other players
    if (this.roomMetadata) {
      socketService.updateGameState(
        this.roomMetadata.id,
        this.getGridState(),
        false,
        this.generation,
      );
    }
  }

  private resetGrid(): void {
    // stop generations if running
    this.stopGenerations();

    // reset all cells to dead state
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = this.grid[row][col];
        cell.isAlive = false;
        cell.ownerId = undefined;
        cell.color = undefined;
        cell.sprite.setFillStyle(DEAD_COLOR);
      }
    }

    // reset generation counter
    this.generation = 0;

    // update population count (this will set it to 0 since all cells are dead)
    this.updatePopulationCount();

    // reset generation count display
    this.updateGenerationCount(0);

    // emit grid update to other players with reset generation
    if (this.roomMetadata) {
      socketService.updateGameState(this.roomMetadata.id, this.getGridState(), true, 0);
    }
  }
}
