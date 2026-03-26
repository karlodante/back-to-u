import Phaser from "phaser";
import { Dash } from "../systems/Dash";
import { StateMachine } from "../core/StateMachine";
import { EventBus } from "../core/EventBus";
import { Pachita } from "./Pachita";
import { AudioSystem } from "../core/AudioSystem";

export class Player extends Phaser.Physics.Arcade.Sprite {
  public health: number = 100;
  public maxHealth: number = 100;
  public xp: number = 0;
  
  public isDashing: boolean = false;
  public dashCooldown: number = 0;
  public isHurt: boolean = false;
  public hurtDurationMs: number = 150; // Reducido a 150ms para no bloquear tanto
  public hurtStartMs: number = 0;
  private hurtFlashCount: number = 0;
  private isInvulnerable: boolean = false;
  private invulnerableDurationMs: number = 1200; // 1.2 segundos de i-frames
  private dashSystem: Dash;

  private fsm: StateMachine = new StateMachine();
  private isDead: boolean = false;
  private invulnerabilityDuration: number = 1000;

  // Game feel: "coyote time" + "jump buffer"
  // update() no recibe dt, así que usamos contadores por frame.
  private coyoteTimeFrames: number = 6;
  private jumpBufferFrames: number = 6;
  private coyoteCounter: number = 0;
  private jumpBufferCounter: number = 0;

  // Combate: cooldown real e "attack window" independiente de la animacion
  public attackDamage: number = 20;
  public attackKnockback: number = 220;
  private playerLevel: number = 1;
  private attackCooldownMs: number = 450;
  private attackCooldownLeftMs: number = 0;
  private attackStartMs: number = 0;
  private attackWindowStartMs: number = 60; // dentro de la anim/acción
  private attackWindowEndMs: number = 160;
  private attackInstanceId: number = 0;

  // Referencia a Pachita para bono de transformación
  private pachita: Pachita | null = null;
  
  // Sistema de audio
  private audioSystem: AudioSystem | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Detectar si usar sprites personalizados o spritesheet original
    const useCustomSprites = scene.textures.exists('wara_idle');
    const spriteKey = useCustomSprites ? 'wara_idle' : 'oakwoods-char-blue';
    console.log(`🎮 DEBUG: Player usando spriteKey: ${spriteKey} (custom: ${useCustomSprites})`);
    
    // Crear sprite con el sistema apropiado
    if (useCustomSprites) {
      // Usar imagen individual de Wara (sin frame number)
      super(scene, x, y, spriteKey);
      console.log("🔧 DEBUG: Player creado con imagen individual Wara");
      this.setScale(1.5); // Ajustar tamaño de Wara
      this.setDepth(10); // Asegurar depth correcto
      this.setOrigin(0.5, 1); // Asegurar origen consistente
    } else {
      // Usar spritesheet original (con frame number)
      super(scene, x, y, spriteKey, 0);
      console.log("🔧 DEBUG: Player creado con spritesheet original");
      this.setDepth(10); // Asegurar depth correcto
      this.setOrigin(0.5, 1); // Asegurar origen consistente
    }
    
    // Limpiar cualquier renderizado previo
    this.clearTint();
    this.setAlpha(1);
    this.setVisible(true);
    
    this.dashSystem = new Dash();
    
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setBounce(0);
    this.body?.setSize(20, 38);
    this.body?.setOffset(18, 16);
    this.setCollideWorldBounds(true);

    console.log("🏗️ DEBUG: Player constructor completado");
    this.setupStateMachine();

