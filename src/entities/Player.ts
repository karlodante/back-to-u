import Phaser from "phaser";
import { Dash } from "../systems/Dash";
import { StateMachine } from "../core/StateMachine";
import { EventBus } from "../core/EventBus";

export class Player extends Phaser.Physics.Arcade.Sprite {
  public health: number = 100;
  public maxHealth: number = 100;
  public xp: number = 0; // Se mantiene pero se usa menos ahora
  public level: number = 1;
  public xpToNextLevel: number = 100;
  public attackDamage: number = 20;
  public skillPoints: number = 0;
  
  // Mascot System References
  public pet: any = null;
  
  // Combat Upgrade Properties
  private comboCount: number = 0;
  private attackId: number = 0; // ID único para cada instancia de ataque
  private lastAttackTime: number = 0;
  private readonly comboWindow: number = 800; // ms to continue combo
  private readonly attackCooldown: number = 400; // ms between attacks
  private isAttackingState: boolean = false;
  private attackHitbox!: Phaser.GameObjects.Rectangle;
  
  // Game Feel Improvements
  private coyoteTimer: number = 0;
  private readonly coyoteDuration: number = 150; // ms
  private jumpBufferTimer: number = 0;
  private readonly jumpBufferDuration: number = 150; // ms
  private wasOnGround: boolean = false;

  public isDashing: boolean = false;
  public dashCooldown: number = 0;
  private dashSystem: Dash;

