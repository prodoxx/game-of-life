export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

// calculate grid size to maintain square cells that fill the screen
export const CELL_SIZE = 32;
export const GRID_COLS = Math.floor(GAME_WIDTH / CELL_SIZE);
export const GRID_ROWS = Math.floor(GAME_HEIGHT / CELL_SIZE);

// colors
export const GRID_BORDER_COLOR = 0x999999; // gray
export const ALIVE_COLOR = 0x00ff00; // green
export const DEAD_COLOR = 0x000000; // black
export const BACKGROUND_COLOR = "#000000"; // black
