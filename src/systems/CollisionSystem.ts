import { Entity } from "../core/Entity";

/**
 * Sistema de colisiones AABB (Axis-Aligned Bounding Box).
 */
export class CollisionSystem {
  /**
   * Verifica si dos entidades están colisionando.
   */
  static checkCollision(e1: Entity, e2: Entity): boolean {
    return (
      e1.transform.position.x < e2.transform.position.x + e2.width &&
      e1.transform.position.x + e1.width > e2.transform.position.x &&
      e1.transform.position.y < e2.transform.position.y + e2.height &&
      e1.transform.position.y + e1.height > e2.transform.position.y
    );
  }

  /**
   * Resuelve la colisión moviendo e1 fuera de e2 (muy básico).
   */
  static resolveCollision(e1: Entity, e2: Entity) {
    if (!this.checkCollision(e1, e2)) return;

    const overlapX = Math.min(
      e1.transform.position.x + e1.width - e2.transform.position.x,
      e2.transform.position.x + e2.width - e1.transform.position.x
    );

    const overlapY = Math.min(
      e1.transform.position.y + e1.height - e2.transform.position.y,
      e2.transform.position.y + e2.height - e1.transform.position.y
    );

    // Resolver en el eje de menor penetración
    if (overlapX < overlapY) {
      if (e1.transform.position.x < e2.transform.position.x) {
        e1.transform.position.x -= overlapX;
      } else {
        e1.transform.position.x += overlapX;
      }
    } else {
      if (e1.transform.position.y < e2.transform.position.y) {
        e1.transform.position.y -= overlapY;
      } else {
        e1.transform.position.y += overlapY;
      }
    }
  }
}
