import { Entity } from "../core/Entity";
import { InputManager } from "../input/InputManager";
import { Vector2 } from "../math/Vector2";
import { Animator } from "../systems/AnimationSystem";
import { StateMachine } from "../core/StateMachine";
import { EventBus } from "../core/EventBus";

import { Tilemap } from "../core/Tilemap";

/**
 * Entidad del Jugador refactorizada con FSM.
 */
export class CustomPlayer extends Entity {
  public speed: number = 200;
  public health: number = 100;
  public maxHealth: number = 100;
  public xp: number = 0;
  
  private animator: Animator = new Animator();
  private fsm: StateMachine = new StateMachine();
  private dashCooldown: number = 0;

  constructor(id: string) {
    super(id);
    this.transform.position = new Vector2(100, 100);
    this.width = 32;
    this.height = 32;

    this.setupAnimations();
    this.setupStateMachine();
  }

  private setupAnimations() {
    this.animator.add({ name: "idle", loop: true, frames: [{ index: 0, duration: 0.1 }] });
    this.animator.add({ name: "run", loop: true, frames: [{ index: 1, duration: 0.1 }] });
    this.animator.add({ name: "dash", loop: false, frames: [{ index: 2, duration: 0.2 }] });
  }

  private setupStateMachine() {
    // Estado IDLE
    this.fsm.add({
      name: "idle",
      enter: () => this.animator.play("idle"),
      update: () => {
        if (InputManager.getHorizontal() !== 0 || InputManager.getVertical() !== 0) {
          this.fsm.change("run");
        }
        if (InputManager.isPressed(" ")) this.fsm.change("dash");
        
        // Salto
        if ((InputManager.isPressed("ArrowUp") || InputManager.isPressed("w")) && this.transform.isGrounded) {
          this.transform.velocity.y = -400;
        }
      }
    });

    // Estado RUN
    this.fsm.add({
      name: "run",
      enter: () => this.animator.play("run"),
      update: (dt) => {
        const moveX = InputManager.getHorizontal();
        const moveY = InputManager.getVertical();
        
        if (moveX === 0 && moveY === 0) {
          this.fsm.change("idle");
          return;
        }

        const moveDir = new Vector2(moveX, moveY).normalize();
        this.transform.velocity.x = moveDir.x * this.speed;

        if (InputManager.isPressed(" ")) this.fsm.change("dash");

        // Salto
        if ((InputManager.isPressed("ArrowUp") || InputManager.isPressed("w")) && this.transform.isGrounded) {
          this.transform.velocity.y = -400;
        }
      }
    });

    // Estado DASH
    this.fsm.add({
      name: "dash",
      enter: () => {
        this.animator.play("dash");
        const moveX = InputManager.getHorizontal();
        const moveY = InputManager.getVertical();
        const dashDir = (moveX !== 0 || moveY !== 0) ? new Vector2(moveX, moveY).normalize() : new Vector2(1, 0);
        
        this.transform.velocity.x = dashDir.x * 1000;
        this.transform.velocity.y = dashDir.y * 1000;
        
        EventBus.getInstance().emit("player_dash");
        
        // Volver a idle después de un breve momento
        setTimeout(() => this.fsm.change("idle"), 200);
      }
    });

    this.fsm.change("idle");
  }

  update(dt: number, tilemap?: Tilemap) {
    this.applyPhysics(dt, tilemap);
    this.fsm.update(dt);
    this.animator.update(dt);
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
  }

  private applyPhysics(dt: number, tilemap?: Tilemap) {
    const t = this.transform;

    // 1. Aplicar Gravedad
    if (!t.isGrounded) {
      t.velocity.y += t.gravity * dt;
    }

    // 2. Limitar Velocidad Terminal
    if (Math.abs(t.velocity.y) > t.terminalVelocity) {
      t.velocity.y = Math.sign(t.velocity.y) * t.terminalVelocity;
    }

    // 3. Aplicar Fricción
    const friction = t.isGrounded ? t.friction : t.friction * 0.2;
    t.velocity.x -= t.velocity.x * friction * dt;

    if (Math.abs(t.velocity.x) < 1) t.velocity.x = 0;
    if (Math.abs(t.velocity.y) < 1) t.velocity.y = 0;

    // 4. Actualizar Posición
    t.position.x += t.velocity.x * dt;
    t.position.y += t.velocity.y * dt;

    // 5. Colisiones con Tilemap
    if (tilemap) {
      tilemap.resolveCollision(this);
    } else {
      // Simular Suelo por defecto si no hay tilemap
      if (t.position.y >= 500) {
        t.position.y = 500;
        t.velocity.y = 0;
        t.isGrounded = true;
      } else {
        t.isGrounded = false;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.fsm.getCurrentStateName() === "dash" ? "#00ffff" : "#0000ff";
    ctx.fillRect(this.transform.position.x, this.transform.position.y, this.width, this.height);
  }

  takeDamage(amount: number) {
    this.health -= amount;
    EventBus.getInstance().emit("player_damage", this.health);
    if (this.health <= 0) this.die();
  }

  private die() {
    EventBus.getInstance().emit("player_death");
  }

  public getDashCooldownProgress(): number {
    return Math.max(0, this.dashCooldown);
  }
}
