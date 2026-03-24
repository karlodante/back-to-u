import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { PauseScene } from "./scenes/PauseScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: 320,
  height: 180,
  parent: "game-container",
  backgroundColor: "#1a1a1a",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 900 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    GameScene,
    PauseScene
  ],
};

new Phaser.Game(config);
