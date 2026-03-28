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
    hp: 60, // Alma en Pena: 60 HP (12 golpes con 5 HP de daño)
    moveSpeed: 180, // AUMENTADO: 160 → 180 (ultra rápido)
    chaseRange: 600, // AUMENTADO: 500 → 600 (más detección)
    attackRange: 48,
    attackDamage: 15, // AUMENTADO: 12 → 15
    attackCooldownMs: 400, // REDUCIDO: 500 → 400 (ultra frenético)
    attackWindowStartMs: 90,
    attackWindowEndMs: 180,
  },
  ranged: {
    kind: "ranged",
    color: 0x3ba3ff,
    size: 22,
    hp: 60, // Alma en Pena: 60 HP (12 golpes con 5 HP de daño)
    moveSpeed: 160, // AUMENTADO: 140 → 160
    chaseRange: 700, // AUMENTADO: 600 → 700
    attackRange: 320, // AUMENTADO: 280 → 320
    attackDamage: 0, // el daño lo hace el proyectil
    attackCooldownMs: 500, // REDUCIDO: 600 → 500 (frenético)
    attackWindowStartMs: 110,
    attackWindowEndMs: 170,
    rangedProjectileSpeed: 350, // AUMENTADO: 320 → 350
    rangedProjectileDamage: 12, // REDUCIDO: 15 → 12 (balance)
    rangedProjectileLifetimeMs: 2000, // MANTENIDO
  },
  tank: {
    kind: "tank",
    color: 0x8f5bff,
    size: 30,
    hp: 200, // Sirviente Élite: 200 HP (40 golpes con 5 HP de daño - pelea largo aliento)
    moveSpeed: 150, // AUMENTADO: 130 → 150
    chaseRange: 600, // AUMENTADO: 500 → 600
    attackRange: 70, // MANTENIDO: 70
    attackDamage: 25, // AUMENTADO: 20 → 25
    attackCooldownMs: 500, // REDUCIDO: 600 → 500 (frenético)
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

  // Nuevas propiedades para iframe de daño
  private isInvulnerable: boolean = false;
  private invulnerableStartMs: number = 0;
  private invulnerableDurationMs: number = 200; // 200ms de iframe

  // Nuevas propiedades para IA élite del Sirviente
  private isElite: boolean = false;
  private dashCooldownMs: number = 0;
  private lastDashMs: number = -Infinity;
  private isDashing: boolean = false;
  private dashWarningTime: number = 500; // 0.5s de aviso
  private seismicCooldownMs: number = 0;
  private lastSeismicMs: number = -Infinity;
  private playerHits: number = 0; // Contador de golpes del jugador
  private lastPlayerHitTime: number = 0; // Tiempo del último golpe
  private backstepCooldownMs: number = 1500; // 1.5s para backstep

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
    } else if (kind === 'tank') {
      this.enemyType = 'sirviente'; // Sirvientes para tank - AHORA ÉLITE
      this.isElite = true; // Marcar como élite para IA especial
      this.dashCooldownMs = 600; // REDUCIDO FRENÉTICO: 1000 → 600ms (hiper rápido)
      this.seismicCooldownMs = 400; // REDUCIDO FRENÉTICO: 700 → 400ms (hiper rápido)
    }

    console.log(`👾 DEBUG: Creando enemigo ${kind} como ${this.enemyType}`);

    // Crear sprite según tipo
    if (this.enemyType === 'alma') {
      // Alma en pena - verificar si tenemos sprites de alma enojada
      if (scene.textures.exists('alma_angry_idle')) {
        this.sprite = scene.physics.add.sprite(x, y, 'alma_angry_idle', 0);
        this.sprite.setOrigin(0.5);
        this.sprite.setScale(1); // ESCALA NORMAL - no gigantes
        
        // CRÍTICO: Guardar referencia al enemigo en el sprite
        (this.sprite as any).enemyInstance = this;
        
        // Reproducir animación idle automáticamente
        if (!(this.sprite instanceof Phaser.GameObjects.Rectangle)) {
          // Verificar si la animación existe antes de reproducirla
          if (scene.anims.exists('alma_angry_idle_anim')) {
            (this.sprite as Phaser.GameObjects.Sprite).play('alma_angry_idle_anim', true);
            console.log("🔧 DEBUG: Alma enojada creada con animación idle");
          } else {
            console.log("⚠️ DEBUG: Animación alma_angry_idle_anim no existe, usando sprite estático");
          }
        }
        console.log("🔧 DEBUG: Alma enojada creada con escala 1 (tamaño regular)");
      } else if (scene.textures.exists('alma_idle')) {
        // Fallback a alma normal
        this.sprite = scene.physics.add.sprite(x, y, 'alma_idle', 0);
        this.sprite.setOrigin(0.5);
        this.sprite.setScale(1); // ESCALA NORMAL
        
        // CRÍTICO: Guardar referencia al enemigo en el sprite
        (this.sprite as any).enemyInstance = this;
        
        // Reproducir animación idle normal
        if (!(this.sprite instanceof Phaser.GameObjects.Rectangle)) {
          if (scene.anims.exists('alma_idle_anim')) {
            (this.sprite as Phaser.GameObjects.Sprite).play('alma_idle_anim', true);
            console.log("🔧 DEBUG: Alma normal creada con animación idle");
          } else {
            console.log("⚠️ DEBUG: Animación alma_idle_anim no existe, usando sprite estático");
          }
        }
        console.log("🔧 DEBUG: Alma normal creada con escala 1 (tamaño regular)");
      } else {
        console.log("⚠️ DEBUG: Alma sprites no encontrados, usando rectángulo");
        this.sprite = this.scene.add.rectangle(x, y, cfg.size, cfg.size, cfg.color, 0.95);
        this.scene.physics.add.existing(this.sprite);
        // CRÍTICO: Guardar referencia al enemigo en el sprite
        (this.sprite as any).enemyInstance = this;
      }
    } else {
      // Sirviente Pirichucho - ÉLITE
      if (scene.textures.exists('sirviente_aleteo')) {
        this.sprite = scene.physics.add.sprite(x, y, 'sirviente_aleteo', 0);
        this.sprite.setOrigin(0.5, 1); // Origen en base para que camine sobre suelo
        this.sprite.setScale(1); // ESCALA NORMAL - sin recortes
        
        // CRÍTICO: Tinte rojo para identificar como élite
        this.sprite.setTint(0xff9999); // Tinte rojo claro
        
        // CRÍTICO: Guardar referencia al enemigo en el sprite
        (this.sprite as any).enemyInstance = this;
        
        // Reproducir animación de aleteo automáticamente
        if (!(this.sprite instanceof Phaser.GameObjects.Rectangle)) {
          // Verificar si la animación existe antes de reproducirla
          if (scene.anims.exists('sirviente_walk')) {
            (this.sprite as Phaser.GameObjects.Sprite).play('sirviente_walk', true);
            console.log("🔧 DEBUG: Sirviente Pirichucho creado con animación walk");
          } else {
            console.log("⚠️ DEBUG: Animación sirviente_walk no existe, usando sprite estático");
          }
        }
        console.log("🔧 DEBUG: Sirviente Pirichucho creado con escala 1 (tamaño regular)");
      } else {
        console.log("⚠️ DEBUG: Sirviente sprites no encontrados, usando rectángulo");
        this.sprite = this.scene.add.rectangle(x, y, cfg.size, cfg.size, cfg.color, 0.95);
        this.scene.physics.add.existing(this.sprite);
        // CRÍTICO: Guardar referencia al enemigo en el sprite
        (this.sprite as any).enemyInstance = this;
      }
    }
    
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    
    // SIRVIENTE: Configurar hitbox preciso de 48x48
    if (this.enemyType === 'sirviente') {
      body.setSize(48, 48); // Hitbox preciso al cuerpo 48x48
      body.setOffset(0, 0); // Sin offset para alineación perfecta
      body.setAllowGravity(true); // Sirviente camina en suelo
      body.setBounce(0); // Sin rebote
      console.log("🔧 DEBUG: Sirviente configurado con hitbox 48x48 y gravedad");
    }
    // ALMAS: Configurar para que floten pero no atraviesen suelo
    else if (this.enemyType === 'alma') {
      body.setAllowGravity(false); // Almas flotan
      body.setVelocityY(0); // Movimiento vertical controlado
      body.setBounce(0); // Sin rebote
      console.log("� DEBUG: Alma configurada para flotar sin gravedad");
      console.log("⚔️ DEBUG: Enemigo configurado con gravedad");
    }
    
    body.setImmovable(false); // nos movemos con setVelocity
    body.setDamping(true);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;

    this.maxHp = cfg.hp;
    this.hp = cfg.hp;
    
    // FORZAR HP para verificación SOLO en Sirviente
    if (this.enemyType === 'sirviente') {
      this.maxHp = 200; // Sirviente Élite
      this.hp = 200;
      console.log("🔥 DEBUG: HP FORZADO a 200/200 para verificación SIRVIENTE");
    }

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
        this.isDashing = false; // Resetear estado de dash
      },
      update: () => {
        if (!this.player) return;
        const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);

        // IA ÉLITE: Movimiento inteligente y agresivo
        if (this.isElite) {
          const now = this.scene.time.now;
          
          // LECTURA DE INPUT: Si el jugador salta, 50% probabilidad de disparar hacia arriba
          if (this.player && Math.abs(this.player.y - this.sprite.y) > 50 && Math.random() < 0.5) {
            console.log("🎯 DEBUG: Sirviente detecta salto del jugador - disparo anticipado");
            this.shootEliteProjectile();
            this.lastDashMs = now; // Usar cooldown
            return;
          }
          
          // EVASIÓN: Si tiene menos del 30% de vida, volverse más agresivo
          const hpPercentage = this.hp / this.maxHp;
          if (hpPercentage < 0.3) {
            console.log("� DEBUG: Sirviente con baja vida - MODO DESPERADO");
            // Disparar el doble de rápido
            if (now - this.lastDashMs >= this.dashCooldownMs / 2) { // Cooldown reducido a la mitad
              this.shootEliteProjectile();
              this.lastDashMs = now;
              return;
            }
          }
          
          // MOVIMIENTO: Alternar entre atacar/retroceder/disparar
          const moveDecision = Math.random();
          if (moveDecision < 0.4) {
            // 40% - Atacar
            if (dist < 80 && now - this.lastSeismicMs >= this.seismicCooldownMs) {
              console.log("🌋 DEBUG: Sirviente ÉLITE ejecutando Golpe Sísmico");
              this.executeSeismicAttack();
              this.lastSeismicMs = now;
              return;
            }
          } else if (moveDecision < 0.7) {
            // 30% - Retroceder y disparar
            console.log("🔄 DEBUG: Sirviente retrocediendo y disparando");
            this.executeBackstepAndShoot();
            this.lastDashMs = now;
            return;
          } else {
            // 30% - Disparar proyectil
            if (dist > 100 && dist < 300 && now - this.lastDashMs >= this.dashCooldownMs) {
              console.log("🎯 DEBUG: Sirviente ÉLITE disparando proyectil - JUGADOR CERCA");
              this.shootEliteProjectile();
              this.lastDashMs = now;
              return;
            }
          }
        }

        if (dist < cfg.attackRange) {
          this.fsm.change("attack");
          return;
        }
        if (dist > cfg.chaseRange * 1.5) {
          this.fsm.change("patrol");
          return;
        }

        // Mejora: siempre perseguir activamente al jugador
        const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);
        const speed = this.kind === "tank" ? cfg.moveSpeed * 0.8 : cfg.moveSpeed;
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

  // Métodos de ataque élite para Sirviente Pirichucho
  private executeDashAttack(): void {
    if (!this.player || this.isDashing) return;
    
    console.log("🚀 DEBUG: Iniciando Embestida Sombría");
    
    // Fase 1: Aviso (parpadear/detenerse 0.5s)
    this.setVelocity(0, 0);
    this.sprite.setAlpha(0.5); // Parpadeo como aviso
    
    // Esperar 0.5s y luego ejecutar dash
    this.scene.time.delayedCall(this.dashWarningTime, () => {
      if (!this.player || this.isDead) return;
      
      console.log("🚀 DEBUG: Ejecutando dash hacia jugador");
      
      // Fase 2: Dash hacia el jugador
      this.isDashing = true;
      this.sprite.setAlpha(1); // Restaurar alpha
      
      // Calcular dirección hacia el jugador
      const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);
      const dashSpeed = 400; // Velocidad alta para dash
      const vx = Math.cos(angle) * dashSpeed;
      const vy = Math.sin(angle) * dashSpeed;
      
      this.setVelocity(vx, vy);
      
      // Reproducir animación de ataque durante dash
      if (!(this.sprite instanceof Phaser.GameObjects.Rectangle) && this.scene.anims.exists('sirviente_attack')) {
        (this.sprite as Phaser.GameObjects.Sprite).play('sirviente_attack');
      }
      
      // Terminar dash después de 0.3s
      this.scene.time.delayedCall(300, () => {
        this.isDashing = false;
        this.setVelocity(0, 0);
        console.log("🚀 DEBUG: Dash completado");
      });
    });
  }

  private executeSeismicAttack(): void {
    if (!this.player) return;
    
    console.log("🌋 DEBUG: Iniciando Golpe Sísmico");
    
    // Detener movimiento
    this.setVelocity(0, 0);
    
    // Reproducir animación de golpe
    if (!(this.sprite instanceof Phaser.GameObjects.Rectangle) && this.scene.anims.exists('sirviente_attack')) {
      (this.sprite as Phaser.GameObjects.Sprite).play('sirviente_attack');
      
      // Aplicar daño en el frame de impacto (mitad de animación)
      const animDuration = 600; // Duración estimada de la animación
      const impactFrame = animDuration / 2; // Impacto a la mitad
      
      this.scene.time.delayedCall(impactFrame, () => {
        if (!this.player || this.isDead) return;
        
        console.log("🌋 DEBUG: Frame de impacto del Golpe Sísmico");
        
        // Crear círculo de daño
        const damageCircle = this.scene.add.circle(this.sprite.x, this.sprite.y, 60, 0xff0000, 0.3);
        damageCircle.setDepth(10);
        
        // Tween para efecto de expansión
        this.scene.tweens.add({
          targets: damageCircle,
          radius: 80,
          alpha: 0,
          duration: 500,
          onComplete: () => {
            damageCircle.destroy();
          }
        });
        
        // Aplicar daño y knockback si el jugador está en rango
        const distToPlayer = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);
        if (distToPlayer < 60) {
          console.log("🌋 DEBUG: Jugador alcanzado por golpe sísmico");
          
          // Calcular knockback
          const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);
          const knockbackForce = 150;
          const knockbackX = Math.cos(angle) * knockbackForce;
          const knockbackY = Math.sin(angle) * knockbackForce;
          
          // Aplicar daño mayor por ser ataque élite (30 HP)
          this.player.takeDamage(30);
          
          // Shake de pantalla - ELIMINADO
          // EventBus.getInstance().emit("screen_shake", { intensity: 0.08, duration: 300 });
        }
      });
    }
  }

  private executeBackstepAndShoot(): void {
    if (!this.player) return;
    
    console.log("🔄 DEBUG: Sirviente ÉLITE ejecutando Backstep + disparo");
    
    // Calcular dirección opuesta al jugador
    const angleToPlayer = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);
    const backstepAngle = angleToPlayer + Math.PI; // 180 grados opuesto
    
    // Distancia de backstep
    const backstepDistance = 80;
    const backstepX = this.sprite.x + Math.cos(backstepAngle) * backstepDistance;
    const backstepY = this.sprite.y + Math.sin(backstepAngle) * backstepDistance;
    
    // Reposicionar rápidamente
    this.scene.tweens.add({
      targets: this.sprite,
      x: backstepX,
      y: backstepY,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        // Disparar inmediatamente después del backstep
        this.shootEliteProjectile();
      }
    });
  }

  private shootEliteProjectile(): void {
    if (!this.player) return;
    
    console.log("🎯 DEBUG: Sirviente ÉLITE disparando proyectil desde posición exacta");
    
    // CRÍTICO: Proyectil desde posición EXACTA del sprite (no coordenadas globales)
    const projX = this.sprite.x;
    const projY = this.sprite.y;
    
    console.log(`🎯 DEBUG: Origen del proyectil: X=${projX}, Y=${projY}`);
    
    const proj = this.scene.add.rectangle(projX, projY, 8, 4, 0xff6666, 1);
    this.scene.physics.add.existing(proj);
    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(false);
    body.setSize(8, 4, true);
    
    // Calcular dirección hacia el jugador ACTUAL
    const angle = Phaser.Math.Angle.Between(projX, projY, this.player.x, this.player.y);
    const projSpeed = 350; // Velocidad alta pero esquivable
    const vx = Math.cos(angle) * projSpeed;
    const vy = Math.sin(angle) * projSpeed;
    body.setVelocity(vx, vy);
    
    console.log(`🎯 DEBUG: Velocidad del proyectil: VX=${vx}, VY=${vy}`);
    
    // Crear rastro visual
    const trail = this.scene.add.rectangle(projX, projY, 4, 2, 0xff9999, 0.6);
    trail.setDepth(9);
    
    // Tween para rastro que siga al proyectil
    const trailTween = this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 300,
      onUpdate: () => {
        // Actualizar posición del rastro para seguir al proyectil
        trail.x = proj.x;
        trail.y = proj.y;
      },
      onComplete: () => {
        trail.destroy();
      }
    });
    
    (proj as any).__projDamage = 25; // AUMENTADO: 25 → 25 HP (miedo real para el jugador)
    (proj as any).__projHit = false;
    
    // Colisión con jugador - ASEGURADO
    this.scene.physics.add.overlap(
      proj,
      this.player,
      (_projObj: any, playerObj: any) => {
        const projAny = proj as any;
        if (projAny.__projHit) return;
        projAny.__projHit = true;

        const p = playerObj as Player;
        console.log("🎯 DEBUG: Proyectil ROJO impactó al jugador, aplicando 25 HP de daño MIEDO REAL");
        p.takeDamage(25);
        // EventBus.getInstance().emit("screen_shake", { intensity: 0.02, duration: 100 }); // ELIMINADO

        if (proj.active) proj.destroy();
        trailTween.stop(); // Detener rastro
        trail.destroy();
        
        // Efecto visual de impacto
        const impact = this.scene.add.circle(p.x, p.y, 20, 0xff0000, 0.5);
        this.scene.tweens.add({
          targets: impact,
          alpha: 0,
          radius: 40,
          duration: 300,
          onComplete: () => impact.destroy()
        });
      }
    );
    
    // Destruir después de 1.5 segundos
    this.scene.time.delayedCall(1500, () => {
      if (!proj.active) return;
      proj.destroy();
      trailTween.stop(); // Detener rastro
      trail.destroy();
    });
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

    // SOLO disparar si el jugador está cerca
    const distanceToPlayer = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.player.x, this.player.y);
    if (distanceToPlayer > 300) {
      console.log("🎯 DEBUG: Ranged enemy - jugador demasiado lejos, no dispara");
      return;
    }

    console.log("🎯 DEBUG: Ranged enemy - disparando, jugador cerca");

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
          // EventBus.getInstance().emit("screen_shake", { intensity: 0.01, duration: 70 }); // ELIMINADO

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
    if (this.isDead || this.destroyed) {
      console.log("🛡️ DEBUG: Enemigo ya está muerto o destruido, ignorando daño");
      return;
    }

    // IFRAME: Si está en invulnerabilidad, ignorar daño
    if (this.isInvulnerable) {
      console.log("🛡️ DEBUG: Enemigo en iframe, ignorando daño");
      return;
    }

    console.log(`💔 DEBUG: Enemigo recibiendo ${amount} de daño, HP actual: ${this.hp}/${this.maxHp}`);
    
    // RESTA REAL - SIN FORZADO
    this.hp = Math.max(0, this.hp - amount);
    console.log(`💔 DEBUG: HP del enemigo después del daño: ${this.hp}/${this.maxHp}`);
    console.log("HP RESTANTE:", this.hp); // VERIFICACIÓN DE HP REAL

    // Activar iframe de 200ms
    this.isInvulnerable = true;
    this.invulnerableStartMs = this.scene.time.now;
    this.scene.time.delayedCall(this.invulnerableDurationMs, () => {
      this.isInvulnerable = false;
      console.log("🛡️ DEBUG: Iframe del enemigo terminado");
    });

    // Feedback visual de daño (parpadeo blanco)
    if (!(this.sprite instanceof Phaser.GameObjects.Rectangle)) {
      const sprite = this.sprite as Phaser.GameObjects.Sprite;
      sprite.setTint(0xffffff);
      this.scene.time.delayedCall(100, () => {
        if (sprite && !this.isDead) {
          sprite.setTint(0xffffff); // Limpiar tint con valor normal
        }
      });
    }

    // CRÍTICO: Si muere, EJECUTAR ANIMACIÓN DE MUERTE COMPLETA
    if (this.hp <= 0) {
      console.log("💀 DEBUG: HP del enemigo llegó a 0 - INICIANDO ANIMACIÓN DE MUERTE COMPLETA");
      
      // Marcar como muerto
      this.isDead = true;
      
      // Desactivar física para que no siga golpeando
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.enable = false;
        console.log("🛡️ DEBUG: Cuerpo físico del enemigo desactivado");
      }
      
      // Detener cualquier animación actual
      if (!(this.sprite instanceof Phaser.GameObjects.Rectangle)) {
        (this.sprite as Phaser.GameObjects.Sprite).stop();
      }
      
      // EJECUTAR ANIMACIÓN DE MUERTE SEGÚN TIPO
      if (this.enemyType === 'sirviente') {
        // Sirviente Pirichucho - usar animación de muerte específica
        if (!(this.sprite instanceof Phaser.GameObjects.Rectangle)) {
          if (this.scene.anims.exists('sirviente_death') && this.scene.textures.exists('sirviente_muerte')) {
            console.log("💀 DEBUG: Reproduciendo animación de muerte para Sirviente Pirichucho");
            
            // Cambiar a spritesheet de muerte
            (this.sprite as Phaser.GameObjects.Sprite).setTexture('sirviente_muerte', 0);
            
            // Reproducir animación de muerte
            (this.sprite as Phaser.GameObjects.Sprite).play('sirviente_death');
            
            // Destruir SOLO cuando termine la animación - CRÍTICO
            (this.sprite as Phaser.GameObjects.Sprite).once('animationcomplete', () => {
              console.log("💀 DEBUG: Animación de muerte de Sirviente completada, destruyendo");
              this.destroyEnemy(); // Usar método seguro
            });
          } else {
            console.log("💀 DEBUG: No hay animación de muerte para Sirviente, usando fallback");
            this.useDeathFallback();
          }
        } else {
          console.log("💀 DEBUG: Sirviente es rectángulo, usando fallback");
          this.useDeathFallback();
        }
      } else if (this.enemyType === 'alma') {
        // Alma en pena - intentar usar animación de alma enojada primero
        if (!(this.sprite instanceof Phaser.GameObjects.Rectangle)) {
          if (this.scene.anims.exists('alma_angry_death_anim') && this.scene.textures.exists('alma_angry_death')) {
            console.log("💀 DEBUG: Reproduciendo animación de muerte para alma enojada");
            
            (this.sprite as Phaser.GameObjects.Sprite).stop();
            (this.sprite as Phaser.GameObjects.Sprite).setTexture('alma_angry_death', 0);
            (this.sprite as Phaser.GameObjects.Sprite).play('alma_angry_death_anim');
            
            // Destruir SOLO cuando termine la animación - CRÍTICO
            (this.sprite as Phaser.GameObjects.Sprite).once('animationcomplete', () => {
              console.log("💀 DEBUG: Animación de muerte de alma enojada completada, destruyendo");
              this.destroyEnemy(); // Usar método seguro
            });
          }
          // Fallback a animación de alma normal
          else if (this.scene.anims.exists('alma_death_anim') && this.scene.textures.exists('alma_death')) {
            console.log("💀 DEBUG: Reproduciendo animación de muerte para alma normal");
            
            (this.sprite as Phaser.GameObjects.Sprite).stop();
            (this.sprite as Phaser.GameObjects.Sprite).setTexture('alma_death', 0);
            (this.sprite as Phaser.GameObjects.Sprite).play('alma_death_anim');
            
            // Destruir SOLO cuando termine la animación - CRÍTICO
            (this.sprite as Phaser.GameObjects.Sprite).once('animationcomplete', () => {
              console.log("💀 DEBUG: Animación de muerte normal completada, destruyendo");
              this.destroyEnemy(); // Usar método seguro
            });
          } else {
            console.log("💀 DEBUG: No hay animación de muerte disponible, usando fallback");
            this.useDeathFallback();
          }
        } else {
          console.log("💀 DEBUG: Enemigo es rectángulo, usando fallback");
          this.useDeathFallback();
        }
      } else {
        console.log("💀 DEBUG: Enemigo no es alma ni sirviente, usando fallback");
        this.useDeathFallback();
      }

      // Emitir XP inmediatamente
      EventBus.getInstance().emit("enemy_defeated", {
        enemyId: this.id,
        xp: this.xpReward,
      });
      
      return; // Salir sin hacer knockback
    }

    // IA ÉLITE: Contar golpes del jugador para reacción
    if (this.isElite) {
      const now = this.scene.time.now;
      
      // Resetear contador si pasó mucho tiempo (2 segundos)
      if (now - this.lastPlayerHitTime > 2000) {
        this.playerHits = 0;
      }
      
      this.playerHits++;
      this.lastPlayerHitTime = now;
      
      console.log(`🎯 DEBUG: Sirviente ÉLITE recibido golpe #${this.playerHits}`);
      
      // Si recibe 3 golpes seguidos, ejecutar backstep
      if (this.playerHits >= 3 && now - this.lastDashMs >= this.backstepCooldownMs) {
        console.log("🔄 DEBUG: Sirviente ÉLITE ejecutando Backstep por 3 golpes seguidos");
        this.executeBackstepAndShoot();
        this.lastDashMs = now; // Usar mismo cooldown para backstep
        this.playerHits = 0; // Resetear contador
        return; // No aplicar knockback normal
      }
    }

    // Shake al recibir daño del enemigo - ELIMINADO
    // EventBus.getInstance().emit("screen_shake", { intensity: 0.02, duration: 90 });

    // Knockback básico: empujar hacia afuera del atacante.
    const dx = this.sprite.x - attackerX;
    const dy = this.sprite.y - attackerY;
    const dist = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
    const dirX = dx / dist;
    const dirY = dy / dist;
    this.setVelocity(dirX * knockbackForce, dirY * knockbackForce);
  }

  private die(): void {
    if (this.isDead) return;
    this.isDead = true;

    console.log("💀 DEBUG: Enemigo muriendo, iniciando secuencia de muerte");

    // Detener movimiento inmediatamente
    this.setVelocity(0, 0);
    
    // Desactivar física para evitar más colisiones
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = false;
      console.log("🛡️ DEBUG: Cuerpo físico del enemigo desactivado");
    }

    // CRÍTICO:// Reproducir animación de muerte si existe
    if (this.enemyType === 'sirviente') {
      // Sirviente Pirichucho - usar animación de muerte específica
      if (this.scene.anims.exists('sirviente_death') && this.scene.textures.exists('sirviente_muerte')) {
        console.log("💀 DEBUG: Reproduciendo animación de muerte para Sirviente Pirichucho");
        
        if (!(this.sprite instanceof Phaser.GameObjects.Rectangle)) {
          // Detener cualquier animación actual
          (this.sprite as Phaser.GameObjects.Sprite).stop();
          
          // Cambiar a spritesheet de muerte si es necesario
          (this.sprite as Phaser.GameObjects.Sprite).setTexture('sirviente_muerte', 0);
          
          // CRÍTICO: Ejecutar animación de muerte
          (this.sprite as Phaser.GameObjects.Sprite).play('sirviente_death');
          
          // Usar evento animationcomplete para destruir SOLO cuando termine
          (this.sprite as Phaser.GameObjects.Sprite).once('animationcomplete', () => {
            console.log("💀 DEBUG: Animación de muerte completada, destruyendo Sirviente");
            this.destroyEnemy();
          });
        } else {
          console.log("💀 DEBUG: Sirviente es rectángulo, destruyendo inmediatamente");
          this.destroyEnemy();
        }
      } else {
        console.log("💀 DEBUG: No hay animación de muerte para Sirviente, usando fallback");
        this.useDeathFallback();
      }
    } else if (this.enemyType === 'alma') {
      // Intentar usar animación de alma enojada primero
      if (this.scene.anims.exists('alma_angry_death_anim') && this.scene.textures.exists('alma_angry_death')) {
        console.log("💀 DEBUG: Reproduciendo animación de muerte para alma enojada");
        
        if (!(this.sprite instanceof Phaser.GameObjects.Rectangle)) {
          // Detener cualquier animación actual
          (this.sprite as Phaser.GameObjects.Sprite).stop();
          
          // Cambiar a spritesheet de muerte si es necesario
          (this.sprite as Phaser.GameObjects.Sprite).setTexture('alma_angry_death', 0);
          
          // CRÍTICO: Ejecutar animación de muerte
          (this.sprite as Phaser.GameObjects.Sprite).play('alma_angry_death_anim');
          
          // Usar evento animationcomplete para destruir SOLO cuando termine
          (this.sprite as Phaser.GameObjects.Sprite).once('animationcomplete', () => {
            console.log("💀 DEBUG: Animación de muerte completada, destruyendo enemigo");
            this.destroyEnemy(); // Usar destroyEnemy en lugar de destroy
          });
        } else {
          console.log("💀 DEBUG: Enemigo es rectángulo, destruyendo inmediatamente");
          this.destroyEnemy();
        }
      }
      // Fallback a animación de alma normal
      else if (this.scene.anims.exists('alma_death_anim') && this.scene.textures.exists('alma_death')) {
        console.log("💀 DEBUG: Reproduciendo animación de muerte para alma normal");
        
        if (!(this.sprite instanceof Phaser.GameObjects.Rectangle)) {
          (this.sprite as Phaser.GameObjects.Sprite).stop();
          (this.sprite as Phaser.GameObjects.Sprite).setTexture('alma_death', 0);
          (this.sprite as Phaser.GameObjects.Sprite).play('alma_death_anim');
          
          (this.sprite as Phaser.GameObjects.Sprite).once('animationcomplete', () => {
            console.log("💀 DEBUG: Animación de muerte normal completada, destruyendo enemigo");
            this.destroyEnemy(); // Usar destroyEnemy en lugar de destroy
          });
        } else {
          this.destroyEnemy();
        }
      } else {
        console.log("💀 DEBUG: No hay animación de muerte disponible, usando fallback");
        this.useDeathFallback();
      }
    } else {
      console.log("💀 DEBUG: Enemigo no es alma, usando fallback");
      this.useDeathFallback();
    }

    // Emitir XP inmediatamente
    EventBus.getInstance().emit("enemy_defeated", {
      enemyId: this.id,
      xp: this.xpReward,
    });
  }

  private useDeathFallback(): void {
    // Fallback para otros enemigos o si no hay animación
    console.log("💀 DEBUG: Usando muerte fallback para enemigo");
    
    // Aplicar efecto de muerte solo si es un rectángulo (fallback)
    if (this.sprite instanceof Phaser.GameObjects.Rectangle) {
      this.sprite.setFillStyle(0x000000, 0.5);
    } else {
      // Para sprite personalizado, usar tint o alpha
      this.sprite.setTint(0x000000);
      this.sprite.setAlpha(0.5);
    }

    // Destruir después de un pequeño tween
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        this.destroyEnemy();
      },
    });

    // Emitir XP inmediatamente (no esperar a la destrucción)
    EventBus.getInstance().emit("enemy_defeated", {
      enemyId: this.id,
      xp: this.xpReward,
    });
  }

  private destroyEnemy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    
    // Limpiar eventos antes de destruir
    this.sprite.removeAllListeners();
    this.sprite.destroy();
    
    console.log("💀 DEBUG: Enemigo destruido completamente");
  }

  public update(): void {
    if (this.isDead) return;
    // `StateMachine` requiere dt; para este juego usamos un dt fijo aproximado.
    this.fsm.update(16.67 / 1000);

    // Mantener orientación para ranged: nada por ahora.
  }
}

