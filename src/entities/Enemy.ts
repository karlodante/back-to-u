import Phaser from "phaser";
import { StateMachine } from "../core/StateMachine";
import { Player } from "./Player";
import { EventBus } from "../core/EventBus";

export enum EnemyType {
  MELEE,
  RANGE,
  TANK
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private fsm: StateMachine = new StateMachine();
  private type: EnemyType;
  private health: number;
  private maxHealth: number;
  private speed: number;
  private chaseRange: number;
  private attackRange: number;
  private attackCooldown: number = 1500;
  private lastAttackTime: number = 0;
  private player: Player;
  private isDead: boolean = false;
  private patrolRange: number = 100;
  private startX: number;
  private separationRadius: number = 25;

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyType, player: Player) {
    // Usamos una textura blanca básica generada dinámicamente
    const size = type === EnemyType.TANK ? 40 : 30;
    const textureKey = `enemy_temp_${type}`;
    
    if (!scene.textures.exists(textureKey)) {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        const color = type === EnemyType.TANK ? 0x5555ff : (type === EnemyType.RANGE ? 0x55ff55 : 0xff5555);
        graphics.fillStyle(color, 1);
        graphics.fillRect(0, 0, size, size);
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.strokeRect(0, 0, size, size);
        graphics.generateTexture(textureKey, size, size);
    }

    super(scene, x, y, textureKey);
    
    this.type = type;
    this.player = player;
    this.startX = x;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body?.setSize(size, size);

    // Configurar estadísticas según tipo
    switch (type) {
      case EnemyType.MELEE:
        this.health = 50;
        this.speed = 80;
        this.chaseRange = 200;
        this.attackRange = 35;
        this.setTint(0xff5555);
        break;
      case EnemyType.RANGE:
        this.health = 30;
        this.speed = 60;
        this.chaseRange = 250;
        this.attackRange = 150;
        this.setTint(0x55ff55);
        break;
      case EnemyType.TANK:
        this.health = 150;
        this.speed = 40;
        this.chaseRange = 150;
        this.attackRange = 40;
        this.setScale(1.5);
        this.setTint(0x5555ff);
        break;
    }
    
    this.maxHealth = this.health;
    this.setupStateMachine();
  }

  private updateChase() {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y);
    
    if (dist <= this.attackRange) {
      this.fsm.change("attack");
      return;
    }

    if (dist > this.chaseRange * 1.5) {
      this.fsm.change("idle");
      return;
    }

    // Dirección hacia el jugador
    let moveX = (this.player.x > this.x) ? 1 : -1;
    
    // SISTEMA DE SEPARACIÓN (Anti-stacking)
    const enemies = (this.scene as any).enemies?.getChildren() as Enemy[];
    if (enemies) {
      enemies.forEach(other => {
        if (other === this || !other.active) return;
        
        const distToOther = Phaser.Math.Distance.Between(this.x, this.y, other.x, other.y);
        if (distToOther < this.separationRadius) {
          // Si estamos muy cerca de otro enemigo, empujamos en dirección opuesta
          const pushDir = (this.x > other.x) ? 1 : -1;
          moveX += pushDir * 0.5; // El peso de la separación
        }
      });
    }

    // Normalizar dirección y aplicar velocidad
    const finalDir = Math.sign(moveX);
    this.setVelocityX(this.speed * finalDir);
    if (finalDir !== 0) this.setFlipX(finalDir < 0);
  }

  private setupStateMachine() {
    this.fsm.add({
      name: "idle",
      enter: () => {
        this.setVelocityX(0);
        this.scene.time.delayedCall(1000, () => {
          if (this.fsm.getCurrentStateName() === "idle") this.fsm.change("patrol");
        });
      },
      update: () => {
        if (this.canSeePlayer()) this.fsm.change("chase");
      }
    });

    this.fsm.add({
      name: "patrol",
      update: () => {
        if (this.canSeePlayer()) {
          this.fsm.change("chase");
          return;
        }

        const distanceToStart = Math.abs(this.x - this.startX);
        if (distanceToStart > this.patrolRange) {
          this.startX = this.x; // Cambiar dirección
          this.fsm.change("idle");
        } else {
          const dir = (this.startX > this.x) ? 1 : -1;
          this.setVelocityX(this.speed * 0.5 * dir);
          this.setFlipX(dir < 0);
        }
      }
    });

    this.fsm.add({
      name: "chase",
      update: () => this.updateChase()
    });

    this.fsm.add({
      name: "attack",
      enter: () => {
        this.setVelocityX(0);
        this.executeAttack();
      },
      update: () => {
        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y);
        if (dist > this.attackRange * 1.2) {
          this.fsm.change("chase");
        }
      }
    });

    this.fsm.change("idle");
  }

  private canSeePlayer(): boolean {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y);
    return dist < this.chaseRange;
  }

  private executeAttack() {
    const now = Date.now();
    if (now - this.lastAttackTime < this.attackCooldown) return;
    this.lastAttackTime = now;

    // Lógica visual de ataque (placeholder)
    this.setTint(0xffffff);
    this.scene.time.delayedCall(200, () => {
      if (this.isDead) return;
      
      // Hitbox lógica de ataque
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y);
      if (dist <= this.attackRange + 10) {
        if (this.type === EnemyType.RANGE) {
          this.fireProjectile();
        } else {
          const kbDir = (this.player.x > this.x) ? 200 : -200;
          this.player.takeDamage(this.type === EnemyType.TANK ? 25 : 12, kbDir);
        }
      }
      
      this.setTint(this.type === EnemyType.TANK ? 0x5555ff : (this.type === EnemyType.RANGE ? 0x55ff55 : 0xff5555));
    });
  }

  private fireProjectile() {
    // Proyectil con física y daño modular
    const ball = this.scene.add.circle(this.x, this.y, 6, 0xffff00); // Amarillo para visibilidad
    this.scene.physics.add.existing(ball);
    
    const body = ball.body as Phaser.Physics.Arcade.Body;
    body.setCircle(6);
    body.setAllowGravity(false);

    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.player.x, this.player.y);
    const speed = 300; // Más rápido
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    // Efecto de partículas más brillante
    const particles = this.scene.add.particles(0, 0, 'oakwoods-particle', {
        speed: 20,
        scale: { start: 0.6, end: 0 },
        blendMode: 'ADD',
        tint: 0xffff00,
        follow: ball
    });

    this.scene.physics.add.overlap(ball, this.player, () => {
      this.player.takeDamage(20, (this.player.x > this.x ? 150 : -150)); // Más daño y knockback
      particles.destroy();
      ball.destroy();
    });

    // Destruir si sale del mundo o después de tiempo
    this.scene.time.delayedCall(3000, () => {
        if (ball.active) {
            particles.destroy();
            ball.destroy();
        }
    });
  }

  public takeDamage(amount: number, knockbackDir: number = 0) {
    if (this.isDead) return;
    
    this.health -= amount;
    
    // Knockback
    if (knockbackDir !== 0) {
      this.setVelocityX(knockbackDir * 200);
      this.setVelocityY(-100);
    }

    // Flash white
    const originalTint = this.tintTopLeft;
    this.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => this.setTint(originalTint));

    if (this.health <= 0) {
      this.die();
    }
  }

  private die() {
    this.isDead = true;
    this.fsm.change("idle");
    this.setVelocity(0, 0);
    this.setAlpha(0.5);
    this.setAngle(90); // Caer de lado
    
    this.scene.time.delayedCall(1000, () => {
      this.destroy();
      EventBus.getInstance().emit("enemy_died", 25); // XP
    });
  }

  update() {
    if (this.isDead) return;
    this.fsm.update(16.67 / 1000);
  }
}
