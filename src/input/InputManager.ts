/**
 * Maneja las entradas del teclado.
 */
export class InputManager {
  private static keys: Map<string, boolean> = new Map();

  static init() {
    window.addEventListener("keydown", (e) => this.keys.set(e.key, true));
    window.addEventListener("keyup", (e) => this.keys.set(e.key, false));
  }

  static isPressed(key: string): boolean {
    return this.keys.get(key) || false;
  }

  static getHorizontal(): number {
    let x = 0;
    if (this.isPressed("ArrowLeft") || this.isPressed("a")) x -= 1;
    if (this.isPressed("ArrowRight") || this.isPressed("d")) x += 1;
    return x;
  }

  static getVertical(): number {
    let y = 0;
    if (this.isPressed("ArrowUp") || this.isPressed("w")) y -= 1;
    if (this.isPressed("ArrowDown") || this.isPressed("s")) y += 1;
    return y;
  }
}
