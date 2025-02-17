import "./style.css";
import "toastify-js/src/toastify.css";
import { Boot } from "./scenes/Boot";
import { Game as MainGame } from "./scenes/Game";
import { Preloader } from "./scenes/Preloader";
import { GAME_WIDTH, GAME_HEIGHT } from "./constants";
import GameManager from "./gameManager";

import { Game, Types } from "phaser";

const config: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false,
  },
  powerPreference: "high-performance",
  transparent: true,
  clearBeforeRender: true,
  failIfMajorPerformanceCaveat: false,
  scene: [Boot, Preloader, MainGame],
};

// create game instance
const game = new Game(config);

// handle WebGL context loss and restoration
game.events.once("ready", () => {
  const canvas = game.canvas;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    console.warn("WebGL context lost. Attempting to restore...");
  });

  canvas.addEventListener("webglcontextrestored", () => {
    console.info("WebGL context restored.");
    game.scene.start("Boot");
  });
});

const gameManager = new GameManager(game);

// handle window resizing
window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

export { game, gameManager };
