import { EventBus } from "./EventBus";

/**
 * Sistema de Audio Centralizado
 * Proporciona hooks para agregar sonidos sin implementar audio real
 */
export class AudioSystem {
  private scene: Phaser.Scene;
  private sounds: Map<string, Phaser.Sound.BaseSound> = new Map();
  private masterVolume: number = 1.0;
  private sfxVolume: number = 0.8;
  private musicVolume: number = 0.6;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupAudioListeners();
  }

  /**
   * Configura los listeners para eventos de audio
   */
  private setupAudioListeners(): void {
    // Eventos del jugador
    EventBus.getInstance().on("player_jump", () => {
      this.playSFX("jump");
    });

    EventBus.getInstance().on("player_attack", () => {
      this.playSFX("attack");
    });

    EventBus.getInstance().on("player_damage", () => {
      this.playSFX("hurt");
    });

    EventBus.getInstance().on("player_death", () => {
      this.playSFX("death");
    });

    EventBus.getInstance().on("player_heal", () => {
      this.playSFX("heal");
    });

    EventBus.getInstance().on("player_dash", () => {
      this.playSFX("dash");
    });

    // Eventos de combate
    EventBus.getInstance().on("enemy_hit", () => {
      this.playSFX("enemy_hit");
    });

    EventBus.getInstance().on("enemy_death", () => {
      this.playSFX("enemy_death");
    });

    EventBus.getInstance().on("projectile_fire", () => {
      this.playSFX("shoot");
    });

    // Eventos de Pachita
    EventBus.getInstance().on("pachita_transformed", () => {
      this.playSFX("transform");
    });

    EventBus.getInstance().on("pachita_heal", () => {
      this.playSFX("pachita_heal");
    });

    // Eventos de UI
    EventBus.getInstance().on("ui_click", () => {
      this.playSFX("click");
    });

    EventBus.getInstance().on("ui_back", () => {
      this.playSFX("back");
    });

    // Eventos de juego
    EventBus.getInstance().on("level_up", () => {
      this.playSFX("level_up");
    });

    EventBus.getInstance().on("victory", () => {
      this.playSFX("victory");
    });

    EventBus.getInstance().on("game_over", () => {
      this.playSFX("game_over");
    });
  }

  /**
   * Carga un archivo de audio (placeholder para futuro)
   */
  public loadSound(key: string, path?: string): void {
    // Por ahora, solo registramos la clave
    // En el futuro: this.scene.load.audio(key, path);
  }

  /**
   * Reproduce un efecto de sonido
   */
  public playSFX(key: string, volume?: number): void {
    // Placeholder: emitir evento para debug
    console.log(`🔊 SFX: ${key}`);
    
    // En el futuro:
    // if (this.sounds.has(key)) {
    //   const sound = this.sounds.get(key)!;
    //   sound.setVolume(volume || this.sfxVolume);
    //   sound.play();
    // }
  }

  /**
   * Reproduce música de fondo
   */
  public playMusic(key: string, loop: boolean = true): void {
    console.log(`🎵 MUSIC: ${key}`);
    
    // En el futuro:
    // if (this.sounds.has(key)) {
    //   const music = this.sounds.get(key)!;
    //   music.setVolume(this.musicVolume);
    //   if (loop) music.setLoop(true);
    //   music.play();
    // }
  }

  /**
   * Detiene la música actual
   */
  public stopMusic(): void {
    console.log(`🔇 STOP MUSIC`);
    
    // En el futuro:
    // this.scene.sound.stopAll();
  }

  /**
   * Ajusta el volumen maestro
   */
  public setMasterVolume(volume: number): void {
    this.masterVolume = Phaser.Math.Clamp(volume, 0, 1);
    this.updateAllVolumes();
  }

  /**
   * Ajusta el volumen de SFX
   */
  public setSFXVolume(volume: number): void {
    this.sfxVolume = Phaser.Math.Clamp(volume, 0, 1);
    this.updateAllVolumes();
  }

  /**
   * Ajusta el volumen de música
   */
  public setMusicVolume(volume: number): void {
    this.musicVolume = Phaser.Math.Clamp(volume, 0, 1);
    this.updateAllVolumes();
  }

  /**
   * Actualiza los volúmenes de todos los sonidos cargados
   */
  private updateAllVolumes(): void {
    // En el futuro: iterar sobre los sonidos y actualizar volúmenes
    this.sounds.forEach((sound, key) => {
      // lógica para actualizar volumen según tipo
    });
  }

  /**
   * Emite evento de salto (para llamar desde el jugador)
   */
  public emitJumpSound(): void {
    EventBus.getInstance().emit("player_jump");
  }

  /**
   * Emite evento de ataque (para llamar desde el jugador)
   */
  public emitAttackSound(): void {
    EventBus.getInstance().emit("player_attack");
  }

  /**
   * Emite evento de dash (para llamar desde el jugador)
   */
  public emitDashSound(): void {
    EventBus.getInstance().emit("player_dash");
  }

  /**
   * Emite evento de click UI
   */
  public emitUIClick(): void {
    EventBus.getInstance().emit("ui_click");
  }

  /**
   * Obtiene información del sistema de audio
   */
  public getAudioInfo(): {
    masterVolume: number;
    sfxVolume: number;
    musicVolume: number;
    soundsLoaded: number;
  } {
    return {
      masterVolume: this.masterVolume,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      soundsLoaded: this.sounds.size
    };
  }
}