    // Reset attack state when animation finishes
    this.on("animationcomplete", (anim: any) => {
      if (!useCustomSprites) {
        // Solo para spritesheet original
        if (anim.key === "char-blue-attack") {
          this.fsm.change("idle");
        }
      }
    });
  }

  /**
   * Establece la referencia a Pachita para bonos de combate
   */
  public setPachita(pachita: Pachita): void {
    this.pachita = pachita;
  }

  /**
   * Establece el sistema de audio
   */
  public setAudioSystem(audioSystem: AudioSystem): void {
    this.audioSystem = audioSystem;
  }

  private setupStateMachine(): void {
    const useCustomSprites = this.scene.textures.exists('wara_idle');
    let currentTexture = '';
    
    console.log("🧠 DEBUG: Inicializando FSM del Player");
    console.log(`🧠 DEBUG: useCustomSprites = ${useCustomSprites}`);
    console.log(`🧠 DEBUG: Textura actual del Player = ${this.texture?.key}`);
    
    // Función helper para cambiar textura solo si es necesario
    const changeTexture = (textureKey: string) => {
      if (useCustomSprites && currentTexture !== textureKey) {
        console.log(`🎭 DEBUG: CAMBIO DE TEXTURA: ${currentTexture} → ${textureKey}`);
        console.log(`🎭 DEBUG: Posición actual: x=${this.x}, y=${this.y}`);
        console.log(`🎭 DEBUG: Visible: ${this.visible}, Alpha: ${this.alpha}`);
        
        this.setTexture(textureKey);
        currentTexture = textureKey;
        
        // Verificar que el cambio funcionó
        console.log(`🎭 DEBUG: Textura después del cambio: ${this.texture?.key}`);
      } else {
        console.log(`🎭 DEBUG: Sin cambio de textura necesaria: ${currentTexture} === ${textureKey}`);
      }
    };
    
    this.fsm.add({
      name: "idle",
      enter: () => {
        console.log("🔄 DEBUG: Entrando en estado IDLE");
        if (useCustomSprites) {
          changeTexture('wara_idle');
        } else {
          this.anims.play("char-blue-idle", true);
        }
      }
    });

    this.fsm.add({
      name: "run",
      enter: () => {
        console.log("🔄 DEBUG: Entrando en estado RUN");
        if (useCustomSprites) {
          changeTexture('wara_run');
        } else {
          this.anims.play("char-blue-run", true);
        }
      }
    });

    this.fsm.add({
      name: "jump",
      enter: () => {
        console.log("🔄 DEBUG: Entrando en estado JUMP");
        if (useCustomSprites) {
          changeTexture('wara_jump');
        } else {
          this.anims.play("char-blue-jump", true);
        }
      }
    });

    this.fsm.add({
      name: "fall",
      enter: () => {
        console.log("🔄 DEBUG: Entrando en estado FALL");
        if (useCustomSprites) {
          changeTexture('wara_jump');
        } else {
          this.anims.play("char-blue-fall", true);
        }
      }
    });

    this.fsm.add({
      name: "attack",
      enter: () => {
        console.log("🔄 DEBUG: Entrando en estado ATTACK");
        this.setVelocityX(0);
        if (useCustomSprites) {
          changeTexture('wara_attack');
          // Volver a idle después de un tiempo
          this.scene.time.delayedCall(500, () => {
            if (this.fsm.getCurrentStateName() === "attack") {
              console.log("⏰ DEBUG: Timer de attack completado, volviendo a idle");
              this.fsm.change("idle");
            }
          });
        } else {
          this.anims.play("char-blue-attack", true);
        }
      }
    });

    this.fsm.add({
      name: "hurt",
      enter: () => {
        console.log("🔄 DEBUG: Entrando en estado HURT");
        if (useCustomSprites) {
          changeTexture('wara_idle');
        } else {
          this.anims.play("char-blue-hurt", true);
        }
      },
      update: () => {
        const now = this.scene.time.now;
        const elapsed = now - this.hurtStartMs;
        
        // Salir del estado hurt después de la duración
        if (elapsed >= this.hurtDurationMs) {
          this.isHurt = false;
          // Volver al estado apropiado
          const body = this.body as Phaser.Physics.Arcade.Body;
          if (body?.blocked.down) {
            this.fsm.change("idle");
          } else {
            this.fsm.change("fall");
          }
        }
      }
    });

    // Inicializar textura
    if (useCustomSprites) {
      currentTexture = 'wara_idle';
      console.log("🧠 DEBUG: Textura inicial establecida: wara_idle");
    }

    console.log("🧠 DEBUG: FSM inicializado, cambiando a estado idle");
    this.fsm.change("idle");
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys, dashKey: Phaser.Input.Keyboard.Key, attackKey: Phaser.Input.Keyboard.Key): void {
    if (this.isDead) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) {
      console.error("❌ El cuerpo del jugador no existe");
      return;
    }

    // DEBUG: Solo loggear cada 60 frames (1 segundo aprox) para no spam
    if (Math.random() < 0.016) { // ~1/60 de probabilidad
      console.log(`🕹️ DEBUG: Estado=${this.fsm.getCurrentStateName()}, Vel=(x:${Math.round(body.velocity.x)}, y:${Math.round(body.velocity.y)})`);
    }

    // Cooldown del ataque (ms reales)
    if (this.attackCooldownLeftMs > 0) {
      this.attackCooldownLeftMs -= 16.67;
    }

    // --- Jump feel helpers ---
    const grounded = !!body.blocked.down;
    if (grounded) {
      this.coyoteCounter = this.coyoteTimeFrames;
    } else {
      this.coyoteCounter = Math.max(0, this.coyoteCounter - 1);
    }

    if (Phaser.Input.Keyboard.JustDown(cursors.up)) {
      this.jumpBufferCounter = this.jumpBufferFrames;
      console.log("⬆️ DEBUG: Jump buffer activado");
    } else {
      this.jumpBufferCounter = Math.max(0, this.jumpBufferCounter - 1);
    }

    // Actualizar Cooldown del Dash
    this.dashSystem.update(this, 16.67);

    // Lógica de Dash (prioridad alta)
    if (Phaser.Input.Keyboard.JustDown(dashKey)) {
      console.log("💨 DEBUG: Dash key presionada");
      this.dashSystem.tryDash(this, cursors.left.isDown ? -1 : (cursors.right.isDown ? 1 : 0));
      
      // Emitir sonido de dash
      if (this.audioSystem) {
        this.audioSystem.emitDashSound();
      }
    }

    if (this.isDashing) return;

    // Lógica de Ataque
    if (
      Phaser.Input.Keyboard.JustDown(attackKey) &&
      body.blocked.down &&
      this.fsm.getCurrentStateName() !== "attack" &&
      this.attackCooldownLeftMs <= 0
    ) {
      console.log("⚔️ DEBUG: Attack key presionada - cambiando a estado attack");
      this.attackCooldownLeftMs = this.attackCooldownMs;
      this.attackStartMs = this.scene.time.now;
      this.attackInstanceId++;
      this.fsm.change("attack");
      
      // Emitir sonido de ataque
      if (this.audioSystem) {
        this.audioSystem.emitAttackSound();
      }
    }

    if (this.fsm.getCurrentStateName() === "attack") {
      // Lógica de ataque actual
      const attackElapsed = this.scene.time.now - this.attackStartMs;
      if (attackElapsed >= this.attackDurationMs) {
        console.log("⚔️ DEBUG: Attack duration completado");
        // El timer del estado attack se encargará de volver a idle
      }
    }
      // Seguimos actualizando cooldown/flags (pero no movemos al jugador).
      this.fsm.update(16.67 / 1000);
      return;
    }

    // Movimiento Horizontal
    let dx = 0;
    if (cursors.left.isDown) {
      dx = -1;
      this.setFlipX(true);
      console.log("⬅️ DEBUG: Moviendo izquierda");
    } else if (cursors.right.isDown) {
      dx = 1;
      this.setFlipX(false);
      console.log("➡️ DEBUG: Moviendo derecha");
    }

    const speed = 160;
    this.setVelocityX(dx * speed);

    // Salto
    if (this.coyoteCounter > 0 && this.jumpBufferCounter > 0) {
      this.setVelocityY(-330);
      this.coyoteCounter = 0;
      this.jumpBufferCounter = 0;
      
      // Emitir sonido de salto
      if (this.audioSystem) {
        this.audioSystem.emitJumpSound();
      }
    }

    // Transiciones de Estado basadas en Movimiento/Física
    if (body.blocked.down) {
      if (dx !== 0) {
        this.fsm.change("run");
      } else {
        this.fsm.change("idle");
      }
    } else {
      if (body.velocity.y < 0) {
        this.fsm.change("jump");
      } else {
        this.fsm.change("fall");
      }
    }

    // No permitir movimiento durante el estado hurt (pero con más libertad)
    if (this.isHurt) {
      // Permitir 50% del movimiento normal durante hurt
      const body = this.body as Phaser.Physics.Arcade.Body;
      if (body) {
        const currentVelX = body.velocity.x;
        // Reducir velocidad pero permitir movimiento
        if (Math.abs(currentVelX) > 0) {
          this.setVelocityX(currentVelX * 0.5);
        }
      }
    }

    this.fsm.update(16.67 / 1000);
  }

  /**
   * Inicia el efecto de flash al recibir daño
   */
  private startHurtFlash(): void {
    this.hurtFlashCount = 0;
    this.hurtFlashLoop();
  }

  /**
   * Loop del efecto de flash
   */
  private hurtFlashLoop(): void {
    if (this.hurtFlashCount >= 6) {
      this.setAlpha(1);
      return;
    }

    this.setAlpha(this.hurtFlashCount % 2 === 0 ? 0.3 : 1);
    this.hurtFlashCount++;
    
    this.scene.time.delayedCall(50, () => {
      this.hurtFlashLoop();
    });
  }

  public takeDamage(amount: number): void {
    if (this.isDead || this.isInvulnerable || this.isDashing) return;

    EventBus.getInstance().emit("player_took_damage", { amount });
    this.health -= amount;
    EventBus.getInstance().emit("player_damage", this.health);
    EventBus.getInstance().emit("screen_shake", { intensity: 0.02, duration: 120 });
    
    if (this.health <= 0) {
      this.health = 0;
      this.die();
      return;
    }
    
    // Activar estado hurt
    this.isHurt = true;
    this.isInvulnerable = true;
    this.fsm.change("hurt");
    
    // Desactivar invulnerabilidad después del tiempo
    this.scene.time.delayedCall(this.invulnerableDurationMs, () => {
      this.isInvulnerable = false;
    });
  }

  private die(): void {
    if (this.isDead) return;
    this.isDead = true;
    
    this.setVelocity(0, 0);
    this.setTint(0x555555);
    this.anims.stop();
    
    EventBus.getInstance().emit("player_death");
    this.emit("player_died");
  }

  public getIsDead(): boolean {
    return this.isDead;
  }

  public getIsAttacking(): boolean {
    return this.fsm.getCurrentStateName() === "attack";
  }

  public isAttackWindow(): boolean {
    if (this.fsm.getCurrentStateName() !== "attack") return false;
    const now = this.scene.time.now;
    return now >= this.attackStartMs + this.attackWindowStartMs && now <= this.attackStartMs + this.attackWindowEndMs;
  }

  public getAttackInstanceId(): number {
    return this.attackInstanceId;
  }

  /**
   * Obtiene el daño de ataque actual con bono de transformación
   */
  public getCurrentAttackDamage(): number {
    let baseDamage = this.attackDamage;
    
    // Bono del 50% de daño extra cuando Pachita está transformada
    if (this.pachita && this.pachita.isInTransformedMode()) {
      baseDamage *= 1.5;
    }
    
    return baseDamage;
  }

  public getLevel(): number {
    return this.playerLevel;
  }

  /**
   * Aplica escalado por nivel (placeholder para game jam).
   * No rompe FSM ni movimiento.
   */
  public applyLevel(level: number): void {
    const next = Math.max(1, Math.floor(level));
    this.playerLevel = next;

    const newMaxHealth = 100 + (next - 1) * 20;
    const newAttackDamage = 20 + (next - 1) * 4;

    this.maxHealth = newMaxHealth;
    this.attackDamage = newAttackDamage;
    this.health = Math.min(this.health, this.maxHealth);
  }

  public getIsInvulnerable(): boolean {
    return this.isInvulnerable;
  }

  public getDashCooldownProgress(): number {
    return Math.max(0, this.dashCooldown / this.dashSystem.cooldownTime);
  }

  // Curación usada por la mecánica de Pachita (mascota).
  public heal(amount: number): void {
    if (this.isDead) return;
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    if (this.health !== before) {
      EventBus.getInstance().emit("player_heal", this.health);
    }
  }
}
