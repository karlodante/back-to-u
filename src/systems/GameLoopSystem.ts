import { EventBus } from "../core/EventBus";

/**
 * Sistema de Game Loop Centralizado
 * Maneja condiciones de victoria, derrota y reinicio
 */
export class GameLoopSystem {
  private scene: Phaser.Scene;
  private gameEnded: boolean = false;
  private gameStartMs: number = 0;
  private surviveDurationMs: number = 60000; // 60 segundos para ganar

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Inicializa el sistema de game loop
   */
  public initialize(): void {
    this.gameStartMs = this.scene.time.now;
    this.gameEnded = false;
  }

  /**
   * Actualiza el game loop y verifica condiciones
   */
  public update(): boolean {
    if (this.gameEnded) return true;

    const now = this.scene.time.now;
    const elapsedMs = now - this.gameStartMs;

    // Verificar condición de victoria
    if (elapsedMs >= this.surviveDurationMs) {
      this.gameEnded = true;
      this.showVictory();
      return true;
    }

    return false;
  }

  /**
   * Maneja la derrota del jugador
   */
  public handlePlayerDeath(): void {
    if (this.gameEnded) return;
    
    this.gameEnded = true;
    this.showGameOver();
  }

  /**
   * Muestra la pantalla de Game Over
   */
  private showGameOver(): void {
    const { width, height } = this.scene.cameras.main;

    // Fondo oscuro semi-transparente
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, width, height);
    bg.setScrollFactor(0).setDepth(1000);

    // Texto de Game Over
    this.scene.add.text(width / 2, height / 2 - 30, "GAME OVER", {
      fontSize: "32px",
      color: "#ff0000",
      fontFamily: "Arial Black",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

    // Botón Reintentar
    const retryBtn = this.scene.add.text(width / 2, height / 2 + 20, "REINTENTAR", {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });

    retryBtn.on("pointerover", () => retryBtn.setStyle({ color: "#ffff00" }));
    retryBtn.on("pointerout", () => retryBtn.setStyle({ color: "#ffffff" }));
    retryBtn.on("pointerdown", () => {
      this.restart();
    });

    // Botón Salir
    const exitBtn = this.scene.add.text(width / 2, height / 2 + 55, "SALIR", {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });

    exitBtn.on("pointerover", () => exitBtn.setStyle({ color: "#ff0000" }));
    exitBtn.on("pointerout", () => exitBtn.setStyle({ color: "#ffffff" }));
    exitBtn.on("pointerdown", () => {
      this.exitToMenu();
    });
  }

  /**
   * Muestra la pantalla de Victoria
   */
  private showVictory(): void {
    const { width, height } = this.scene.cameras.main;

    // Fondo oscuro semi-transparente
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, width, height);
    bg.setScrollFactor(0).setDepth(1000);

    // Texto de Victoria
    this.scene.add.text(width / 2, height / 2 - 30, "VICTORY", {
      fontSize: "32px",
      color: "#00ff66",
      fontFamily: "Arial Black",
      stroke: "#000000",
      strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

    // Botón Reintentar
    const retryBtn = this.scene.add.text(width / 2, height / 2 + 20, "REINTENTAR", {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });

    retryBtn.on("pointerover", () => retryBtn.setStyle({ color: "#7CFF00" }));
    retryBtn.on("pointerout", () => retryBtn.setStyle({ color: "#ffffff" }));
    retryBtn.on("pointerdown", () => {
      this.restart();
    });

    // Botón Salir
    const exitBtn = this.scene.add.text(width / 2, height / 2 + 55, "SALIR", {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });

    exitBtn.on("pointerover", () => exitBtn.setStyle({ color: "#ff0000" }));
    exitBtn.on("pointerout", () => exitBtn.setStyle({ color: "#ffffff" }));
    exitBtn.on("pointerdown", () => {
      this.exitToMenu();
    });
  }

  /**
   * Reinicia el juego actual
   */
  private restart(): void {
    this.scene.scene.restart();
  }

  /**
   * Sale al menú principal
   */
  private exitToMenu(): void {
    this.scene.scene.start("BootScene");
  }

  /**
   * Verifica si el juego ha terminado
   */
  public isGameEnded(): boolean {
    return this.gameEnded;
  }

  /**
   * Obtiene el tiempo restante para ganar
   */
  public getTimeRemaining(): number {
    if (this.gameEnded) return 0;
    
    const now = this.scene.time.now;
    const elapsedMs = now - this.gameStartMs;
    return Math.max(0, this.surviveDurationMs - elapsedMs);
  }

  /**
   * Obtiene el tiempo transcurrido en formato legible
   */
  public getElapsedTime(): string {
    const now = this.scene.time.now;
    const elapsedMs = now - this.gameStartMs;
    const seconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Obtiene el tiempo restante en formato legible
   */
  public getTimeRemainingFormatted(): string {
    const remainingMs = this.getTimeRemaining();
    const seconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
