import Phaser from "phaser";
import { Player } from "../entities/Player";

export class HUD {
  private scene: Phaser.Scene;
  private player: Player;
  private healthText!: Phaser.GameObjects.Text;
  private healthBar!: Phaser.GameObjects.Graphics;
  private xpText!: Phaser.GameObjects.Text;
  private xpBar!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private petText!: Phaser.GameObjects.Text;
  private readonly barWidth: number = 100; // Un poco más ancha para legibilidad
  private readonly barHeight: number = 8;
  private readonly xpBarHeight: number = 5;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.createHUD();
  }

  private createHUD(): void {
    // === HP HUD ===
    this.healthBar = this.scene.add.graphics();
    this.healthBar.setScrollFactor(0).setDepth(100);

    this.healthText = this.scene.add.text(10, 4, "HP: 100%", {
      fontSize: "10px",
      color: "#ffffff",
      fontFamily: "monospace",
      fontWeight: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(101);

    // === XP HUD ===
    this.xpBar = this.scene.add.graphics();
    this.xpBar.setScrollFactor(0).setDepth(100);

    this.levelText = this.scene.add.text(10, 22, `PACHITA LVL: ${this.player.pet?.level || 1}`, {
      fontSize: "10px",
      color: "#ffaa00",
      fontFamily: "monospace",
      fontWeight: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(101);

    this.xpText = this.scene.add.text(10, 32, "XP: 0/100", {
      fontSize: "9px",
      color: "#ffffff",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 1,
    }).setScrollFactor(0).setDepth(101);

    this.petText = this.scene.add.text(10, 50, "CONTROLES: [E] ABRAZAR | [Q] COMBATE", {
      fontSize: "8px",
      color: "#ffffff",
      fontFamily: "monospace",
      backgroundColor: "#00000088",
      padding: { x: 4, y: 2 }
    }).setScrollFactor(0).setDepth(101);
  }

  update(): void {
    // --- Update HP Bar ---
    const healthPercent = Math.max(0, (this.player.health / this.player.maxHealth));
    this.healthText.setText(`HP: ${Math.ceil(healthPercent * 100)}%`);

    this.healthBar.clear();
    this.healthBar.fillStyle(0x000000, 0.7);
    this.healthBar.fillRoundedRect(10, 14, this.barWidth, this.barHeight, 3);

    let barColor = 0x00ff00;
    if (healthPercent <= 0.25) barColor = 0xff0000;
    else if (healthPercent <= 0.5) barColor = 0xffff00;
    
    this.healthBar.fillStyle(barColor, 1);
    this.healthBar.fillRoundedRect(10, 14, this.barWidth * healthPercent, this.barHeight, 3);

    // --- Update XP Bar (Pachita) ---
    const pet = this.player.pet;
    if (pet) {
      const xpPercent = Math.min(1, pet.xp / pet.xpToNextLevel);
      this.levelText.setText(`LVL: ${pet.level}`);
      this.xpText.setText(`XP: ${pet.xp}/${pet.xpToNextLevel}`);

      this.xpBar.clear();
      this.xpBar.fillStyle(0x000000, 0.7);
      this.xpBar.fillRoundedRect(10, 42, this.barWidth, this.xpBarHeight, 2);

      this.xpBar.fillStyle(0xffaa00, 1);
      this.xpBar.fillRoundedRect(10, 42, this.barWidth * xpPercent, this.xpBarHeight, 2);
    }
  }
}
