import { EventBus } from "../core/EventBus";
import { Player } from "../entities/Player";
import { PhaserEnemy } from "../entities/PhaserEnemy";

/**
 * Sistema de Combate Centralizado
 * Maneja toda la lógica de combate: detección de hits, daño, knockback
 */
export class CombatSystem {
  private scene: Phaser.Scene;
  private enemiesGroup: Phaser.Physics.Arcade.Group;
  private enemyBySprite: Map<Phaser.GameObjects.Rectangle, PhaserEnemy> = new Map();
  
  // Attack tracking para evitar multi-hit
  private lastAttackInstanceId: number = 0;
  private attackHitEnemyIds: Set<string> = new Set();

  constructor(scene: Phaser.Scene, enemiesGroup: Phaser.Physics.Arcade.Group) {
    this.scene = scene;
    this.enemiesGroup = enemiesGroup;
  }

  public setEnemyMapping(enemyBySprite: Map<Phaser.GameObjects.Rectangle, PhaserEnemy>): void {
    this.enemyBySprite = enemyBySprite;
  }

  /**
   * Configura la colisión entre jugador y enemigos
   */
  public setupPlayerEnemyCollision(player: Player): void {
    // Colisión para daño del jugador (enemigos melee tocan al jugador)
    this.scene.physics.add.overlap(player, this.enemiesGroup, (pObj, eObj) => {
      const p = pObj as Player;
      const rect = eObj as Phaser.GameObjects.Rectangle;
      const enemy = this.enemyBySprite.get(rect);
      
      if (!enemy) return;
      if (enemy.getIsDead()) return;

      // Si el jugador está en ventana de ataque, hacer daño al enemigo
      if (p.isAttackWindow()) {
        const instanceId = p.getAttackInstanceId();
        if (instanceId !== this.lastAttackInstanceId) {
          this.lastAttackInstanceId = instanceId;
          this.attackHitEnemyIds.clear();
        }

        if (this.attackHitEnemyIds.has(enemy.id)) return;
        this.attackHitEnemyIds.add(enemy.id);

        // Aplicar daño y knockback al enemigo
        const actualDamage = p.getCurrentAttackDamage();
        enemy.takeDamage(actualDamage, p.x, p.y, p.attackKnockback);
        
        // Feedback visual de daño
        this.showDamageText(rect.x, rect.y, actualDamage);
        
        // Screen shake
        EventBus.getInstance().emit("screen_shake", { intensity: 0.02, duration: 90 });
      }
      // Si no está atacando, el enemigo puede hacer daño al jugador (solo melee)
      else if (enemy.kind === "melee" || enemy.kind === "tank") {
        // El daño se maneja en la FSM del enemigo, pero aquí podemos añadir feedback adicional
        // Esto es solo para asegurar que haya contacto físico
      }
    });
  }

  /**
   * Muestra texto flotante de daño
   */
  private showDamageText(x: number, y: number, damage: number): void {
    const dmgText = this.scene.add.text(x, y - 35, `-${Math.ceil(damage)}`, {
      fontSize: "12px",
      color: "#ffffff",
      fontFamily: "Arial Black",
      stroke: "#000000",
      strokeThickness: 2,
    });
    dmgText.setDepth(200);
    
    this.scene.tweens.add({
      targets: dmgText,
      y: dmgText.y - 20,
      alpha: 0,
      duration: 450,
      onComplete: () => dmgText.destroy(),
    });
  }

  /**
   * Limpia los IDs de enemigos golpeados (llamar al iniciar nuevo ataque)
   */
  public clearHitTracking(): void {
    this.attackHitEnemyIds.clear();
  }
}
