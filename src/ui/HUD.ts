import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Pachita } from "../entities/Pachita";

export class HUD {
  private scene: Phaser.Scene;
  private player: Player;
  private pachita: Pachita;
  private healthText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private transformText!: Phaser.GameObjects.Text;
  private healthBar!: Phaser.GameObjects.Graphics;
  private xpBar!: Phaser.GameObjects.Graphics;
  private transformBar!: Phaser.GameObjects.Graphics;
  // Importante: no re-escalamos manualmente con `scaleFactor`.
  // El renderer ya escala el canvas en modo `FIT`, y estos valores viven en "unidades de juego".
  private barWidth: number = 86;
  private barHeight: number = 8;
  private xpBarWidth: number = 86;
  private xpBarHeight: number = 7;
  private transformBarWidth: number = 86;
  private transformBarHeight: number = 6;

  constructor(scene: Phaser.Scene, player: Player, pachita: Pachita) {
    this.scene = scene;
    this.player = player;
    this.pachita = pachita;
    this.createHUD();
  }

  private createHUD(): void {
    // Health Bar Container
    this.healthBar = this.scene.add.graphics();
    this.healthBar.setScrollFactor(0).setDepth(100);

    // Health Text (numérico para legibilidad)
    this.healthText = this.scene.add.text(10, 2, "HP: 100/100", {
      fontSize: "12px",
      color: "#ffffff",
      fontFamily: "Arial",
      stroke: "#000000",
      strokeThickness: 1,
    }).setScrollFactor(0).setDepth(101);

    // XP Text (curacion con XP)
    this.xpText = this.scene.add.text(10, 18, "XP: 0/0", {
      fontSize: "11px",
      color: "#ffffff",
      fontFamily: "Arial",
      stroke: "#000000",
      strokeThickness: 1,
    }).setScrollFactor(0).setDepth(101);

    // Level Text
    this.levelText = this.scene.add.text(10, 40, "LV: 1", {
      fontSize: "11px",
      color: "#ffffff",
      fontFamily: "Arial",
      stroke: "#000000",
      strokeThickness: 1,
    }).setScrollFactor(0).setDepth(101);

    // XP Progress bar
    this.xpBar = this.scene.add.graphics();
    this.xpBar.setScrollFactor(0).setDepth(100);

    // Transform bar
    this.transformBar = this.scene.add.graphics();
    this.transformBar.setScrollFactor(0).setDepth(100);

    // Transform text
    this.transformText = this.scene.add.text(10, 56, "TRANSFORM: READY", {
      fontSize: "10px",
      color: "#ff6b35",
      fontFamily: "Arial",
      stroke: "#000000",
      strokeThickness: 1,
    }).setScrollFactor(0).setDepth(101);
  }

  update(): void {
    const healthPercent = Math.max(0, (this.player.health / this.player.maxHealth));
    
    // Update health display text
    this.healthText.setText(`HP: ${Math.ceil(this.player.health)}/${this.player.maxHealth}`);

    // Update Health Bar Graphics
    this.healthBar.clear();
    
    // Background bar (black)
    this.healthBar.fillStyle(0x000000, 0.5);
    this.healthBar.fillRect(10, 14, this.barWidth, this.barHeight);

    // Dynamic color based on health level
    let barColor = 0x00ff00; // Green
    if (healthPercent <= 0.25) {
      barColor = 0xff0000; // Red
    } else if (healthPercent <= 0.5) {
      barColor = 0xffff00; // Yellow
    }
    
    // Progress bar
    this.healthBar.fillStyle(barColor, 1);
    this.healthBar.fillRect(10, 14, this.barWidth * healthPercent, this.barHeight);
    
    // Border
    this.healthBar.lineStyle(1, 0xffffff, 0.8);
    this.healthBar.strokeRect(10, 14, this.barWidth, this.barHeight);

    // --- XP HUD ---
    const healProgress = Phaser.Math.Clamp(this.pachita.xp / this.pachita.xpToHealCost, 0, 1);
    this.xpText.setText(`XP: ${Math.ceil(this.pachita.xp)} / ${this.pachita.xpToHealCost}`);

    this.xpBar.clear();
    this.xpBar.fillStyle(0x000000, 0.5);
    this.xpBar.fillRect(10, 30, this.xpBarWidth, this.xpBarHeight);

    const xpColor = healProgress >= 1 ? 0x7cff00 : 0x00b7ff;
    this.xpBar.fillStyle(xpColor, 1);
    this.xpBar.fillRect(10, 30, this.xpBarWidth * healProgress, this.xpBarHeight);
    this.xpBar.lineStyle(1, 0xffffff, 0.8);
    this.xpBar.strokeRect(10, 30, this.xpBarWidth, this.xpBarHeight);

    const level = this.pachita.getLevel();
    const prog = this.pachita.getXpProgressToNext();
    this.levelText.setText(`LV ${level} (XP: ${prog.current}/${prog.required})`);

    // --- TRANSFORM HUD ---
    const transformInfo = this.pachita.getTransformInfo();
    
    // Update transform text
    if (transformInfo.isTransformed) {
      // El tiempo restante se calcula diferente cuando está transformado
      const timeLeft = Math.ceil(transformInfo.timeRemaining / 1000);
      this.transformText.setText(`POWER: ${timeLeft}s`);
      this.transformText.setStyle({ color: "#ff0000" });
    } else if (transformInfo.canTransform) {
      this.transformText.setText("POWER: READY [V]");
      this.transformText.setStyle({ color: "#00ff00" });
    } else {
      const cooldownSecs = Math.ceil(transformInfo.timeRemaining / 1000);
      this.transformText.setText(`POWER: ${cooldownSecs}s`);
      this.transformText.setStyle({ color: "#ffff00" });
    }

    // Update transform bar
    this.transformBar.clear();
    this.transformBar.fillStyle(0x000000, 0.5);
    this.transformBar.fillRect(10, 44, this.transformBarWidth, this.transformBarHeight);

    const transformColor = transformInfo.isTransformed ? 0xff0000 : 
                         transformInfo.canTransform ? 0x00ff00 : 0xff6b35;
    this.transformBar.fillStyle(transformColor, 1);
    this.transformBar.fillRect(10, 44, this.transformBarWidth * transformInfo.cooldownProgress, this.transformBarHeight);
    
    this.transformBar.lineStyle(1, 0xffffff, 0.8);
    this.transformBar.strokeRect(10, 44, this.transformBarWidth, this.transformBarHeight);
  }
}
