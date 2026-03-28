import Phaser from "phaser";
import { Player } from "./Player";
import { EventBus } from "../core/EventBus";

/**
 * Pachita (mascota) - almacena XP y puede convertir XP en curación.
 * Ahora con modo de transformación para combate.
 */
export class Pachita {
  public xp: number = 0;
  // XP total acumulado para progresión (niveles). No se consume al curar.
  public totalXp: number = 0;
  public maxHp: number = 50;
  public hp: number = 50;

  // Cuando `xp` llega a este valor, puede convertirse en curación.
  public readonly xpToHealCost: number = 25;
  public readonly healAmount: number = 20;

  // Configuración de niveles (placeholder, lista para ajustar luego).
  private readonly xpPerLevel: number = 100;

  // Sistema de transformación
  private readonly transformXpCost: number = 50;
  private isTransformed: boolean = false;
  private transformDurationMs: number = 8000; // 8 segundos
  private transformStartMs: number = 0;
  private transformCooldownMs: number = 15000; // 15 segundos de cooldown
  private lastTransformMs: number = 0;

  private sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private player: Player;
  private scene: Phaser.Scene;

  private offsetX: number = 14;
  // Offset para colocar Pachita cerca de los "pies" del jugador.
  private offsetY: number = 22;
  private followLerp: number = 0.35; // Aumentado para mejor seguimiento

  private lastHealAtMs: number = 0;
  private healCooldownMs: number = 250;

  // Para mantener la mascota "en el piso" cuando el jugador salta.
  private lastGroundY: number | null = null;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;

    // Pachita sigue usando su sprite original (círculo amarillo)
    console.log("🐱 DEBUG: Pachita usando sprite original (círculo amarillo)");
    
    // Sprite original de Pachita
    this.sprite = this.scene.add
      .circle(player.x + this.offsetX, player.y + this.offsetY, 6, 0xffd34d, 1)
      .setStrokeStyle(2, 0x3a2a00, 1);
    
