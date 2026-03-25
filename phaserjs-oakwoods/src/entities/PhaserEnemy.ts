import Phaser from "phaser";
import { StateMachine } from "../core/StateMachine";
import { EventBus } from "../core/EventBus";
import { Player } from "./Player";

export type EnemyKind = "melee" | "ranged" | "tank";

export interface EnemyConfig {
  kind: EnemyKind;
  color: number;
  size: number;
  hp: number;
  moveSpeed: number;
  chaseRange: number;
  attackRange: number;
  attackDamage: number;
  attackCooldownMs: number;
  attackWindowStartMs: number;
  attackWindowEndMs: number;

  rangedProjectileSpeed?: number;
  rangedProjectileDamage?: number;
  rangedProjectileLifetimeMs?: number;
}

const ENEMY_CONFIGS: Record<EnemyKind, EnemyConfig> = {
  melee: {
    kind: "melee",
    color: 0xff3b3b,
    size: 26,
    hp: 40,
    moveSpeed: 120, // Aumentado para mejor persecución
    chaseRange: 400, // Aumentado para detección temprana
    attackRange: 48,
    attackDamage: 9,
    attackCooldownMs: 650,
    attackWindowStartMs: 90,
    attackWindowEndMs: 180,
  },
  ranged: {
    kind: "ranged",
    color: 0x3ba3ff,
    size: 22,
    hp: 30,
    moveSpeed: 100, // Aumentado para mejor posicionamiento
    chaseRange: 500, // Mayor rango de detección
    attackRange: 250, // Mayor rango de ataque
    attackDamage: 0, // el daño lo hace el proyectil
    attackCooldownMs: 950,
    attackWindowStartMs: 110,
    attackWindowEndMs: 170,
    rangedProjectileSpeed: 250, // Aumentado
    rangedProjectileDamage: 7,
    rangedProjectileLifetimeMs: 1200, // Mayor duración
  },
  tank: {
    kind: "tank",
    color: 0x8f5bff,
    size: 30,
    hp: 85,
    moveSpeed: 80, // Aumentado para que no sea tan lento
    chaseRange: 350, // Mayor rango de detección
    attackRange: 55,
    attackDamage: 11,
    attackCooldownMs: 900,
    attackWindowStartMs: 120,
    attackWindowEndMs: 220,
  },
};

/**
 * Enemigo Phaser con FSM + cooldown real + ventana de ataque.
 * Importante: no depende de animaciones; usa timestamps para ser determinista.
 */
export class PhaserEnemy {
  public readonly id: string;
  public readonly kind: EnemyKind;
  public sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | Phaser.GameObjects.Rectangle;
  private readonly body: Phaser.Physics.Arcade.Body | null;
  
  // Tipo de enemigo para sprites
  private enemyType: 'alma' | 'sirviente';

  public hp: number;
  public maxHp: number;
  public xpReward: number = 12;

  private readonly scene: Phaser.Scene;
  private player: Player | null = null;

  private readonly fsm: StateMachine = new StateMachine();
  private patrolTarget: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

  private attackStartMs: number = 0;
  private lastAttackMs: number = -Infinity;
  private hitPlayerThisAttack: boolean = false;
  private shotThisAttack: boolean = false;

  private isDead: boolean = false;
  private destroyed: boolean = false;

  constructor(scene: Phaser.Scene, id: string, kind: EnemyKind, x: number, y: number) {
    this.scene = scene;
    this.id = id;
    this.kind = kind;

    const cfg = ENEMY_CONFIGS[kind];

    // Determinar tipo de enemigo según kind
    this.enemyType = 'alma'; // Default
    if (kind === 'melee' || kind === 'ranged') {
      this.enemyType = 'alma'; // Alma en pena para melee y ranged
    } else {
      this.enemyType = 'sirviente'; // Sirvientes para tank
    }

    console.log(`👾 DEBUG: Creando enemigo ${kind} como ${this.enemyType}`);

    // Crear sprite según tipo
    if (this.enemyType === 'alma') {
      // Alma en pena
      if (scene.textures.exists('alma_idle')) {
        this.sprite = scene.physics.add.sprite(x, y, 'alma_idle');
        this.sprite.setDisplaySize(cfg.size, cfg.size);
        this.sprite.setOrigin(0.5);
        console.log("🔧 DEBUG: Alma en pena creada con sprite");
      } else {
        console.log("⚠️ DEBUG: Alma sprites no encontrados, usando rectángulo");
        this.sprite = this.scene.add.rectangle(x, y, cfg.size, cfg.size, cfg.color, 0.95);
        this.scene.physics.add.existing(this.sprite);
      }
    } else {
      // Sirviente
      if (scene.textures.exists('sirviente_idle')) {
        this.sprite = scene.physics.add.sprite(x, y, 'sirviente_idle');
        this.sprite.setDisplaySize(cfg.size, cfg.size);
        this.sprite.setOrigin(0.5);
        console.log("🔧 DEBUG: Sirviente creado con sprite");
      } else {
        console.log("⚠️ DEBUG: Sirviente sprites no encontrados, usando rectángulo");
        this.sprite = this.scene.add.rectangle(x, y, cfg.size, cfg.size, cfg.color, 0.95);
        this.scene.physics.add.existing(this.sprite);
      }
    }
    
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(false); // nos movemos con setVelocity
    body.setDamping(true);
    body.setDrag(0.2, 0.2);
    body.setSize(cfg.size * 0.9, cfg.size * 0.9, true);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;

    this.hp = cfg.hp;
    this.maxHp = cfg.hp;

    this.buildFSM(cfg);
    this.pickPatrolTarget();
  }

