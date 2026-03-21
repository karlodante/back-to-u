/**
 * El corazón del juego: maneja el tiempo y las actualizaciones.
 */
export class GameLoop {
  private lastTime: number = 0;
  private accumTime: number = 0;
  private readonly fixedDeltaTime: number = 1 / 60; // 60 FPS fijos para física
  private running: boolean = false;

  constructor(
    private update: (dt: number) => void,
    private render: (dt: number) => void
  ) {}

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
  }

  private loop = (currentTime: number) => {
    if (!this.running) return;

    // Delta time en segundos
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Limitar delta máximo para evitar saltos gigantes (ej. al cambiar de pestaña)
    this.accumTime += Math.min(deltaTime, 0.25);

    // Actualizaciones fijas (Física y lógica crítica)
    while (this.accumTime >= this.fixedDeltaTime) {
      this.update(this.fixedDeltaTime);
      this.accumTime -= this.fixedDeltaTime;
    }

    // Renderizado (con interpolación si se desea)
    this.render(deltaTime);

    requestAnimationFrame(this.loop);
  };
}
