/**
 * Clase para manejar vectores 2D y operaciones básicas.
 */
export class Vector2 {
  constructor(public x: number = 0, public y: number = 0) {}

  add(v: Vector2): Vector2 {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v: Vector2): Vector2 {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  mul(n: number): Vector2 {
    this.x *= n;
    this.y *= n;
    return this;
  }

  div(n: number): Vector2 {
    if (n !== 0) {
      this.x /= n;
      this.y /= n;
    }
    return this;
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2 {
    const mag = this.magnitude();
    if (mag > 0) {
      this.div(mag);
    }
    return this;
  }

  copy(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  static distance(v1: Vector2, v2: Vector2): number {
    return Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2);
  }
}