  public setTarget(player: Player) {
    this.player = player;
  }

  private buildFSM(cfg: EnemyConfig): void {
    this.fsm.add({
      name: "idle",
      enter: () => {
        this.setVelocity(0, 0);
      },
      update: () => {
        if (!this.player) return;
        const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);
        if (dist < cfg.chaseRange) {
          this.fsm.change("chase");
          return;
        }
        // Patrol "soft": ocasionalmente empieza patrol
        if (this.scene.time.now % 1200 < 20) {
          this.fsm.change("patrol");
        }
      },
    });

    this.fsm.add({
      name: "patrol",
      enter: () => {
        this.pickPatrolTarget();
      },
      update: () => {
        if (!this.player) return;
        const distToPlayer = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);
        if (distToPlayer < cfg.chaseRange) {
          this.fsm.change("chase");
          return;
        }

        const dx = this.patrolTarget.x - this.sprite.x;
        const dy = this.patrolTarget.y - this.sprite.y;
        const dist = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
        const speed = cfg.moveSpeed * 0.6;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;

        this.setVelocity(vx, vy);

        if (dist < 10) {
          this.fsm.change("idle");
        }
      },
    });

    this.fsm.add({
      name: "chase",
      enter: () => {
        this.hitPlayerThisAttack = false;
        this.shotThisAttack = false;
      },
      update: () => {
        if (!this.player) return;
        const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);

        if (dist < cfg.attackRange) {
          this.fsm.change("attack");
          return;
        }
        if (dist > cfg.chaseRange * 1.5) { // Aumentado para mejor persecución
          this.fsm.change("patrol");
          return;
        }

        // Mejora: siempre perseguir activamente al jugador
        const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);
        const speed = this.kind === "tank" ? cfg.moveSpeed * 0.8 : cfg.moveSpeed; // Tanks un poco más lentos
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        this.setVelocity(vx, vy);
      },
    });

    this.fsm.add({
      name: "attack",
      enter: () => {
        this.setVelocity(0, 0);
        this.hitPlayerThisAttack = false;
        this.shotThisAttack = false;
        // no empezamos ataque inmediatamente: respetamos cooldown real
      },
      update: () => {
        if (!this.player) return;

        const now = this.scene.time.now;
        const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);

        // Si se salió del rango, vuelve a chase.
        if (dist > cfg.attackRange * 1.2) {
          this.fsm.change("chase");
          return;
        }

        // Cooldown real independiente de animación.
        if (now - this.lastAttackMs >= cfg.attackCooldownMs) {
          this.lastAttackMs = now;
          this.attackStartMs = now;
        }

        const inWindow = now >= this.attackStartMs + cfg.attackWindowStartMs && now <= this.attackStartMs + cfg.attackWindowEndMs;
        if (inWindow) {
          if (this.kind === "ranged") {
            if (!this.shotThisAttack) {
              this.shotThisAttack = true;
              this.shootProjectile();
            }
          } else {
            if (!this.hitPlayerThisAttack) {
              this.hitPlayerThisAttack = true;
              // Usar el método público pero con daño reducido para no bloquear tanto
              this.player.takeDamage(cfg.attackDamage * 0.5); // 50% del daño para no bloquear tanto
            }
          }
        }

        // Cuando termina la ventana, volvemos a chase (o idle para ranged si quieres).
        if (now > this.attackStartMs + cfg.attackWindowEndMs + 30) {
          this.fsm.change("chase");
        }
      },
    });

    this.fsm.change("idle");
  }

  private pickPatrolTarget(): void {
    // Patrol alrededor del enemigo, evitando salir demasiado lejos.
    const radius = 120;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const r = Phaser.Math.FloatBetween(60, radius);
    this.patrolTarget.set(this.sprite.x + Math.cos(angle) * r, this.sprite.y + Math.sin(angle) * r);
  }

  private setVelocity(vx: number, vy: number): void {
    if (!this.body) return;
    this.body.setVelocity(vx, vy);
  }

  private shootProjectile(): void {
    this.shootProjectileInternal();
  }

  // Phaser enemigo - lógica de disparo (para ranged) usando placeholders.
  private shootProjectileInternal(): void {
    if (!this.player) return;
    const cfg = ENEMY_CONFIGS[this.kind];
    if (cfg.kind !== "ranged") return;

    const projSpeed = cfg.rangedProjectileSpeed ?? 220;
    const projDamage = cfg.rangedProjectileDamage ?? 7;
    const lifetimeMs = cfg.rangedProjectileLifetimeMs ?? 900;

    const dx = this.player.x - this.sprite.x;
    const dy = this.player.y - this.sprite.y;
    const dist = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
    const vx = (dx / dist) * projSpeed;
    const vy = (dy / dist) * projSpeed;

    // Proyectil placeholder: rectángulo pequeño.
    const proj = this.scene.add.rectangle(this.sprite.x, this.sprite.y, 6, 3, 0xffffff, 1);
    this.scene.physics.add.existing(proj);
    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(false);
    body.setSize(6, 3, true);
    body.setVelocity(vx, vy);

    (proj as any).__projDamage = projDamage;
    (proj as any).__projHit = false;

    // Daño controlado por proyectil: solo 1 hit por proyectil.
    if (this.player) {
      this.scene.physics.add.overlap(
        proj,
        this.player,
        (_projObj: any, playerObj: any) => {
          const projAny = proj as any;
          if (projAny.__projHit) return;
          projAny.__projHit = true;

          const p = playerObj as Player;
          p.takeDamage(projDamage);
          EventBus.getInstance().emit("screen_shake", { intensity: 0.01, duration: 70 });

          if (proj.active) proj.destroy();
        }
      );
    }

    this.scene.time.delayedCall(lifetimeMs, () => {
      if (!proj.active) return;
      proj.destroy();
    });
  }

  public getStateName(): string {
    return this.fsm.getCurrentStateName();
  }

  public getIsDead(): boolean {
    return this.isDead;
  }

  public takeDamage(amount: number, attackerX: number, attackerY: number, knockbackForce: number): void {
    if (this.isDead || this.destroyed) return;

    this.hp = Math.max(0, this.hp - amount);

    // Shake al recibir daño del enemigo
    EventBus.getInstance().emit("screen_shake", { intensity: 0.02, duration: 90 });

    // Knockback básico: empujar hacia afuera del atacante.
    const dx = this.sprite.x - attackerX;
    const dy = this.sprite.y - attackerY;
    const dist = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
    const dirX = dx / dist;
    const dirY = dy / dist;
    this.setVelocity(dirX * knockbackForce, dirY * knockbackForce);

    if (this.hp <= 0) {
      this.die();
    }
  }

  private die(): void {
    if (this.isDead) return;
    this.isDead = true;

    const cfg = ENEMY_CONFIGS[this.kind];

    this.setVelocity(0, 0);
    // Aplicar efecto de muerte solo si es un rectángulo (fallback)
    if (this.sprite instanceof Phaser.GameObjects.Rectangle) {
      this.sprite.setFillStyle(0x000000, 0.5);
    } else {
      // Para sprite personalizado, usar tint o alpha
      this.sprite.setTint(0x000000);
      this.sprite.setAlpha(0.5);
    }

    // Separar "evento de muerte" de "destrucción": destruimos después de un pequeño tween.
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        if (this.destroyed) return;
        this.destroyed = true;
        this.sprite.destroy();
      },
    });

    // Emite XP solo una vez (una muerte real).
    EventBus.getInstance().emit("enemy_defeated", {
      enemyId: this.id,
      xp: this.xpReward,
    });
  }

  public update(): void {
    if (this.isDead) return;
    // `StateMachine` requiere dt; para este juego usamos un dt fijo aproximado.
    this.fsm.update(16.67 / 1000);

    // Mantener orientación para ranged: nada por ahora.
  }
}

