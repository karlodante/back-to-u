import Phaser from "phaser";
import { Dash } from "../systems/Dash";
import { StateMachine } from "../core/StateMachine";
import { EventBus } from "../core/EventBus";
import { Pachita } from "./Pachita";
import { AudioSystem } from "../core/AudioSystem";

export class Player extends Phaser.Physics.Arcade.Sprite {
  public health: number = 100;
  public maxHealth: number = 100;
  public attackDamage: number = 25;
  public level: number = 1;
  public isDead: boolean = false;
  public isDashing: boolean = false;
  public isHurt: boolean = false;
  public hurtStartMs: number = 0;
  public hurtDurationMs: number = 1000;
  public attackCooldownMs: number = 500;
  public attackCooldownLeftMs: number = 0;
  public attackDurationMs: number = 300;
  public attackStartMs: number = 0;
  public attackInstanceId: number = 0;
  public isInvulnerable: boolean = false;
  public invulnerableStartMs: number = 0;
  public invulnerableDurationMs: number = 1000;
  public dashCooldownMs: number = 1000;
  public dashCooldownLeftMs: number = 0;
  public coyoteTimeFrames: number = 6;
  public coyoteCounter: number = 0;
  public jumpBufferFrames: number = 6;
  public jumpBufferCounter: number = 0;
  private dashSystem: Dash;
  private fsm: StateMachine = new StateMachine();
  private audioSystem: AudioSystem | null = null;
  private pachita: Pachita | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Detectar si usar sprites personalizados o spritesheet original
    const useCustomSprites = scene.textures.exists('wara_idle');
    const spriteKey = useCustomSprites ? 'wara_idle' : 'oakwoods-char-blue';
    console.log(`🎮 DEBUG: Player usando spriteKey: ${spriteKey} (custom: ${useCustomSprites})`);
    
    // Crear sprite con el sistema apropiado
    if (useCustomSprites) {
      // Usar spritesheet de Wara (con frame inicial 0)
      super(scene, x, y, spriteKey, 0);
      console.log("🔧 DEBUG: Player creado con spritesheet Wara");
      this.setScale(1.2); // ESCALA NATURAL - proporcional a enemigos
      this.setDepth(10); // Asegurar depth correcto
    } else {
      // Usar spritesheet original (con frame number)
      super(scene, x, y, spriteKey, 0);
      console.log("🔧 DEBUG: Player creado con spritesheet original");
      this.setDepth(10); // Asegurar depth correcto
    }
    
    // ORIGEN CRÍTICO: Base del sprite
    this.setOrigin(0.5, 1);
    
    // Limpiar cualquier renderizado previo
    this.clearTint();
    this.setAlpha(1);
    this.setVisible(true);
    
    this.dashSystem = new Dash();
    
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setBounce(0);
    
