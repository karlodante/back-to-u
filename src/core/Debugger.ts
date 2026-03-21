import { Entity } from "./Entity";

/**
 * Modo Debug
 * Herramientas visuales para depuración en tiempo real.
 */
export class Debugger {
  public static enabled: boolean = false;
  private static frameCount: number = 0;
  private static fps: number = 0;
  private static lastTime: number = performance.now();

  static toggle() {
    this.enabled = !this.enabled;
  }

  static update() {
    this.frameCount++;
    const currentTime = performance.now();
    if (currentTime - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = currentTime;
    }
  }

  static render(ctx: CanvasRenderingContext2D, entities: Entity[]) {
    if (!this.enabled) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset para UI fija

    // Dibujar FPS
    ctx.fillStyle = "yellow";
    ctx.font = "bold 14px monospace";
    ctx.fillText(`FPS: ${this.fps}`, ctx.canvas.width - 80, 20);

    // Dibujar hitboxes y estados
    ctx.restore(); // Volver a coordenadas de cámara si es necesario
    
    entities.forEach(e => {
      // Hitbox
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 1;
      ctx.strokeRect(e.transform.position.x, e.transform.position.y, e.width, e.height);

      // Info de entidad
      ctx.fillStyle = "white";
      ctx.font = "10px monospace";
      ctx.fillText(`ID: ${e.id}`, e.transform.position.x, e.transform.position.y - 15);
    });
  }
}
