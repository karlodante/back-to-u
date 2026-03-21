import { Entity } from "../core/Entity";
import { Vector2 } from "../math/Vector2";

/**
 * Sistema de Combate: maneja el daño y el retroceso (Knockback).
 */
export class CombatSystem {
  /**
   * Aplica daño a un objetivo y calcula el retroceso.
   */
  static dealDamage(attacker: Entity, target: any, amount: number, knockbackForce: number = 300) {
    if (target.takeDamage) {
      target.takeDamage(amount);
    }

    // Calcular dirección del retroceso
    const dir = new Vector2(
      target.transform.position.x - attacker.transform.position.x,
      target.transform.position.y - attacker.transform.position.y
    ).normalize();

    // Aplicar fuerza de retroceso instantánea (se manejará en el update del target)
    target.transform.velocity.x = dir.x * knockbackForce;
    target.transform.velocity.y = dir.y * knockbackForce;
  }

  /**
   * Aplica fricción a la velocidad para suavizar el retroceso.
   */
  static applyFriction(entity: Entity, dt: number, friction: number = 10) {
    entity.transform.velocity.x -= entity.transform.velocity.x * friction * dt;
    entity.transform.velocity.y -= entity.transform.velocity.y * friction * dt;

    // Detener por completo si la velocidad es muy baja
    if (Math.abs(entity.transform.velocity.x) < 1) entity.transform.velocity.x = 0;
    if (Math.abs(entity.transform.velocity.y) < 1) entity.transform.velocity.y = 0;
  }
}
