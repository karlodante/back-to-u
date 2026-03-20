/**
 * Estructura de escena base. Todas las escenas heredan de aquí.
 */
export abstract class Scene {
  public abstract init(): void;
  public abstract update(dt: number): void;
  public abstract render(ctx: CanvasRenderingContext2D): void;
  public abstract cleanup(): void;
}

/**
 * Gestor de escenas: maneja el cambio y la pila de escenas.
 */
export class SceneManager {
  private currentScene: Scene | null = null;
  private scenes: Map<string, Scene> = new Map();

  constructor(private ctx: CanvasRenderingContext2D) {}

  add(name: string, scene: Scene) {
    this.scenes.set(name, scene);
  }

  change(name: string) {
    if (this.currentScene) {
      this.currentScene.cleanup();
    }

    const nextScene = this.scenes.get(name);
    if (nextScene) {
      this.currentScene = nextScene;
      this.currentScene.init();
    } else {
      console.error(`La escena "${name}" no existe.`);
    }
  }

  update(dt: number) {
    if (this.currentScene) {
      this.currentScene.update(dt);
    }
  }

  render(dt: number) {
    if (this.currentScene) {
      this.currentScene.render(this.ctx);
    }
  }
}
