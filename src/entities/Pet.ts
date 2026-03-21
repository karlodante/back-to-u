import Phaser from "phaser";
import { Player } from "./Player";
import { EventBus } from "../core/EventBus";
import { Enemy } from "./Enemy";

export class Pet extends Phaser.Physics.Arcade.Sprite {
  private player: Player;
  public xp: number = 0;
  public level: number = 1;
  public xpToNextLevel: number = 100;
  
  private followDistance: number = 50;
  private minDistance: number = 30; // Distancia para no atravesar al jugador
  private followLerp: number = 0.1; // Suavizado
  private isCombatMode: boolean = false;
  private combatCooldown: boolean = false;
  private combatDuration: number = 5000; // 5 segundos
  private combatCooldownTime: number = 10000; // 10 segundos
  
  private lastJumpTime: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
    super(scene, x, y, "oakwoods-pet-cat");
    this.player = player;
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    this.setTint(0xffaa00); // Color naranja para el gato
    this.setScale(0.8);
    this.setCollideWorldBounds(true);
    
    (this.body as Phaser.Physics.Arcade.Body).setDragX(500);
  }

  update() {
    if (this.isCombatMode) {
      this.updateCombatAI();
    } else {
      this.updateFollowAI();
    }
  }

  private updateFollowAI() {
    const targetX = this.player.x + (this.player.flipX ? 40 : -40); // Posición objetivo detrás del jugador
    const dist = Math.abs(this.x - targetX);
    
    // Lerp suave para el movimiento horizontal
    if (dist > this.minDistance) {
      this.x = Phaser.Math.Linear(this.x, targetX, this.followLerp);
      this.setFlipX(this.player.x < this.x);
    }

    // Saltar si el jugador salta y el gato está en el suelo
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.player.body?.velocity.y! < -100 && body.blocked.down && Date.now() - this.lastJumpTime > 500) {
      this.setVelocityY(-350);
      this.lastJumpTime = Date.now();
    }
  }

  private updateCombatAI() {
    // Buscar el enemigo más cercano
    const enemies = (this.scene as any).enemies?.getChildren() as Enemy[];
    if (!enemies || enemies.length === 0) {
      this.updateFollowAI();
      return;
    }

    let nearestEnemy: Enemy | null = null;
    let minDist = 300;

    enemies.forEach(e => {
      const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (d < minDist) {
        minDist = d;
        nearestEnemy = e;
      }
    });

    if (nearestEnemy) {
      const dir = (nearestEnemy.x > this.x) ? 1 : -1;
      this.setVelocityX(this.followSpeed * 1.5 * dir);
      this.setFlipX(dir < 0);

      // Ataque por contacto en modo combate
      if (minDist < 30) {
        nearestEnemy.takeDamage(10);
        this.setVelocityY(-100); // Pequeño rebote al atacar
      }
    } else {
      this.updateFollowAI();
    }
  }

  public addXP(amount: number) {
    this.xp += amount;
    EventBus.getInstance().emit("pet_xp_gain", { xp: this.xp, xpToNextLevel: this.xpToNextLevel });
    
    if (this.xp >= this.xpToNextLevel) {
      this.levelUp();
    }
  }

  private levelUp() {
    this.level++;
    this.xp -= this.xpToNextLevel;
    this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
    
    // Efecto visual de level up para el gato
    this.setTint(0xffffff);
    this.scene.time.delayedCall(500, () => this.setTint(0xffaa00));
    
    EventBus.getInstance().emit("pet_level_up", { level: this.level });
  }

  public activateCombatMode() {
    if (this.isCombatMode) {
      // Si ya está en modo combate, lo desactivamos manualmente
      this.deactivateCombatMode();
      return;
    }

    if (this.combatCooldown) return;

    this.isCombatMode = true;
    this.setTint(0xff0000); // Se pone rojo en modo combate
    this.setScale(1.2); // Crece un poco
    
    // Duración del modo combate (auto-desactivación)
    this.scene.time.delayedCall(this.combatDuration, () => {
      if (this.isCombatMode) {
        this.deactivateCombatMode();
      }
    });
  }

  private deactivateCombatMode() {
    this.isCombatMode = false;
    this.setTint(0xffaa00);
    this.setScale(0.8);
    this.combatCooldown = true;
    
    // Cooldown para volver a usarlo
    this.scene.time.delayedCall(this.combatCooldownTime, () => {
      this.combatCooldown = false;
    });
  }

  public transferXPToHealth(): number {
    if (this.xp <= 0) return 0;
    
    const xpToTransfer = Math.min(this.xp, 20); // Máximo 20 de XP por "abrazo"
    this.xp -= xpToTransfer;
    
    // Emitir evento para actualizar HUD
    EventBus.getInstance().emit("pet_xp_gain", { xp: this.xp, xpToNextLevel: this.xpToNextLevel });
    
    return xpToTransfer; // Retorna cuánta vida curar
  }
}