    // HABILITAR GRAVEDAD PARA PLAYER
    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    }
    
    // AJUSTE PRECISO DEL BODY
    // Medidas reales del sprite escalado (32px base * 1.2 escala)
    const spriteWidth = 32 * 1.2; // 38.4px
    const spriteHeight = 32 * 1.2; // 38.4px
    
    // Body más pequeño que el sprite, alineado con los pies
    this.body?.setSize(spriteWidth * 0.8, spriteHeight * 0.9); // 80% ancho, 90% alto
    
    // CRÍTICO: Offset cero para que la caja verde empiece desde los pies
    this.body?.setOffset(0, 0);
    
    this.setCollideWorldBounds(true);

    console.log("🏗️ DEBUG: Player con gravedad y body ajustado a los pies");
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
    
    console.log("🧠 DEBUG: Inicializando FSM del Player");
    console.log(`🧠 DEBUG: useCustomSprites = ${useCustomSprites}`);
    console.log(`🧠 DEBUG: Textura actual del Player = ${this.texture?.key}`);
    
    this.fsm.add({
      name: "idle",
      enter: () => {
        console.log("🔄 DEBUG: Entrando en estado IDLE");
        if (useCustomSprites) {
          // Verificar si la animación existe antes de reproducirla
          if (this.scene.anims.exists('wara_idle_anim')) {
            (this as Phaser.GameObjects.Sprite).play('wara_idle_anim', true);
            console.log("🔧 DEBUG: Wara creada con animación idle");
          } else {
            console.log("⚠️ DEBUG: Animación wara_idle_anim no existe, Wara no tendrá animación");
          }
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
          this.anims.play("wara_run_anim", true);
          console.log("🎭 DEBUG: Reproduciendo animación wara_run_anim");
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
          this.anims.play("wara_jump_anim", true);
          console.log("🎭 DEBUG: Reproduciendo animación wara_jump_anim");
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
          // Para caída, mantenemos la animación de salto
          this.anims.play("wara_jump_anim", true);
          console.log("🎭 DEBUG: Reproduciendo animación wara_jump_anim (para fall)");
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
          // Verificar si la animación existe antes de reproducirla
          if (this.scene.anims.exists('wara_attack_anim')) {
            this.anims.play("wara_attack_anim", true);
            console.log("🎭 DEBUG: Reproduciendo animación wara_attack_anim");
            
            // Volver a idle cuando la animación termine
            this.on("animationcomplete", (anim: any) => {
              if (anim.key === "wara_attack_anim") {
                console.log("⏰ DEBUG: Animación attack completada, volviendo a idle");
                this.fsm.change("idle");
              }
            });
          } else {
            console.log("⚠️ DEBUG: Animación wara_attack_anim no existe, ataque sin animación");
            // Volver a idle después de un tiempo fijo
            this.scene.time.delayedCall(300, () => {
              this.fsm.change("idle");
            });
          }
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
          // Para daño, mantenemos la animación idle
          this.anims.play("wara_idle_anim", true);
          console.log("🎭 DEBUG: Reproduciendo animación wara_idle_anim (para hurt)");
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
      console.log("🦘 DEBUG: Salto ejecutado");
    }

    // Transiciones de Estado basadas en Movimiento/Física
    if (body.blocked.down) {
      if (dx !== 0) {
        if (this.fsm.getCurrentStateName() !== "run") {
          console.log("🔄 DEBUG: Cambiando a estado RUN (movimiento horizontal)");
        }
        this.fsm.change("run");
      } else {
        if (this.fsm.getCurrentStateName() !== "idle") {
          console.log("🔄 DEBUG: Cambiando a estado IDLE (sin movimiento)");
        }
        this.fsm.change("idle");
      }
    } else {
      if (body.velocity.y < 0) {
        if (this.fsm.getCurrentStateName() !== "jump") {
          console.log("🔄 DEBUG: Cambiando a estado JUMP (velocidad y negativa)");
        }
        this.fsm.change("jump");
      } else {
        if (this.fsm.getCurrentStateName() !== "fall") {
          console.log("🔄 DEBUG: Cambiando a estado FALL (velocidad y positiva)");
        }
        this.fsm.change("fall");
      }
    }

    // Actualizar FSM
    this.fsm.update(16.67 / 1000);
  }

  // Métodos públicos para compatibilidad
  public takeDamage(amount: number): void {
    if (this.isInvulnerable || this.isDead) {
      console.log(`🛡️ DEBUG: Player es invulnerable o está muerto, ignorando ${amount} de daño`);
      return;
    }
    
    console.log(`💔 DEBUG: Player recibiendo ${amount} de daño, HP actual: ${this.health}/${this.maxHealth}`);
    
    this.health = Math.max(0, this.health - amount);
    console.log(`💔 DEBUG: HP del Player después del daño: ${this.health}/${this.maxHealth}`);
    
    this.isHurt = true;
    this.hurtStartMs = this.scene.time.now;
    this.isInvulnerable = true;
    this.invulnerableStartMs = this.scene.time.now;
    
    console.log("🔄 DEBUG: Cambiando Player a estado hurt");
    this.fsm.change("hurt");
    
    // Iniciar flash de daño
    this.startHurtFlash();
    
    // Emitir sonido de daño
    if (this.audioSystem) {
      // this.audioSystem.emitHurtSound(); // Método no existe, comentado
    }
    
    if (this.health <= 0) {
      console.log("💀 DEBUG: HP del Player llegó a 0, iniciando muerte");
      this.die();
    }
  }

  private startHurtFlash(): void {
    // Flash rojo cuando recibe daño
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.clearTint();
    });
  }

  private die(): void {
    console.log("💀 DEBUG: Player ha muerto");
    this.isDead = true;
    this.setVelocity(0, 0);
    this.setVisible(false);
    
    // Emitir sonido de muerte
    if (this.audioSystem) {
      // this.audioSystem.emitDeathSound(); // Método no existe, comentado
    }
    
    // EventBus.emit("player-death"); // Método no existe, comentado
  }

  public getIsDead(): boolean {
    return this.isDead;
  }

  public getIsAttacking(): boolean {
    return this.fsm.getCurrentStateName() === "attack";
  }

  public isAttackWindow(): boolean {
    if (!this.getIsAttacking()) {
      console.log("⚔️ DEBUG: Player no está en estado attack");
      return false;
    }
    
    const elapsed = this.scene.time.now - this.attackStartMs;
    const inWindow = elapsed >= 50 && elapsed <= 200; // Ventana de 50-200ms después del inicio
    
    console.log(`⚔️ DEBUG: Ventana de ataque - elapsed: ${elapsed}ms, inWindow: ${inWindow}`);
    
    return inWindow;
  }

  public getAttackInstanceId(): number {
    return this.attackInstanceId;
  }

  public getCurrentAttackDamage(): number {
    let damage = this.attackDamage;
    
    // Bonos de Pachita
    if (this.pachita) {
      // if (this.pachita.isInCombatMode()) { // Método no existe, comentado
      //   damage = Math.floor(damage * 1.5);
      //   console.log(`⚔️ DEBUG: Bonos de Pachita aplicados, daño: ${damage}`);
      // }
    }
    
    return damage;
  }

  public getLevel(): number {
    return this.level;
  }

  public applyLevel(level: number): void {
    this.level = level;
    const next = this.level + 1;
    const newMaxHealth = 100 + (next - 1) * 20;
    const newAttackDamage = 25 + (next - 1) * 5;
    
    this.maxHealth = newMaxHealth;
    this.health = Math.min(this.health + 20, newMaxHealth);
    this.attackDamage = newAttackDamage;
    
    console.log(`⬆️ DEBUG: Player nivel ${level} aplicado`);
  }

  public getIsInvulnerable(): boolean {
    return this.isInvulnerable;
  }

  public getDashCooldownProgress(): number {
    return 1 - (this.dashCooldownLeftMs / this.dashCooldownMs);
  }

  public heal(amount: number): void {
    if (this.isDead) return;
    
    const before = this.health;
    this.health = Math.min(this.health + amount, this.maxHealth);
    const actual = this.health - before;
    
    if (actual > 0) {
      console.log(`💚 DEBUG: Player curado ${actual} HP`);
      
      // Emitir sonido de curación
    if (this.audioSystem) {
      // this.audioSystem.emitHealSound(); // Método no existe, comentado
    }  
    }
  }
}
