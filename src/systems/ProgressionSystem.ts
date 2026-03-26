import { EventBus } from "../core/EventBus";
import { SaveSystem } from "../core/SaveSystem";
import { Player } from "../entities/Player";
import { Pachita } from "../entities/Pachita";

/**
 * Sistema de Progresión Centralizado
 * Maneja XP, niveles, guardado y recompensas
 */
export class ProgressionSystem {
  private player: Player;
  private pachita: Pachita;
  private scene: Phaser.Scene;
  
  // Tracking de recompensas para evitar duplicación
  private rewardedEnemyIds: Set<string> = new Set();

  constructor(scene: Phaser.Scene, player: Player, pachita: Pachita) {
    this.scene = scene;
    this.player = player;
    this.pachita = pachita;
  }

  /**
   * Inicializa el sistema cargando datos guardados
   */
  public initialize(): void {
    this.loadProgress();
    this.setupEventListeners();
  }

  /**
   * Carga la progresión guardada
   */
  private loadProgress(): void {
    const save = SaveSystem.load();
    if (save) {
      // XP consumible (curación) y XP total (niveles)
      const total = typeof save.pachitaTotalXp === "number" ? save.pachitaTotalXp : 
                   typeof save.pachitaXp === "number" ? save.pachitaXp : 0;
      const healXp = typeof save.pachitaXp === "number" ? save.pachitaXp : total;
      
      this.pachita.totalXp = total;
      this.pachita.xp = healXp;

      const level = typeof save.playerLevel === "number" ? save.playerLevel : this.pachita.getLevel();
      this.player.applyLevel(level);
    }
  }

  /**
   * Configura los event listeners para el sistema de progresión
   */
  private setupEventListeners(): void {
    const bus = EventBus.getInstance();
    
    // Escuchar eventos de muerte de enemigos
    bus.on("enemy_defeated", this.handleEnemyDefeated.bind(this));
    
    // Escuchar eventos de curación
    bus.on("pachita_heal", this.handlePachitaHeal.bind(this));
    
    // Escuchar eventos de daño al jugador
    bus.on("player_took_damage", this.handlePlayerDamage.bind(this));

    // Limpiar listeners al destruir la escena
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off("enemy_defeated", this.handleEnemyDefeated.bind(this));
      bus.off("pachita_heal", this.handlePachitaHeal.bind(this));
      bus.off("player_took_damage", this.handlePlayerDamage.bind(this));
    });
  }

  /**
   * Maneja la derrota de un enemigo
   */
  private handleEnemyDefeated(data?: any): void {
    const enemyId = String(data?.enemyId ?? "");
    const xp = typeof data?.xp === "number" ? data.xp : 0;
    
    if (!enemyId || xp <= 0) return;
    if (this.rewardedEnemyIds.has(enemyId)) return;

    this.rewardedEnemyIds.add(enemyId);
    const beforeLevel = this.player.getLevel();
    
    // Añadir XP a Pachita
    this.pachita.addXp(xp);
    const afterLevel = this.pachita.getLevel();
    
    // Verificar si subió de nivel
    if (afterLevel !== beforeLevel) {
      this.player.applyLevel(afterLevel);
      this.showLevelUpText();
    }
    
    // Guardar progreso
    this.saveProgress();
  }

  /**
   * Maneja el evento de curación de Pachita
   */
  private handlePachitaHeal(data?: any): void {
    const healAmount = typeof data?.healAmount === "number" ? data.healAmount : 0;
    if (healAmount <= 0) return;

    // Feedback visual de curación
    this.showHealText(healAmount);
    this.showHealIndicator();
  }

  /**
   * Maneja el evento de daño al jugador
   */
  private handlePlayerDamage(data?: any): void {
    const amount = typeof data?.amount === "number" ? data.amount : 0;
    if (amount <= 0) return;

    // Feedback visual de daño
    this.showDamageText(amount);
  }

  /**
   * Muestra texto flotante de curación
   */
  private showHealText(healAmount: number): void {
    const t = this.scene.add.text(
      this.player.x, 
      this.player.y - 40, 
      `+${healAmount} HP`, 
      {
        fontSize: "12px",
        color: "#7CFF00",
        fontFamily: "Arial Black",
        stroke: "#000000",
        strokeThickness: 2,
      }
    );
    t.setDepth(210);

    this.scene.tweens.add({
      targets: t,
      y: t.y - 18,
      alpha: 0,
      duration: 650,
      onComplete: () => t.destroy(),
    });
  }

  /**
   * Muestra texto flotante de daño
   */
  private showDamageText(amount: number): void {
    const t = this.scene.add.text(
      this.player.x, 
      this.player.y - 50, 
      `-${Math.ceil(amount)}`, 
      {
        fontSize: "12px",
        color: "#ff4d4d",
        fontFamily: "Arial Black",
        stroke: "#000000",
        strokeThickness: 2,
      }
    );
    t.setDepth(220);

    this.scene.tweens.add({
      targets: t,
      y: t.y - 22,
      alpha: 0,
      duration: 550,
      onComplete: () => t.destroy(),
    });
  }

  /**
   * Muestra indicador visual de curación
   */
  private showHealIndicator(): void {
    // Crear un círculo verde que se expande y desaparece
    const indicator = this.scene.add.circle(
      this.player.x, 
      this.player.y, 
      10, 
      0x7CFF00, 
      0.6
    );
    indicator.setDepth(205);

    this.scene.tweens.add({
      targets: indicator,
      radius: 25,
      alpha: 0,
      duration: 400,
      onComplete: () => indicator.destroy(),
    });
  }

  /**
   * Muestra texto de subida de nivel
   */
  private showLevelUpText(): void {
    const levelUpText = this.scene.add.text(
      this.player.x, 
      this.player.y - 60, 
      "LEVEL UP!", 
      {
        fontSize: "16px",
        color: "#ffff00",
        fontFamily: "Arial Black",
        stroke: "#000000",
        strokeThickness: 3,
      }
    );
    levelUpText.setDepth(230);

    this.scene.tweens.add({
      targets: levelUpText,
      y: levelUpText.y - 30,
      alpha: 0,
      duration: 1000,
      onComplete: () => levelUpText.destroy(),
    });

    // Screen shake más intenso para level up
    EventBus.getInstance().emit("screen_shake", { intensity: 0.04, duration: 200 });
  }

  /**
   * Guarda el progreso actual
   */
  public saveProgress(): void {
    SaveSystem.save({
      pachitaXp: this.pachita.xp,
      pachitaTotalXp: this.pachita.totalXp,
      playerLevel: this.player.getLevel(),
    });
  }

  /**
   * Procesa la transferencia de XP a vida
   */
  public transferXpToLife(): boolean {
    const success = this.pachita.transferXpToLife();
    if (success) {
      this.saveProgress();
    }
    return success;
  }

  /**
   * Obtiene estadísticas de progresión para debug
   */
  public getStats(): {
    pachitaXp: number;
    pachitaTotalXp: number;
    pachitaLevel: number;
    playerLevel: number;
    healProgress: number;
  } {
    return {
      pachitaXp: this.pachita.xp,
      pachitaTotalXp: this.pachita.totalXp,
      pachitaLevel: this.pachita.getLevel(),
      playerLevel: this.player.getLevel(),
      healProgress: this.pachita.xp / this.pachita.xpToHealCost
    };
  }

  /**
   * Limpia el sistema
   */
  public destroy(): void {
    this.rewardedEnemyIds.clear();
  }
}
