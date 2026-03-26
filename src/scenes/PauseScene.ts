import Phaser from "phaser";

/**
 * Escena de Pausa
 * Permite pausar, reanudar, reiniciar o salir del juego
 */
export class PauseScene extends Phaser.Scene {
  private isPaused: boolean = false;
  private background!: Phaser.GameObjects.Graphics;
  private pauseText!: Phaser.GameObjects.Text;
  private resumeButton!: Phaser.GameObjects.Text;
  private restartButton!: Phaser.GameObjects.Text;
  private quitButton!: Phaser.GameObjects.Text;
  
  // Referencia a la escena del juego
  private gameScene: Phaser.Scene | undefined;

  constructor() {
    super("PauseScene");
  }

  create(): void {
    // Obtener referencia al GameScene
    this.gameScene = this.scene.get("GameScene");

    // Crear elementos de UI (inicialmente invisibles)
    this.createPauseUI();

    // Tecla ESC para reanudar
    this.input.keyboard.on("keydown-ESC", () => {
      if (this.isPaused) {
        this.resume();
      }
    });

    // Iniciar pausa automáticamente
    this.pause();
  }

  private createPauseUI(): void {
    const { width, height } = this.cameras.main;

    // Fondo semitrransparente
    this.background = this.add.graphics();
    this.background.fillStyle(0x000000, 0.7);
    this.background.fillRect(0, 0, width, height);
    this.background.setScrollFactor(0).setDepth(1000);
    this.background.setVisible(false);

    // Título de pausa
    this.pauseText = this.add.text(width / 2, height / 2 - 80, "PAUSED", {
      fontSize: "48px",
      fontFamily: "Arial Black",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    this.pauseText.setVisible(false);

    // Botón Resume
    this.resumeButton = this.add.text(width / 2, height / 2 - 20, "RESUME", {
      fontSize: "24px",
      fontFamily: "Arial",
      color: "#00ff00",
      backgroundColor: "#333333",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });
    this.resumeButton.setVisible(false);

    // Botón Restart
    this.restartButton = this.add.text(width / 2, height / 2 + 30, "RESTART", {
      fontSize: "24px",
      fontFamily: "Arial",
      color: "#ffff00",
      backgroundColor: "#333333",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });
    this.restartButton.setVisible(false);

    // Botón Quit
    this.quitButton = this.add.text(width / 2, height / 2 + 80, "QUIT", {
      fontSize: "24px",
      fontFamily: "Arial",
      color: "#ff0000",
      backgroundColor: "#333333",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });
    this.quitButton.setVisible(false);

    // Eventos de los botones
    this.setupButtonEvents();
  }

  private setupButtonEvents(): void {
    // Resume button
    this.resumeButton.on("pointerover", () => {
      this.resumeButton.setStyle({ color: "#7CFF00" });
    });
    this.resumeButton.on("pointerout", () => {
      this.resumeButton.setStyle({ color: "#00ff00" });
    });
    this.resumeButton.on("pointerdown", () => {
      this.resume();
    });

    // Restart button
    this.restartButton.on("pointerover", () => {
      this.restartButton.setStyle({ color: "#FFFF7C" });
    });
    this.restartButton.on("pointerout", () => {
      this.restartButton.setStyle({ color: "#ffff00" });
    });
    this.restartButton.on("pointerdown", () => {
      this.restart();
    });

    // Quit button
    this.quitButton.on("pointerover", () => {
      this.quitButton.setStyle({ color: "#FF7C7C" });
    });
    this.quitButton.on("pointerout", () => {
      this.quitButton.setStyle({ color: "#ff0000" });
    });
    this.quitButton.on("pointerdown", () => {
      this.quit();
    });
  }

  public pause(): void {
    if (this.isPaused) return;

    this.isPaused = true;
    
    // Pausar la escena del juego
    if (this.gameScene) {
      this.gameScene.physics.pause();
      this.gameScene.scene.pause();
    }

    // Mostrar UI de pausa
    this.background.setVisible(true);
    this.pauseText.setVisible(true);
    this.resumeButton.setVisible(true);
    this.restartButton.setVisible(true);
    this.quitButton.setVisible(true);
  }

  public resume(): void {
    if (!this.isPaused) return;

    this.isPaused = false;

    // Reanudar la escena del juego
    if (this.gameScene) {
      this.gameScene.physics.resume();
      this.gameScene.scene.resume();
    }

    // Ocultar UI de pausa
    this.background.setVisible(false);
    this.pauseText.setVisible(false);
    this.resumeButton.setVisible(false);
    this.restartButton.setVisible(false);
    this.quitButton.setVisible(false);

    // Cerrar la escena de pausa
    this.scene.stop("PauseScene");
  }

  private restart(): void {
    // Reanudar primero para asegurar que todo funcione
    this.resume();

    // Pequeña demora antes de reiniciar
    this.time.delayedCall(100, () => {
      if (this.gameScene) {
        this.gameScene.scene.restart();
      }
    });
  }

  private quit(): void {
    // Reanudar primero
    this.resume();

    // Ir a una escena de título (BootScene por ahora)
    this.time.delayedCall(100, () => {
      this.scene.start("BootScene");
    });
  }

  /**
   * Verifica si el juego está pausado
   */
  public getIsPaused(): boolean {
    return this.isPaused;
  }
}
