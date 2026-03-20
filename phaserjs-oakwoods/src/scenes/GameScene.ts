import Phaser from "phaser";
import { Player } from "../entities/Player";
import { HUD } from "../ui/HUD";
import { Combat } from "../systems/Combat";

export class GameScene extends Phaser.Scene {
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private map!: Phaser.Tilemaps.Tilemap;
  private player!: Player;
  private hud!: HUD;
  private hazards!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private dashKey!: Phaser.Input.Keyboard.Key;
  private attackKey!: Phaser.Input.Keyboard.Key;

  // Background layers for parallax scrolling
  private bgLayer1!: Phaser.GameObjects.TileSprite;
  private bgLayer2!: Phaser.GameObjects.TileSprite;
  private bgLayer3!: Phaser.GameObjects.TileSprite;

  // Track how far ground has been generated
  private groundGeneratedToX: number = 0;

  // Attack state
  private isAttacking: boolean = false;

  constructor() {
    super("GameScene");
  }

  create(): void {
    // === BACKGROUND LAYERS (Parallax) ===
    // These are fixed to camera but we'll scroll their texture in update()
    // Layer 1 - furthest (sky/distant)
    this.bgLayer1 = this.add.tileSprite(0, 0, 320, 180, "oakwoods-bg-layer1")
      .setOrigin(0, 0)
      .setScrollFactor(0);

    // Layer 2 - mid distance
    this.bgLayer2 = this.add.tileSprite(0, 0, 320, 180, "oakwoods-bg-layer2")
      .setOrigin(0, 0)
      .setScrollFactor(0);

    // Layer 3 - nearest (foreground trees)
    this.bgLayer3 = this.add.tileSprite(0, 0, 320, 180, "oakwoods-bg-layer3")
      .setOrigin(0, 0)
      .setScrollFactor(0);

    // === GROUND TILEMAP ===
    // Create a wide tilemap for infinite scrolling (500 tiles = ~12000px)
    this.map = this.make.tilemap({
      tileWidth: 24,
      tileHeight: 24,
      width: 500,
      height: 8,
    });

    // Add the tileset image to the map
    const tileset = this.map.addTilesetImage("oakwoods-tileset");
    if (!tileset) {
      console.error("Failed to add tileset");
      return;
    }

    // Create a blank layer (y=16 anchors ground to bottom of 180px viewport)
    const layer = this.map.createBlankLayer("ground", tileset, 0, 16);
    if (!layer) {
      console.error("Failed to create layer");
      return;
    }
    this.groundLayer = layer;

    // Fill initial ground (first 20 tiles)
    for (let x = 0; x < 20; x++) {
      this.map.putTileAt(0, x, 7, true, "ground");
    }
    this.groundGeneratedToX = 20;

    // Enable collision on all tiles in the ground layer
    this.groundLayer.setCollisionByExclusion([-1]);

    // === DECORATIONS ===
    // Ground surface at bottom of viewport
    const groundY = 184;

    // Shop in the background (behind player)
    this.add.image(250, groundY, "oakwoods-shop").setOrigin(0.5, 1);

    // Lamp posts
    this.add.image(50, groundY, "oakwoods-lamp").setOrigin(0.5, 1);
    this.add.image(180, groundY, "oakwoods-lamp").setOrigin(0.5, 1);

    // Sign
    this.add.image(320, groundY, "oakwoods-sign").setOrigin(0.5, 1);

    // Fences
    this.add.image(400, groundY, "oakwoods-fence1").setOrigin(0.5, 1);
    this.add.image(470, groundY, "oakwoods-fence2").setOrigin(0.5, 1);

    // Rocks scattered around
    this.add.image(140, groundY, "oakwoods-rock1").setOrigin(0.5, 1);
    this.add.image(350, groundY, "oakwoods-rock2").setOrigin(0.5, 1);
    this.add.image(550, groundY, "oakwoods-rock3").setOrigin(0.5, 1);

    // Grass tufts on the ground
    this.add.image(70, groundY, "oakwoods-grass1").setOrigin(0.5, 1);
    this.add.image(120, groundY, "oakwoods-grass2").setOrigin(0.5, 1);
    this.add.image(200, groundY, "oakwoods-grass3").setOrigin(0.5, 1);
    this.add.image(280, groundY, "oakwoods-grass1").setOrigin(0.5, 1);
    this.add.image(380, groundY, "oakwoods-grass2").setOrigin(0.5, 1);
    this.add.image(450, groundY, "oakwoods-grass3").setOrigin(0.5, 1);

    // === PLAYER CHARACTER ===
    // Create custom player instance
    this.player = new Player(this, 100, 120);

    // Add collision between player and ground
    this.physics.add.collider(this.player, this.groundLayer);

    // === CAMERA ===
    // Set up camera to follow player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(50, 50);

    // Set world bounds - no left bound limit, very large right bound
    this.physics.world.setBounds(0, 0, 500 * 24, 180);

    // === ANIMATIONS ===
    this.createAnimations();

    // === INPUT ===
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.dashKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    // === HUD ===
    this.hud = new HUD(this, this.player);

    // Escuchar evento de muerte
    this.player.on("player_died", () => {
      this.showGameOver();
    });

    // === HAZARDS ===
    this.hazards = this.physics.add.group();
    
    // Create some test hazards (rocks that deal damage)
    const hazardPositions = [450, 850, 1250];
    hazardPositions.forEach(x => {
      const hazard = this.physics.add.sprite(x, groundY, "oakwoods-rock1").setOrigin(0.5, 1);
      this.hazards.add(hazard);
      (hazard.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      (hazard.body as Phaser.Physics.Arcade.Body).setImmovable(true);
      (hazard.body as Phaser.Physics.Arcade.Body).setSize(15, 15);
    });

    this.physics.add.overlap(this.player, this.hazards, (playerObj, hazardObj) => {
      const p = playerObj as Player;
      // El jugador ya tiene su propia lógica de i-frames y muerte
      p.takeDamage(10);
    });

    // === ENEMIGOS DE PRUEBA ===
    this.enemies = this.physics.add.group();
    const enemy = this.add.rectangle(600, groundY - 20, 32, 32, 0xff0000);
    this.enemies.add(enemy);
    (enemy.body as Phaser.Physics.Arcade.Body).setImmovable(true).setAllowGravity(false);

    // Colisión Jugador ataca enemigo
    this.physics.add.overlap(this.player, this.enemies, (pObj, eObj) => {
      const p = pObj as Player;
      const e = eObj as Phaser.GameObjects.Rectangle;
      
      // Si el jugador está atacando, el enemigo desaparece
      if (p.getIsAttacking()) {
        this.tweens.add({
          targets: e,
          alpha: 0,
          scale: 0,
          duration: 200,
          onComplete: () => e.destroy()
        });
      } else {
        // Si no ataca, el enemigo le hace daño
        p.takeDamage(5);
      }
    });
  }

  private showGameOver(): void {
    const { width, height } = this.cameras.main;

    // Fondo oscuro semi-transparente
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, width, height);
    bg.setScrollFactor(0).setDepth(1000);

    // Texto de Game Over
    this.add.text(width / 2, height / 2 - 30, "GAME OVER", {
      fontSize: "32px",
      color: "#ff0000",
      fontFamily: "Arial Black",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

    // Botón Reintentar
    const retryBtn = this.add.text(width / 2, height / 2 + 20, "REINTENTAR", {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });

    retryBtn.on("pointerover", () => retryBtn.setStyle({ color: "#ffff00" }));
    retryBtn.on("pointerout", () => retryBtn.setStyle({ color: "#ffffff" }));
    retryBtn.on("pointerdown", () => {
      this.scene.restart();
    });

    // Botón Salir (reiniciar a la pantalla de carga o título)
    const exitBtn = this.add.text(width / 2, height / 2 + 55, "SALIR", {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });

    exitBtn.on("pointerover", () => exitBtn.setStyle({ color: "#ff0000" }));
    exitBtn.on("pointerout", () => exitBtn.setStyle({ color: "#ffffff" }));
    exitBtn.on("pointerdown", () => {
      this.scene.start("BootScene");
    });
  }

  private createAnimations(): void {
    if (this.anims.exists("char-blue-idle")) return;

    this.anims.create({
      key: "char-blue-idle",
      frames: this.anims.generateFrameNumbers("oakwoods-char-blue", {
        start: 0,
        end: 5,
      }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: "char-blue-run",
      frames: this.anims.generateFrameNumbers("oakwoods-char-blue", {
        start: 16,
        end: 21,
      }),
      frameRate: 10,
      repeat: -1,
    });

    this.anims.create({
      key: "char-blue-jump",
      frames: this.anims.generateFrameNumbers("oakwoods-char-blue", {
        start: 28,
        end: 31,
      }),
      frameRate: 10,
      repeat: 0,
    });

    this.anims.create({
      key: "char-blue-fall",
      frames: this.anims.generateFrameNumbers("oakwoods-char-blue", {
        start: 35,
        end: 37,
      }),
      frameRate: 10,
      repeat: 0,
    });

    this.anims.create({
      key: "char-blue-attack",
      frames: this.anims.generateFrameNumbers("oakwoods-char-blue", {
        start: 8,
        end: 13,
      }),
      frameRate: 12,
      repeat: 0,
    });
  }

  update(): void {
    // IA básica para los enemigos (persecución)
    this.enemies.getChildren().forEach((enemyObj) => {
      const e = enemyObj as Phaser.GameObjects.Rectangle;
      if (e.active) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
        
        // Si el jugador está cerca (300px), el enemigo lo persigue
        if (dist < 300) {
          const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
          const speed = 60;
          (e.body as Phaser.Physics.Arcade.Body).setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
          );
        } else {
          (e.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        }
      }
    });

    // Update player and HUD
    this.player.update(this.cursors, this.dashKey, this.attackKey);
    this.hud.update();

    // === PARALLAX SCROLLING ===
    // Scroll background layers based on camera position
    const camX = this.cameras.main.scrollX;
    this.bgLayer1.tilePositionX = camX * 0.1; // Slowest - furthest
    this.bgLayer2.tilePositionX = camX * 0.3; // Medium
    this.bgLayer3.tilePositionX = camX * 0.5; // Fastest - nearest

    // === INFINITE GROUND GENERATION ===
    // Generate more ground tiles as player approaches the edge
    const playerTileX = Math.floor(this.player.x / 24);
    const generateAhead = 20; // Generate 20 tiles ahead of player

    if (playerTileX + generateAhead > this.groundGeneratedToX) {
      // Generate more ground tiles
      const tilesToGenerate = (playerTileX + generateAhead) - this.groundGeneratedToX;
      for (let i = 0; i < tilesToGenerate; i++) {
        const x = this.groundGeneratedToX + i;
        if (x < 500) { // Don't exceed map width
          this.map.putTileAt(0, x, 7, true, "ground");
        }
      }
      this.groundGeneratedToX = Math.min(playerTileX + generateAhead, 500);
    }
  }
}