    this.sprite.setDepth(10);
  }

  update(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = !!body?.blocked.down;
    
    // Mejorar seguimiento: cuando está transformada, seguir más agresivamente
    const currentLerp = this.isTransformed ? 0.6 : this.followLerp;
    
    // Offset dinámico: cuando salta, mantener altura; cuando corre, moverse más
    let targetY = grounded
      ? (this.lastGroundY = this.player.y + this.offsetY)
      : (this.lastGroundY ?? this.player.y + this.offsetY);

    // Cuando está transformada, flotar más arriba
    if (this.isTransformed) {
      targetY -= 15;
    }

    const targetX = this.player.x + this.offsetX;
    
    // Seguimiento suave pero responsivo
    this.sprite.x += (targetX - this.sprite.x) * currentLerp;
    this.sprite.y += (targetY - this.sprite.y) * currentLerp;

    // Actualizar transformación
    this.updateTransform();

    // Actualizar apariencia según estado
    this.updateAppearance();

    // Debug para seguimiento
    if (Math.random() < 0.02) { // 2% de veces para no spam
      console.log("🐱 Pachita siguiendo:", {
        targetX: Math.round(targetX),
        targetY: Math.round(targetY),
        currentX: Math.round(this.sprite.x),
        currentY: Math.round(this.sprite.y),
        lerp: currentLerp,
        transformed: this.isTransformed,
        grounded: grounded
      });
    }
  }

  private updateTransform(): void {
    if (!this.isTransformed) return;

    const now = this.scene.time.now;
    if (now - this.transformStartMs >= this.transformDurationMs) {
      this.deactivateTransform();
    }
  }

  private updateAppearance(): void {
    if (this.sprite instanceof Phaser.GameObjects.Arc) {
      // Solo si es un círculo (fallback)
      if (this.isTransformed) {
        // Modo transformado: más grande, color rojo/naranja
        this.sprite.setRadius(10);
        this.sprite.setFillStyle(0xff6b35, 1);
        this.sprite.setStrokeStyle(3, 0xff0000, 1);
      } else {
        // Modo normal
        this.sprite.setRadius(6);
        this.sprite.setFillStyle(0xffd34d, 1);
        this.sprite.setStrokeStyle(2, 0x3a2a00, 1);
      }
    } else if (this.sprite instanceof Phaser.GameObjects.Image) {
      // Para sprite Abby, usar diferentes sprites según estado
      if (!this.scene.textures.exists('abby_idle')) return;
      
      let targetSprite = 'abby_idle'; // Default
      
      if (this.isTransformed) {
        // Modo transformado: usar sprite de ataque
        targetSprite = 'abby_run'; // Usar run como "transformado"
      } else {
        // Modo normal: usar idle o walk según movimiento
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isMoving = Math.abs(playerBody.velocity.x) > 10;
        targetSprite = isMoving ? 'abby_walk' : 'abby_idle';
      }
      
      // Solo cambiar si es diferente
      if (this.sprite.texture.key !== targetSprite) {
        console.log(`🎭 DEBUG: Cambiando sprite Abby: ${this.sprite.texture.key} → ${targetSprite}`);
        this.sprite.setTexture(targetSprite);
      }
      
      // Ajustar tamaño según transformación
      if (this.isTransformed) {
        this.sprite.setDisplaySize(20, 20); // Más grande
      } else {
        this.sprite.setDisplaySize(12, 12); // Normal
      }
    }
  }

  addXp(amount: number): void {
    if (amount <= 0) return;
    this.xp += amount;
    this.totalXp += amount;
    EventBus.getInstance().emit("pachita_xp_changed", { xp: this.xp });
  }

  /**
   * Convierte XP acumulado en curación al jugador.
   * Devuelve `true` si la conversión ocurrió.
   */
  transferXpToLife(): boolean {
    const now = this.scene.time.now;
    if (now - this.lastHealAtMs < this.healCooldownMs) return false;

    if (this.xp < this.xpToHealCost) return false;

    this.xp -= this.xpToHealCost; // La XP para nivel NO se consume
    this.lastHealAtMs = now;

    this.player.heal(this.healAmount);
    EventBus.getInstance().emit("pachita_heal", {
      xpRemaining: this.xp,
      healAmount: this.healAmount,
    });

    return true;
  }

  /**
   * Transforma a Pachita en modo de combate poderoso
   */
  transform(): boolean {
    const now = this.scene.time.now;
    
    // Verificar cooldown
    if (now - this.lastTransformMs < this.transformCooldownMs) {
      return false;
    }

    // Verificar XP suficiente
    if (this.xp < this.transformXpCost) {
      return false;
    }

    // Activar transformación
    this.isTransformed = true;
    this.transformStartMs = now;
    this.lastTransformMs = now;
    this.xp -= this.transformXpCost;

    // Feedback visual y efectos
    this.showTransformEffect();
    
    // Emitir evento para otros sistemas
    EventBus.getInstance().emit("pachita_transformed", { 
      duration: this.transformDurationMs,
      isTransformed: true 
    });

    // Screen shake potente
    EventBus.getInstance().emit("screen_shake", { intensity: 0.06, duration: 300 });

    return true;
  }

  private deactivateTransform(): void {
    this.isTransformed = false;
    
    // Emitir evento
    EventBus.getInstance().emit("pachita_transformed", { 
      isTransformed: false 
    });

    // Feedback visual
    this.showDeactivateEffect();
  }

  private showTransformEffect(): void {
    // Efecto de explosión de energía
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const particle = this.scene.add.circle(
        this.sprite.x, 
        this.sprite.y, 
        4, 
        0xff6b35, 
        0.8
      );
      particle.setDepth(15);

      this.scene.tweens.add({
        targets: particle,
        x: particle.x + Math.cos(angle) * 30,
        y: particle.y + Math.sin(angle) * 30,
        radius: 0,
        alpha: 0,
        duration: 400,
        onComplete: () => particle.destroy(),
      });
    }
  }

  private showDeactivateEffect(): void {
    // Efecto de desvanecimiento
    const fadeEffect = this.scene.add.circle(
      this.sprite.x, 
      this.sprite.y, 
      15, 
      0xffd34d, 
      0.4
    );
    fadeEffect.setDepth(14);

    this.scene.tweens.add({
      targets: fadeEffect,
      radius: 25,
      alpha: 0,
      duration: 600,
      onComplete: () => fadeEffect.destroy(),
    });
  }

  public getLevel(): number {
    return 1 + Math.floor(this.totalXp / this.xpPerLevel);
  }

  public getXpProgressToNext(): { current: number; required: number; percent: number } {
    const level = this.getLevel();
    const levelStartXp = (level - 1) * this.xpPerLevel;
    const current = this.totalXp - levelStartXp;
    const required = this.xpPerLevel;
    const percent = required > 0 ? current / required : 0;
    return { current, required, percent: Phaser.Math.Clamp(percent, 0, 1) };
  }

  /**
   * Verifica si puede transformarse
   */
  public canTransform(): boolean {
    const now = this.scene.time.now;
    return !this.isTransformed && 
           this.xp >= this.transformXpCost && 
           (now - this.lastTransformMs >= this.transformCooldownMs);
  }

  /**
   * Obtiene información de la transformación para UI
   */
  public getTransformInfo(): {
    isTransformed: boolean;
    canTransform: boolean;
    xpCost: number;
    cooldownProgress: number;
    timeRemaining: number;
  } {
    const now = this.scene.time.now;
    let timeRemaining: number;
    let cooldownProgress: number;

    if (this.isTransformed) {
      // Cuando está transformado, el tiempo restante es de la duración
      const elapsed = now - this.transformStartMs;
      timeRemaining = Math.max(0, this.transformDurationMs - elapsed);
      cooldownProgress = elapsed / this.transformDurationMs;
    } else {
      // Cuando no está transformado, el tiempo restante es del cooldown
      const cooldownElapsed = now - this.lastTransformMs;
      timeRemaining = Math.max(0, this.transformCooldownMs - cooldownElapsed);
      cooldownProgress = Math.min(1, cooldownElapsed / this.transformCooldownMs);
    }

    return {
      isTransformed: this.isTransformed,
      canTransform: this.canTransform(),
      xpCost: this.transformXpCost,
      cooldownProgress,
      timeRemaining
    };
  }

  /**
   * Verifica si está en modo transformado (para otros sistemas)
   */
  public isInTransformedMode(): boolean {
    return this.isTransformed;
  }
}

