// pattern definitions for game of life
export interface Pattern {
  name: string;
  cells: [number, number][]; // relative coordinates from pattern center
  width: number;
  height: number;
}

export const PATTERNS: Record<string, Pattern> = {
  flower: {
    name: "Flower",
    cells: [
      [-1, 0],
      [0, -1],
      [0, 1],
      [1, 0],
    ],
    width: 3,
    height: 3,
  },
  blinker: {
    name: "Blinker",
    cells: [
      [0, -1],
      [0, 0],
      [0, 1],
    ],
    width: 3,
    height: 1,
  },
  glider: {
    name: "Glider",
    cells: [
      [0, 1],
      [1, -1],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    width: 3,
    height: 3,
  },
};
