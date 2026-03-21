import Phaser from "phaser";

export enum SkyEntity {
  INTI,
  QUILLA
}

export class SkyDeity extends Phaser.Physics.Arcade.Sprite {
  private type: SkyEntity;
  private isLanded: boolean = false;
  private dialogText!: Phaser.GameObjects.Text;
  private dialogBubble!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, type: SkyEntity) {
    const texture = type === SkyEntity.INTI ? "oakwoods-inti" : "oakwoods-quilla";
    super(scene, x, -50, texture); // Comienzan arriba
    
    this.type = type;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setTint(type === SkyEntity.INTI ? 0xffff00 : 0x00ffff);
    this.setAlpha(0); // Invisible al inicio

    // Animación de caída (caer lentamente del cielo)
    scene.tweens.add({
      targets: this,
      y: y,
      alpha: 1,
      duration: 2000,
      ease: "Cubic.out",
      onComplete: () => {
        this.isLanded = true;
        this.createDialog();
      }
    });

    // Interacción con el jugador
    scene.physics.add.overlap(this, (scene as any).player, () => {
      if (this.isLanded) {
        this.showDialog();
      }
    });
  }

  private createDialog() {
    this.dialogBubble = this.scene.add.graphics();
    this.dialogBubble.fillStyle(0x000000, 0.7);
    this.dialogBubble.fillRoundedRect(-50, -60, 100, 40, 10);
    this.dialogBubble.setAlpha(0);
    this.dialogBubble.setScrollFactor(1);

    this.dialogText = this.scene.add.text(0, -50, "", {
      fontSize: "10px",
      color: "#ffffff",
      fontFamily: "monospace",
      align: "center",
      wordWrap: { width: 80 }
    }).setOrigin(0.5).setAlpha(0);
  }

  public showDialog() {
    // aca pones el texto
    const message = this.type === SkyEntity.INTI ? "Soy Inti, el Sol." : "Soy Quilla, la Luna.";
    
    this.dialogText.setText(message);
    this.dialogBubble.setPosition(this.x, this.y);
    this.dialogText.setPosition(this.x, this.y - 40);
    
    this.scene.tweens.add({
      targets: [this.dialogBubble, this.dialogText],
      alpha: 1,
      duration: 300,
      onComplete: () => {
        this.scene.time.delayedCall(2000, () => {
          this.scene.tweens.add({
            targets: [this.dialogBubble, this.dialogText],
            alpha: 0,
            duration: 300
          });
        });
      }
    });
  }

  update() {
    if (this.isLanded) {
      this.dialogBubble.setPosition(this.x, this.y);
      this.dialogText.setPosition(this.x, this.y - 40);
    }
  }
}
