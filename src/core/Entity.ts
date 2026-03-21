import { Vector2 } from "../math/Vector2";

/**
 * Base para cualquier objeto en el mundo.
 */
export class Transform {
  public position: Vector2 = new Vector2();
  public velocity: Vector2 = new Vector2();
  public acceleration: Vector2 = new Vector2();
  public scale: Vector2 = new Vector2(1, 1);
  public rotation: number = 0; // en radianes
  public gravity: number = 900; // px/s^2
  public terminalVelocity: number = 600;
  public friction: number = 10;
  public isGrounded: boolean = false;
}

/**
 * Entidad base. Todos los objetos del juego heredan de aquí.
 */
export abstract class Entity {
  public transform: Transform = new Transform();
  public width: number = 32;
  public height: number = 32;
  public isVisible: boolean = true;
  public id: string;

  constructor(id: string) {
    this.id = id;
  }

  public abstract update(dt: number): void;
  public abstract render(ctx: CanvasRenderingContext2D): void;
}
