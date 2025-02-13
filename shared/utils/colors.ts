// predefined colors for players
export const playerColors = [
  "#FF0000", // red
  "#00FF00", // green
  "#0000FF", // blue
  "#FFA500", // orange
  "#800080", // purple
  "#FFD700", // gold
  "#00FFFF", // cyan
  "#FF69B4", // hot pink
];

export function getRandomUnusedColor(usedColors: string[]): string {
  const availableColors = playerColors.filter((color) => !usedColors.includes(color));
  if (availableColors.length === 0) {
    // if all colors are used, return a random one from the original list
    return playerColors[Math.floor(Math.random() * playerColors.length)];
  }
  return availableColors[Math.floor(Math.random() * availableColors.length)];
}
