import Phaser from "phaser";

export class MenuScene extends Phaser.Scene {
  private optionsVisible: boolean = false;
  private optionsPanel!: Phaser.GameObjects.Container;

  constructor() {
    super("MenuScene");
  }

  preload(): void {
    // Cargar la imagen correcta del menú
    this.load.image("menu-bg", "assets/menu-bg.png");
  }

  create(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── FONDO (Usando la nueva imagen) ──
    const bg = this.add.image(W / 2, H / 2, "menu-bg");
    bg.setDisplaySize(W, H);

    // Overlay oscuro (ajustado a 0.4 para que se aprecie mejor tu nueva imagen)
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.4);

    // ── TÍTULO (Grande y al Centro) ──
    const title = this.add.text(W / 2, H * 0.4, "BACK TO U", {
      fontSize: "90px", 
      fontFamily: "Arial Black", 
      color: "#ffffff",
      stroke: "#ff4400",
      strokeThickness: 12,
      shadow: { offsetX: 0, offsetY: 0, color: "#ff2200", blur: 25, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: title,
      alpha: 1,
      scale: { from: 0.8, to: 1 },
      duration: 1000,
      ease: "Back.Out",
    });

    // ── BOTONES ──
    this.createButton(W / 2, H * 0.6, "START", 0xcc3300, 0, () => {
      this.cameras.main.flash(250, 255, 60, 0);
      this.time.delayedCall(250, () => this.scene.start("BootScene"));
    });

    this.createButton(W / 2, H * 0.72, "OPTIONS", 0x223344, 200, () => {
      this.toggleOptions();
    });

    this.optionsPanel = this.createOptionsPanel(W, H);
    this.optionsPanel.setVisible(false);
  }

  // ... (El resto de los métodos createButton, createOptionsPanel y toggleOptions se mantienen igual)
  
  private createButton(x: number, y: number, label: string, color: number, delay: number, onClick: () => void): void {
    const container = this.add.container(x, y);
    const btnW = 380;
    const btnH = 70;
    const bg = this.add.rectangle(0, 0, btnW, btnH, color, 1).setStrokeStyle(4, 0xffffff, 0.5);
    const txt = this.add.text(0, 0, label, { fontSize: "32px", fontWeight: "bold", color: "#ffffff", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5);
    container.add([bg, txt]);
    container.setSize(btnW, btnH);
    container.setInteractive({ useHandCursor: true });
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, y: y - 10, duration: 600, delay });
    container.on("pointerover", () => { this.tweens.add({ targets: container, scale: 1.1, duration: 100 }); bg.setStrokeStyle(4, 0xffffff, 1); });
    container.on("pointerout", () => { this.tweens.add({ targets: container, scale: 1, duration: 100 }); bg.setStrokeStyle(4, 0xffffff, 0.5); });
    container.on("pointerdown", () => { this.tweens.add({ targets: container, scale: 0.95, duration: 50, yoyo: true }); onClick(); });
  }

  private createOptionsPanel(W: number, H: number): Phaser.GameObjects.Container {
    const panel = this.add.container(W / 2, H / 2);
    const bg = this.add.rectangle(0, 0, 600, 450, 0x000000, 0.95).setStrokeStyle(4, 0xff4400);
    const title = this.add.text(0, -180, "OPTIONS", { fontSize: "40px", color: "#ff4400" }).setOrigin(0.5);
    const close = this.add.text(0, 180, "CLOSE", { fontSize: "30px" }).setOrigin(0.5).setInteractive();
    close.on("pointerdown", () => this.toggleOptions());
    panel.add([bg, title, close]);
    panel.setDepth(100);
    return panel;
  }

  private toggleOptions(): void {
    this.optionsVisible = !this.optionsVisible;
    this.optionsPanel.setVisible(this.optionsVisible);
  }
}