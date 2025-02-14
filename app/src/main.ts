import "./style.css";
import "toastify-js/src/toastify.css";
import { Boot } from "./scenes/Boot";
import { Game as MainGame } from "./scenes/Game";
import { Preloader } from "./scenes/Preloader";
import { GAME_WIDTH, GAME_HEIGHT, BACKGROUND_COLOR } from "./constants";
import GameManager from "./gameManager";

import { Game, Types } from "phaser";

const config: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: BACKGROUND_COLOR,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [Boot, Preloader, MainGame],
};

const game = new Game(config);

const gameManager = new GameManager(game);

// handle window resizing
window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

export { game, gameManager };
