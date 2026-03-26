import { EventBus } from "../core/EventBus";
import { Player } from "../entities/Player";
import { PhaserEnemy, EnemyKind } from "../entities/PhaserEnemy";

/**
 * Sistema de IA de Enemigos Centralizado
 * Maneja spawn, actualización y separación de enemigos
 */
export class EnemyAISystem {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: PhaserEnemy[] = [];
  private enemiesGroup: Phaser.Physics.Arcade.Group;
  private enemyBySprite: Map<Phaser.GameObjects.Rectangle, PhaserEnemy> = new Map();

  // Configuración de spawn
  private nextSpawnAtMs: number = 0;
  private spawnIntervalMs: number = 2500;
  private maxAliveEnemies: number = 10;
  private maxTotalEnemies: number = 60;
  private totalSpawned: number = 0;
  private gameStartMs: number = 0;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.enemiesGroup = scene.physics.add.group();
  }

  public getEnemiesGroup(): Phaser.Physics.Arcade.Group {
    return this.enemiesGroup;
  }

  public getEnemyMapping(): Map<Phaser.GameObjects.Rectangle, PhaserEnemy> {
    return this.enemyBySprite;
  }

  public getEnemies(): PhaserEnemy[] {
    return this.enemies;
  }

  /**
   * Inicializa el sistema de spawn
   */
  public initialize(): void {
    this.gameStartMs = this.scene.time.now;
    this.nextSpawnAtMs = this.gameStartMs + 1200;
    this.totalSpawned = 0;

    // Spawns iniciales
    this.spawnInitialEnemies();
  }

  /**
   * Crea los enemigos iniciales
   */
  private spawnInitialEnemies(): void {
    const initialCount = 3;
    // El suelo está en y=184, los enemigos deben estar encima del suelo
    const groundY = 184;
    const enemyY = groundY - 40; // Más arriba para mejor visibilidad y comportamiento

    for (let i = 0; i < initialCount; i++) {
      const roll = Math.random();
      const kind = roll < 0.55 ? "melee" : roll < 0.8 ? "ranged" : "tank";
      const sign = Math.random() < 0.5 ? -1 : 1;
      const x = Phaser.Math.Clamp(
        this.player.x + sign * Phaser.Math.Between(280, 620), 
        0, 
        this.scene.physics.world.bounds.width - 40
      );
      const y = enemyY;
      
      this.spawnEnemy(kind as EnemyKind, x, y);
    }
  }

  /**
   * Spawnea un nuevo enemigo
   */
  private spawnEnemy(kind: EnemyKind, x: number, y: number): void {
    const enemy = new PhaserEnemy(
      this.scene, 
      `enemy_${Date.now()}_${Math.floor(Math.random() * 1000)}`, 
      kind, 
      x, 
      y
    );
    enemy.setTarget(this.player);
    
    this.enemies.push(enemy);
    this.enemiesGroup.add(enemy.sprite);
    this.enemyBySprite.set(enemy.sprite, enemy);
    this.totalSpawned++;
  }

  /**
   * Actualiza todo el sistema de IA
   */
  public update(): void {
    // Limpiar enemigos muertos
    this.enemies = this.enemies.filter(enemy => enemy.sprite.active && !enemy.getIsDead());
    
    // Actualizar enemigos
    this.enemies.forEach(enemy => enemy.update());
    
    // Aplicar separación para evitar stacking
    this.applyEnemySeparation();
    
    // Spawn dinámico
    this.handleDynamicSpawning();
  }

  /**
   * Aplica separación entre enemigos para evitar que se amontonen
   */
  private applyEnemySeparation(): void {
    const separationRadius = 40;
    const separationStrength = 90;
    const maxEnemySpeed = 220;

    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i];
        const b = this.enemies[j];
        const dx = a.sprite.x - b.sprite.x;
        const dy = a.sprite.y - b.sprite.y;
        const distSq = dx * dx + dy * dy;
        const minDist = separationRadius;
        
        if (distSq <= 0) continue;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDist - dist) / minDist;

          const dirX = dx / dist;
          const dirY = dy / dist;

          const aBody = a.sprite.body as Phaser.Physics.Arcade.Body;
          const bBody = b.sprite.body as Phaser.Physics.Arcade.Body;

          const aNewVx = Phaser.Math.Clamp(
            aBody.velocity.x + dirX * overlap * separationStrength, 
            -maxEnemySpeed, 
            maxEnemySpeed
          );
          const aNewVy = Phaser.Math.Clamp(
            aBody.velocity.y + dirY * overlap * separationStrength, 
            -maxEnemySpeed, 
            maxEnemySpeed
          );
          const bNewVx = Phaser.Math.Clamp(
            bBody.velocity.x - dirX * overlap * separationStrength, 
            -maxEnemySpeed, 
            maxEnemySpeed
          );
          const bNewVy = Phaser.Math.Clamp(
            bBody.velocity.y - dirY * overlap * separationStrength, 
            -maxEnemySpeed, 
            maxEnemySpeed
          );

          aBody.setVelocity(aNewVx, aNewVy);
          bBody.setVelocity(bNewVx, bNewVy);
        }
      }
    }
  }

  /**
   * Maneja el spawn dinámico de enemigos
   */
  private handleDynamicSpawning(): void {
    const now = this.scene.time.now;
    
    if (
      now >= this.nextSpawnAtMs && 
      this.enemies.length < this.maxAliveEnemies && 
      this.totalSpawned < this.maxTotalEnemies
    ) {
      const roll = Math.random();
      const kind = roll < 0.55 ? "melee" : roll < 0.8 ? "ranged" : "tank";
      const sign = Math.random() < 0.5 ? -1 : 1;

      const minDist = 180;
      const worldMaxX = this.scene.physics.world.bounds.width;
      let x = this.player.x + sign * Phaser.Math.Between(300, 650);
      x = Phaser.Math.Clamp(x, 0, worldMaxX - 40);
      
      if (Math.abs(x - this.player.x) < minDist) {
        x = Phaser.Math.Clamp(this.player.x + sign * minDist, 0, worldMaxX - 40);
      }

      // El suelo está en y=184, los enemigos deben estar encima del suelo
      const groundY = 184;
      const enemyY = groundY - 40; // Más arriba para mejor visibilidad y comportamiento
      const y = enemyY;
      
      this.spawnEnemy(kind as EnemyKind, x, y);
      this.nextSpawnAtMs = now + this.spawnIntervalMs;
    }
  }

  /**
   * Obtiene estadísticas del sistema para debug
   */
  public getStats(): { alive: number; totalSpawned: number; maxAlive: number } {
    return {
      alive: this.enemies.length,
      totalSpawned: this.totalSpawned,
      maxAlive: this.maxAliveEnemies
    };
  }

  /**
   * Limpia todos los enemigos
   */
  public clear(): void {
    this.enemies.forEach(enemy => {
      if (enemy.sprite.active) {
        enemy.sprite.destroy();
      }
    });
    this.enemies = [];
    this.enemyBySprite.clear();
    this.totalSpawned = 0;
  }
}
