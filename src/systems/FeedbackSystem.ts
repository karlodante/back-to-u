import { EventBus } from "../core/EventBus";

/**
 * Sistema de Feedback Visual Centralizado
 * Maneja screen shake, efectos visuales y audio (placeholder)
 */
export class FeedbackSystem {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupEventListeners();
  }

  /**
   * Configura los event listeners para feedback
   */
  private setupEventListeners(): void {
    const bus = EventBus.getInstance();
    bus.on("screen_shake", this.handleScreenShake.bind(this));

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off("screen_shake", this.handleScreenShake.bind(this));
    });
  }

  /**
   * Maneja el evento de screen shake
   */
  private handleScreenShake(data?: any): void {
    const intensity = typeof data?.intensity === "number" ? data.intensity : 0.02;
    const duration = typeof data?.duration === "number" ? data.duration : 120;
    
    this.scene.cameras.main.shake(duration, intensity);
  }

  /**
   * Emite screen shake con diferentes intensidades según el contexto
   */
  public static emitScreenShake(context: 'light' | 'medium' | 'heavy' | 'critical', customData?: any): void {
    const intensities = {
      light: 0.008,
      medium: 0.02,
      heavy: 0.04,
      critical: 0.08
    };

    const durations = {
      light: 70,
      medium: 120,
      heavy: 200,
      critical: 300
    };

    const data = {
      intensity: customData?.intensity ?? intensities[context],
      duration: customData?.duration ?? durations[context],
      ...customData
    };

    EventBus.getInstance().emit("screen_shake", data);
  }

  /**
   * Crea un efecto de impacto visual
   */
  public createImpactEffect(x: number, y: number, color: number = 0xffffff, size: number = 20): void {
    const impact = this.scene.add.circle(x, y, size, color, 0.8);
    impact.setDepth(200);

    this.scene.tweens.add({
      targets: impact,
      radius: size * 2,
      alpha: 0,
      duration: 200,
      onComplete: () => impact.destroy(),
    });
  }

  /**
   * Crea partículas simples (placeholder para sistema de partículas real)
   */
  public createParticles(x: number, y: number, count: number = 5, color: number = 0xffffff): void {
    for (let i = 0; i < count; i++) {
      const particle = this.scene.add.rectangle(
        x + Phaser.Math.Between(-10, 10),
        y + Phaser.Math.Between(-10, 10),
        3, 3, color, 1
      );
      particle.setDepth(201);

      const angle = (Math.PI * 2 * i) / count;
      const speed = Phaser.Math.Between(50, 150);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.scene.tweens.add({
        targets: particle,
        x: particle.x + vx * 0.3,
        y: particle.y + vy * 0.3,
        alpha: 0,
        duration: 300,
        onComplete: () => particle.destroy(),
      });
    }
  }

  /**
   * Crea un flash de pantalla
   */
  public createFlash(color: number = 0xffffff, intensity: number = 0.3, duration: number = 100): void {
    const flash = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      color,
      intensity
    );
    flash.setScrollFactor(0).setDepth(999);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: duration,
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Muestra un texto temporal en pantalla
   */
  public showTemporaryText(
    text: string, 
    x: number, 
    y: number, 
    options: {
      color?: string;
      fontSize?: string;
      duration?: number;
      offsetY?: number;
    } = {}
  ): void {
    const textObj = this.scene.add.text(x, y, text, {
      fontSize: options.fontSize ?? "14px",
      color: options.color ?? "#ffffff",
      fontFamily: "Arial Black",
      stroke: "#000000",
      strokeThickness: 2,
    });
    textObj.setDepth(250);

    this.scene.tweens.add({
      targets: textObj,
      y: y + (options.offsetY ?? -20),
      alpha: 0,
      duration: options.duration ?? 800,
      onComplete: () => textObj.destroy(),
    });
  }
}
