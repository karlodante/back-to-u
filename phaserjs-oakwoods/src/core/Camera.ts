import { Vector2 } from "../math/Vector2";
import { Entity } from "./Entity";

/**
 * Sistema de Cámara
 * Maneja el desplazamiento del canvas para seguir a un objetivo.
 */
export class Camera {
  public position: Vector2 = new Vector2();
  public target: Entity | null = null;
  public lerpSpeed: number = 0.1; // Suavizado
  public offset: Vector2 = new Vector2();
  
  private viewportWidth: number;
  private viewportHeight: number;

  constructor(width: number, height: number) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.offset = new Vector2(width / 2, height / 2);
  }

  setTarget(entity: Entity) {
    this.target = entity;
  }

  update(dt: number) {
    if (!this.target) return;

    // Calcular posición deseada (centro del target)
    const targetX = this.target.transform.position.x + this.target.width / 2;
    const targetY = this.target.transform.position.y + this.target.height / 2;

    // Aplicar interpolación lineal (Lerp) para suavizado
    this.position.x += (targetX - this.position.x) * this.lerpSpeed;
    this.position.y += (targetY - this.position.y) * this.lerpSpeed;
  }

  /**
   * Aplica la transformación de la cámara al contexto del canvas.
   */
  apply(ctx: CanvasRenderingContext2D) {
    ctx.save();
    // Centrar la cámara en el objetivo
    ctx.translate(this.offset.x - this.position.x, this.offset.y - this.position.y);
  }

  /**
   * Restaura el contexto del canvas.
   */
  restore(ctx: CanvasRenderingContext2D) {
    ctx.restore();
  }
}
