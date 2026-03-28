import { Entity } from "../core/Entity";
import { Vector2 } from "../math/Vector2";
import { CustomPlayer } from "./CustomPlayer";
import { CombatSystem } from "../systems/CombatSystem";
import { StateMachine } from "../core/StateMachine";

export enum EnemyState {
  IDLE,
  PATROL,
  CHASE,
  ATTACK,
}

import { Tilemap } from "../core/Tilemap";

/**
 * Clase base para enemigos con IA avanzada usando FSM.
 */
export class BasicEnemy extends Entity {
  public speed: number = 100;
  public chaseRange: number = 200;
  public attackRange: number = 40;
  public health: number = 50;
  public maxHealth: number = 50;

  private fsm: StateMachine = new StateMachine();
  private patrolPoints: Vector2[] = [];
  private currentPatrolIndex: number = 0;
  private target: CustomPlayer | null = null;

  constructor(id: string, patrolPoints: Vector2[]) {
    super(id);
    this.patrolPoints = patrolPoints;
    this.transform.position = patrolPoints[0].copy();
    this.width = 32;
    this.height = 32;

    this.setupStateMachine();
  }

  private setupStateMachine() {
    // Estado IDLE
    this.fsm.add({
      name: "idle",
      update: (dt) => {
        if (!this.target) return;
        const dist = Vector2.distance(this.transform.position, this.target.transform.position);
        if (dist < this.chaseRange) this.fsm.change("chase");
        else if (Math.random() < 0.01) this.fsm.change("patrol");
      }
    });

    // Estado PATROL
    this.fsm.add({
      name: "patrol",
      enter: () => {
        // Al entrar en patrulla, elegir un punto de patrulla aleatorio
        this.currentPatrolIndex = Math.floor(Math.random() * this.patrolPoints.length);
      },
      update: (dt) => {
        if (!this.target) return;
        const distToPlayer = Vector2.distance(this.transform.position, this.target.transform.position);
        
        // Perseguir si el jugador entra en el rango
        if (distToPlayer < this.chaseRange) {
          this.fsm.change("chase");
          return;
        }

        const targetPatrol = this.patrolPoints[this.currentPatrolIndex];
        const distToPatrol = Vector2.distance(this.transform.position, targetPatrol);

        // Si llega al punto de patrulla, esperar un poco (idle) antes de ir al siguiente
        if (distToPatrol < 5) {
          this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
          this.fsm.change("idle");
          return;
        }

        const moveDir = new Vector2(targetPatrol.x - this.transform.position.x, targetPatrol.y - this.transform.position.y).normalize();
        this.transform.velocity.x = moveDir.x * this.speed * 0.5;
      }
    });

    // Estado CHASE
    this.fsm.add({
      name: "chase",
      update: (dt) => {
        if (!this.target) return;
        const dist = Vector2.distance(this.transform.position, this.target.transform.position);
        
        // Atacar si está muy cerca
        if (dist < this.attackRange) {
          this.fsm.change("attack");
          return;
        }
        
        // Volver a patrulla si el jugador se aleja demasiado (pérdida de rastro)
        if (dist > this.chaseRange * 1.8) {
          this.fsm.change("patrol");
          return;
        }

        const moveDir = new Vector2(this.target.transform.position.x - this.transform.position.x, this.target.transform.position.y - this.transform.position.y).normalize();
        this.transform.velocity.x = moveDir.x * this.speed;
      }
    });

    // Estado ATTACK
    this.fsm.add({
      name: "attack",
      update: (dt) => {
        if (!this.target) return;
        const dist = Vector2.distance(this.transform.position, this.target.transform.position);
        
        if (dist > this.attackRange * 1.2) {
          this.fsm.change("chase");
          return;
        }

        // Aplicar daño (usando el CombatSystem)
        CombatSystem.dealDamage(this, this.target, 5 * dt, 100);
      }
    });

    this.fsm.change("patrol");
  }

  setTarget(player: CustomPlayer) {
    this.target = player;
  }

  update(dt: number, tilemap?: Tilemap) {
    if (!this.target) return;

    this.applyPhysics(dt, tilemap);
    this.fsm.update(dt);
  }

  private applyPhysics(dt: number, tilemap?: Tilemap) {
    const t = this.transform;

    // Gravedad
    if (!t.isGrounded) {
      t.velocity.y += t.gravity * dt;
    }

    // Fricción
    const friction = t.isGrounded ? t.friction : t.friction * 0.1;
    t.velocity.x -= t.velocity.x * friction * dt;

    if (Math.abs(t.velocity.x) < 1) t.velocity.x = 0;
    if (Math.abs(t.velocity.y) < 1) t.velocity.y = 0;

    t.position.x += t.velocity.x * dt;
    t.position.y += t.velocity.y * dt;

    // Simulación de suelo
    if (tilemap) {
      tilemap.resolveCollision(this);
    } else {
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
    const stateName = this.fsm.getCurrentStateName();
    ctx.fillStyle = stateName === "chase" ? "orange" : (stateName === "attack" ? "red" : "gray");
    ctx.fillRect(this.transform.position.x, this.transform.position.y, this.width, this.height);
    
    // Vida del enemigo
    ctx.fillStyle = "black";
    ctx.fillRect(this.transform.position.x, this.transform.position.y - 10, this.width, 4);
    ctx.fillStyle = "red";
    ctx.fillRect(this.transform.position.x, this.transform.position.y - 10, this.width * (this.health / this.maxHealth), 4);
  }
}
