/**
 * Estructura de un frame de animación.
 */
export interface AnimationFrame {
  index: number;
  duration: number; // en segundos
}

/**
 * Configuración de una animación completa.
 */
export interface AnimationConfig {
  name: string;
  frames: AnimationFrame[];
  loop: boolean;
}

/**
 * Sistema de Animación desacoplado. 
 * Maneja el tiempo y el índice del frame actual.
 */
export class Animator {
  private animations: Map<string, AnimationConfig> = new Map();
  private currentAnimation: AnimationConfig | null = null;
  private currentFrameIndex: number = 0;
  private elapsedTime: number = 0;
  private isPlaying: boolean = false;

  add(config: AnimationConfig) {
    this.animations.set(config.name, config);
  }

  play(name: string) {
    if (this.currentAnimation?.name === name) return;

    const anim = this.animations.get(name);
    if (anim) {
      this.currentAnimation = anim;
      this.currentFrameIndex = 0;
      this.elapsedTime = 0;
      this.isPlaying = true;
    }
  }

  update(dt: number) {
    if (!this.isPlaying || !this.currentAnimation) return;

    this.elapsedTime += dt;

    const currentFrame = this.currentAnimation.frames[this.currentFrameIndex];
    if (this.elapsedTime >= currentFrame.duration) {
      this.elapsedTime = 0;
      this.currentFrameIndex++;

      if (this.currentFrameIndex >= this.currentAnimation.frames.length) {
        if (this.currentAnimation.loop) {
          this.currentFrameIndex = 0;
        } else {
          this.currentFrameIndex = this.currentAnimation.frames.length - 1;
          this.isPlaying = false;
        }
      }
    }
  }

  getCurrentFrameIndex(): number {
    return this.currentAnimation ? this.currentAnimation.frames[this.currentFrameIndex].index : 0;
  }

  getCurrentAnimationName(): string {
    return this.currentAnimation?.name || "";
  }
}
