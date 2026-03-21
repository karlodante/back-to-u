import { Entity } from "../core/Entity";
import { Scene } from "../core/Scene";

/**
 * Sistema de Spawn Dinámico
 * Maneja la creación periódica de entidades (enemigos, items).
 */
export class Spawner {
  private timer: number = 0;

  constructor(
    private scene: any,
    private factory: (x: number, y: number) => Entity,
    private spawnRate: number = 2.0, // segundos
    private maxEntities: number = 5
  ) {}

  update(dt: number, currentCount: number) {
    if (currentCount >= this.maxEntities) return;

    this.timer += dt;
    if (this.timer >= this.spawnRate) {
      this.timer = 0;
      this.spawn();
    }
  }

  private spawn() {
    // Generar posición aleatoria fuera de la vista o en puntos específicos
    const x = Math.random() * 800; // Placeholder
    const y = Math.random() * 600; // Placeholder
    const newEntity = this.factory(x, y);
    // Nota: La escena debe tener un método para añadir entidades dinámicamente
    if (this.scene.addEntity) {
      this.scene.addEntity(newEntity);
    }
  }
}
