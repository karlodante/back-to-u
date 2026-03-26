import Phaser from "phaser";
import { MenuScene } from "./scenes/MenuScene";   // 1. Ahora el Menú es lo primero
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { PauseScene } from "./scenes/PauseScene"; // Mantengo esta para no romper el juego

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,             // Actualizado a CANVAS según tu nuevo código
  width: 1280,
  height: 720,
  parent: "game-container",
  backgroundColor: "#1a1a1a",
  pixelArt: true,
  roundPixels: true,               // Mejora la posición de los sprites pixel art
  scale: {
    mode: Phaser.Scale.FIT,        // Ajusta el juego al tamaño de la pantalla
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 900 },
      debug: false,
    },
  },
  // Orden de escenas corregido: MenuScene inicia el juego
  scene: [
    MenuScene, 
    BootScene, 
    GameScene, 
    PauseScene
  ],
};

new Phaser.Game(config);