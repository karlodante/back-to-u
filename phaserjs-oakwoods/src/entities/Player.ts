import Phaser from "phaser";
import { Dash } from "../systems/Dash";
import { StateMachine } from "../core/StateMachine";
import { EventBus } from "../core/EventBus";

export class Player extends Phaser.Physics.Arcade.Sprite {
  public health: number = 100;
  public maxHealth: number = 100;
  public xp: number = 0;
  
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

    // Reset attack state when animation finishes
    this.on("animationcomplete", (anim: any) => {
      if (anim.key === "char-blue-attack") {
        this.fsm.change("idle");
      }
    });
  }

  private setupStateMachine() {
    this.fsm.add({
      name: "idle",
      enter: () => this.anims.play("char-blue-idle", true),
      update: () => {
        // Al update del jugador se le pasan cursors, etc. pero la FSM update dt
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
        this.setVelocityX(0);
        this.anims.play("char-blue-attack", true);
      }
    });

    this.fsm.change("idle");
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys, dashKey: Phaser.Input.Keyboard.Key, attackKey: Phaser.Input.Keyboard.Key): void {
    if (this.isDead) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    // Actualizar Cooldown del Dash
    this.dashSystem.update(this, 16.67);

    // Lógica de Dash (prioridad alta)
    if (Phaser.Input.Keyboard.JustDown(dashKey)) {
      this.dashSystem.tryDash(this, cursors.left.isDown ? -1 : (cursors.right.isDown ? 1 : 0));
    }

    if (this.isDashing) return;

    // Lógica de Ataque
    if (Phaser.Input.Keyboard.JustDown(attackKey) && body.blocked.down && this.fsm.getCurrentStateName() !== "attack") {
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

    // Salto
    if (cursors.up.isDown && body.blocked.down) {
      this.setVelocityY(-330);
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

  public takeDamage(amount: number): void {
    if (this.isDead || this.isInvulnerable || this.isDashing) return;

    this.health -= amount;
    EventBus.getInstance().emit("player_damage", this.health);
    
    if (this.health <= 0) {
      this.health = 0;
      this.die();
      return;
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

  public getDashCooldownProgress(): number {
    return Math.max(0, this.dashCooldown / this.dashSystem.cooldownTime);
  }
}