  private fsm: StateMachine = new StateMachine();
  private isDead: boolean = false;
  private isInvulnerable: boolean = false;
  private invulnerabilityDuration: number = 1000;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "oakwoods-char-blue", 0);
    
    this.dashSystem = new Dash();
    
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setBounce(0);
    this.body?.setSize(20, 38);
    this.body?.setOffset(18, 16);
    this.setCollideWorldBounds(true);
    this.body?.setBoundsRectangle(new Phaser.Geom.Rectangle(0, 0, 999999, 180));

    this.setupStateMachine();

    // Create attack hitbox (invisible by default)
    this.attackHitbox = scene.add.rectangle(0, 0, 40, 40, 0xff0000, 0);
    scene.physics.add.existing(this.attackHitbox);
    (this.attackHitbox.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.attackHitbox.setActive(false).setVisible(false);

    // Reset attack state when animation finishes
    this.on("animationcomplete", (anim: any) => {
      if (anim.key.startsWith("char-blue-attack")) {
        this.isAttackingState = false;
        this.deactivateHitbox();
        
        // Wait a bit before allowing idle to see if next combo is pressed
        this.scene.time.delayedCall(100, () => {
          if (!this.isAttackingState) {
            this.fsm.change("idle");
          }
        });
      }
    });
  }

  private activateHitbox(): void {
    const isFacingLeft = this.flipX;
    const offsetX = isFacingLeft ? -30 : 30;
    this.attackHitbox.setPosition(this.x + offsetX, this.y);
    this.attackHitbox.setActive(true);
    
    // Emit event to scene for collision detection
    EventBus.getInstance().emit("player_attack_active", {
      hitbox: this.attackHitbox,
      damage: this.attackDamage,
      combo: this.comboCount,
      attackId: this.attackId,
      knockback: 150
    });
  }

  private deactivateHitbox(): void {
    this.attackHitbox.setActive(false);
    this.attackHitbox.setVisible(false);
  }

  private setupStateMachine() {
    this.fsm.add({
      name: "idle",
      enter: () => {
        this.anims.play("char-blue-idle", true);
        this.comboCount = 0; // Reset combo on idle
      }
    });

    this.fsm.add({
      name: "run",
      enter: () => this.anims.play("char-blue-run", true)
    });

    this.fsm.add({
      name: "jump",
      enter: () => this.anims.play("char-blue-jump", true)
    });

    this.fsm.add({
      name: "fall",
      enter: () => this.anims.play("char-blue-fall", true)
    });

    this.fsm.add({
      name: "attack",
      enter: () => {
        const now = Date.now();
        
        // Handle combo logic
        if (now - this.lastAttackTime < this.comboWindow) {
          this.comboCount = (this.comboCount % 3) + 1;
        } else {
          this.comboCount = 1;
        }
        
        this.attackId++; // Incrementar para que la escena sepa que es un nuevo ataque
        this.lastAttackTime = now;
        this.isAttackingState = true;
        this.setVelocityX(0);
        
        // Play corresponding animation based on combo count
        const animKey = `char-blue-attack${this.comboCount}`;
        // Since we don't have multiple attack animations yet, we'll use the existing one
        // and add a small color tint to distinguish the combo stage
        this.anims.play("char-blue-attack", true);
        
        // Hitbox active only during attack
        this.scene.time.delayedCall(100, () => {
          if (this.isAttackingState) {
            this.activateHitbox();
          }
        });
      }
    });

    this.fsm.change("idle");
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys, dashKey: Phaser.Input.Keyboard.Key, attackKey: Phaser.Input.Keyboard.Key, hugKey?: Phaser.Input.Keyboard.Key, petSkillKey?: Phaser.Input.Keyboard.Key): void {
    if (this.isDead) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const now = Date.now();

    // === GAME FEEL: COYOTE TIME & JUMP BUFFER ===
    const isOnGround = body.blocked.down;
    
    if (isOnGround) {
      this.coyoteTimer = now + this.coyoteDuration;
      this.wasOnGround = true;
    } else if (this.wasOnGround) {
      // Si acabamos de dejar el suelo, mantenemos el timer activo
      this.wasOnGround = false;
    }

    if (Phaser.Input.Keyboard.JustDown(cursors.up)) {
      this.jumpBufferTimer = now + this.jumpBufferDuration;
    }

    // Lógica de "Abrazo" al gato para curarse
    if (hugKey && Phaser.Input.Keyboard.JustDown(hugKey) && this.pet) {
      this.hugPet();
    }

    // Lógica de Habilidad Especial del gato
    if (petSkillKey && Phaser.Input.Keyboard.JustDown(petSkillKey) && this.pet) {
      this.pet.activateCombatMode();
    }
    if (!body) return;

    // Actualizar Cooldown del Dash
    this.dashSystem.update(this, 16.67);

    // Lógica de Dash (prioridad alta)
    if (Phaser.Input.Keyboard.JustDown(dashKey)) {
      this.dashSystem.tryDash(this, cursors.left.isDown ? -1 : (cursors.right.isDown ? 1 : 0));
    }

    if (this.isDashing) return;

    // Lógica de Ataque
    const canAttack = now - this.lastAttackTime > this.attackCooldown;
    
    if (Phaser.Input.Keyboard.JustDown(attackKey) && body.blocked.down && canAttack) {
      this.fsm.change("attack");
    }

    if (this.fsm.getCurrentStateName() === "attack") return;

    // Movimiento Horizontal
    let dx = 0;
    if (cursors.left.isDown) {
      dx = -1;
      this.setFlipX(true);
    } else if (cursors.right.isDown) {
      dx = 1;
      this.setFlipX(false);
    }

    const speed = 160;
    this.setVelocityX(dx * speed);

    // Lógica de Salto
    const canJump = now < this.coyoteTimer;
    const isBufferedJump = now < this.jumpBufferTimer;

    if (isBufferedJump && canJump && this.fsm.getCurrentStateName() !== "attack") {
      this.setVelocityY(-400);
      this.fsm.change("jump");
      this.coyoteTimer = 0; // Reset para evitar doble salto
      this.jumpBufferTimer = 0;
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

    this.fsm.update(16.67 / 1000);
  }

  public takeDamage(amount: number, knockbackX: number = 0): void {
    if (this.isDead || this.isInvulnerable || this.isDashing) return;

    this.health -= amount;
    EventBus.getInstance().emit("player_damage", this.health);
    
    // Screen Shake al recibir daño
    this.scene.cameras.main.shake(200, 0.01);

    if (this.health <= 0) {
      this.health = 0;
      this.die();
      return;
    }
    
    // Aplicar Knockback
    if (knockbackX !== 0) {
      this.setVelocityX(knockbackX);
      this.setVelocityY(-150);
    }

    this.isInvulnerable = true;
    
    this.scene.tweens.add({
      targets: this,
      alpha: 0.2,
      duration: 100,
      ease: "Linear",
      repeat: 5,
      yoyo: true,
      onComplete: () => {
        this.setAlpha(1);
        this.isInvulnerable = false;
      }
    });

    this.setTint(0xff0000);
    this.scene.time.delayedCall(200, () => {
      this.clearTint();
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

  public getIsInvulnerable(): boolean {
    return this.isInvulnerable;
  }

  public getComboCount(): number {
    return this.comboCount;
  }

  public getAttackId(): number {
    return this.attackId;
  }

  public getAttackHitbox(): Phaser.GameObjects.Rectangle {
    return this.attackHitbox;
  }

  public getDashCooldownProgress(): number {
    return Math.max(0, this.dashCooldown / this.dashSystem.cooldownTime);
  }

  public setPet(pet: any) {
    this.pet = pet;
  }

  private hugPet() {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.pet.x, this.pet.y);
    if (dist < 50) {
      const healAmount = this.pet.transferXPToHealth();
      if (healAmount > 0) {
        this.health = Math.min(this.maxHealth, this.health + healAmount);
        EventBus.getInstance().emit("player_damage", this.health);
        
        // Efecto visual de curación
        this.setTint(0x00ffff);
        this.scene.time.delayedCall(200, () => this.clearTint());
        
        // Texto flotante de curación
        const healText = this.scene.add.text(this.x, this.y - 20, `+${healAmount} HP`, {
          fontSize: "12px",
          color: "#00ffff",
          stroke: "#000000",
          strokeThickness: 2
        }).setOrigin(0.5);
        
        this.scene.tweens.add({
          targets: healText,
          y: this.y - 50,
          alpha: 0,
          duration: 1000,
          onComplete: () => healText.destroy()
        });
      }
    }
  }

  public addXP(amount: number): void {
    // Redirigir XP al gato si existe
    if (this.pet) {
      this.pet.addXP(amount);
      return;
    }
  }

  private levelUp(): void {
    this.level++;
    this.xp -= this.xpToNextLevel;
    this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
    this.skillPoints++;
    
    // Mejorar estadísticas básicas
    this.maxHealth += 20;
    this.health = this.maxHealth;
    this.attackDamage += 5;

    EventBus.getInstance().emit("player_level_up", { 
      level: this.level, 
      maxHealth: this.maxHealth,
      xpToNextLevel: this.xpToNextLevel
    });

    // Efecto visual de Level Up
    this.setTint(0x00ff00);
    this.scene.time.delayedCall(500, () => this.clearTint());

    // Texto flotante de Level Up
    const levelText = this.scene.add.text(this.x, this.y - 40, "LEVEL UP!", {
      fontSize: "16px",
      color: "#ffff00",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: levelText,
      y: this.y - 80,
      alpha: 0,
      duration: 1000,
      onComplete: () => levelText.destroy()
    });
    
    console.log(`¡Level Up! Nivel: ${this.level}`);
  }

  public upgradeSkill(skillType: string): void {
    if (this.skillPoints <= 0) return;

    if (skillType === "damage") {
      this.attackDamage += 10;
      this.skillPoints--;
    } else if (skillType === "health") {
      this.maxHealth += 50;
      this.health = this.maxHealth;
      this.skillPoints--;
    }
    
    EventBus.getInstance().emit("player_skill_upgraded", {
      skillPoints: this.skillPoints,
      attackDamage: this.attackDamage,
      maxHealth: this.maxHealth
    });
  }
}
