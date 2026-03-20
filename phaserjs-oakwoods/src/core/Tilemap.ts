import { Vector2 } from "../math/Vector2";
import { Entity } from "../core/Entity";

/**
 * Sistema de Tilemap
 * Permite renderizar y manejar colisiones basadas en una rejilla.
 */
export class Tilemap {
  private tileSize: number;
  private data: number[][];

  constructor(tileSize: number, data: number[][]) {
    this.tileSize = tileSize;
    this.data = data;
  }

  render(ctx: CanvasRenderingContext2D) {
    for (let y = 0; y < this.data.length; y++) {
      for (let x = 0; x < this.data[y].length; x++) {
        const tile = this.data[y][x];
        if (tile === 1) { // 1 = Pared/Sólido
          ctx.fillStyle = "#444";
          ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
          
          // Debug de rejilla
          ctx.strokeStyle = "#555";
          ctx.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        }
      }
    }
  }

  /**
   * Verifica colisión de una entidad con los tiles sólidos y devuelve la posición corregida.
   */
  resolveCollision(entity: Entity) {
    const t = entity.transform;
    const left = Math.floor(t.position.x / this.tileSize);
    const right = Math.floor((t.position.x + entity.width) / this.tileSize);
    const top = Math.floor(t.position.y / this.tileSize);
    const bottom = Math.floor((t.position.y + entity.height) / this.tileSize);

    t.isGrounded = false;

    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        if (this.data[y] && this.data[y][x] === 1) {
          const tileY = y * this.tileSize;
          
          // Si la entidad está cayendo y toca un tile por arriba
          if (t.velocity.y >= 0 && t.position.y + entity.height > tileY && t.position.y + entity.height < tileY + this.tileSize) {
            t.position.y = tileY - entity.height;
            t.velocity.y = 0;
            t.isGrounded = true;
            return;
          }
        }
      }
    }
  }
}
