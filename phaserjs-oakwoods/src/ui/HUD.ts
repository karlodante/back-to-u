import Phaser from "phaser";
import { Player } from "../entities/Player";

export class HUD {
  private scene: Phaser.Scene;
  private player: Player;
  private healthText!: Phaser.GameObjects.Text;
  private healthBar!: Phaser.GameObjects.Graphics;
  private readonly barWidth: number = 100;
  private readonly barHeight: number = 10;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.createHUD();
  }

  private createHUD(): void {
    // Health Bar Container
    this.healthBar = this.scene.add.graphics();
    this.healthBar.setScrollFactor(0).setDepth(100);

    // Health Text with percentage
    this.healthText = this.scene.add.text(10, 5, "HP: 100%", {
      fontSize: "10px",
      color: "#ffffff",
      fontFamily: "Arial",
      stroke: "#000000",
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(101);
  }

  update(): void {
    const healthPercent = Math.max(0, (this.player.health / this.player.maxHealth));
    
    // Update health display text
    this.healthText.setText(`HP: ${Math.ceil(healthPercent * 100)}%`);

    // Update Health Bar Graphics
    this.healthBar.clear();
    
    // Background bar (black)
    this.healthBar.fillStyle(0x000000, 0.5);
    this.healthBar.fillRect(10, 18, this.barWidth, this.barHeight);

    // Dynamic color based on health level
    let barColor = 0x00ff00; // Green
    if (healthPercent <= 0.25) {
      barColor = 0xff0000; // Red
    } else if (healthPercent <= 0.5) {
      barColor = 0xffff00; // Yellow
    }
    
    // Progress bar
    this.healthBar.fillStyle(barColor, 1);
    this.healthBar.fillRect(10, 18, this.barWidth * healthPercent, this.barHeight);
    
    // Border
    this.healthBar.lineStyle(1, 0xffffff, 0.8);
    this.healthBar.strokeRect(10, 18, this.barWidth, this.barHeight);
  }
}
