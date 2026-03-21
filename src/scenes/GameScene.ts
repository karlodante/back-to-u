import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Pet } from "../entities/Pet";
import { Enemy, EnemyType } from "../entities/Enemy";
import { SkyDeity, SkyEntity } from "../entities/SkyDeity";
import { HUD } from "../ui/HUD";
import { Combat } from "../systems/Combat";
import { EventBus } from "../core/EventBus";

export class GameScene extends Phaser.Scene {
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private map!: Phaser.Tilemaps.Tilemap;
  private player!: Player;
  private hud!: HUD;
  private hazards!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private deities!: Phaser.Physics.Arcade.Group;
  private pet!: Pet;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private dashKey!: Phaser.Input.Keyboard.Key;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private hugKey!: Phaser.Input.Keyboard.Key;
  private petSkillKey!: Phaser.Input.Keyboard.Key;

  // Background layers for parallax scrolling
  private bgLayer1!: Phaser.GameObjects.TileSprite;
  private bgLayer2!: Phaser.GameObjects.TileSprite;
  private bgLayer3!: Phaser.GameObjects.TileSprite;

  // Combat Hit List to prevent multi-hits
  private enemiesHitInCurrentAttack: Set<Enemy> = new Set();
  private lastAttackId: number = 0;

  // Pause state
  private isPaused: boolean = false;
  private pauseMenu!: Phaser.GameObjects.Container;
  private pauseKey!: Phaser.Input.Keyboard.Key;

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

    // === PET (PACHITA) ===
    this.pet = new Pet(this, 80, 120, this.player);
    this.player.setPet(this.pet);

    // Add collision between player and ground
    this.physics.add.collider(this.player, this.groundLayer);
    this.physics.add.collider(this.pet, this.groundLayer);

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
    this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.hugKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.petSkillKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    // === HUD ===
    this.hud = new HUD(this, this.player);

    // Colisión de la hitbox del jugador con los enemigos (Configurada una sola vez)
    this.physics.add.overlap(this.player.getAttackHitbox(), this.enemies, (hb: any, enemyObj: any) => {
      const enemy = enemyObj as Enemy;
      
      if (this.player.getIsAttacking()) {
        const currentAttackId = this.player.getAttackId();
        
        if (currentAttackId !== this.lastAttackId) {
            this.enemiesHitInCurrentAttack.clear();
            this.lastAttackId = currentAttackId;
        }

        if (!this.enemiesHitInCurrentAttack.has(enemy)) {
            const dir = (enemy.x > this.player.x) ? 1 : -1;
            enemy.takeDamage(this.player.attackDamage, dir);
            this.enemiesHitInCurrentAttack.add(enemy);
            
            // Screen Shake al golpear
            this.cameras.main.shake(100, 0.005);
        }
      }
    }, undefined, this);

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

    // === ENEMIGOS AVANZADOS ===
    this.enemies = this.physics.add.group();
    
    // Crear diferentes tipos de enemigos
    const meleeEnemy = new Enemy(this, 600, groundY - 20, EnemyType.MELEE, this.player);
    const rangeEnemy = new Enemy(this, 1000, groundY - 20, EnemyType.RANGE, this.player);
    const tankEnemy = new Enemy(this, 1400, groundY - 20, EnemyType.TANK, this.player);
    
    this.enemies.add(meleeEnemy);
    this.enemies.add(rangeEnemy);
    this.enemies.add(tankEnemy);

    this.physics.add.collider(this.enemies, this.groundLayer);

    // Colisión Jugador ataca enemigo
    this.physics.add.overlap(this.player, this.enemies, (pObj, eObj) => {
      const p = pObj as Player;
      const e = eObj as Enemy;
      
      if (p.getIsAttacking()) {
        // p.getIsAttacking() ahora es más preciso
      } else {
        // El daño por contacto se maneja dentro de la IA del enemigo
      }
    });

    // === DEIDADES (INTI Y QUILLA) ===
    this.deities = this.physics.add.group();
    
    this.time.delayedCall(5000, () => {
      const inti = new SkyDeity(this, this.player.x + 100, groundY - 40, SkyEntity.INTI);
      this.deities.add(inti);
    });

    this.time.delayedCall(10000, () => {
      const quilla = new SkyDeity(this, this.player.x - 100, groundY - 40, SkyEntity.QUILLA);
      this.deities.add(quilla);
    });
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    
    if (this.isPaused) {
      this.physics.pause();
      this.anims.pauseAll();
      this.showPauseMenu();
    } else {
      this.physics.resume();
      this.anims.resumeAll();
      this.hidePauseMenu();
    }
  }

  private showPauseMenu(): void {
    const { width, height } = this.cameras.main;
    
    this.pauseMenu = this.add.container(0, 0).setDepth(2000).setScrollFactor(0);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRect(0, 0, width, height);
    this.pauseMenu.add(bg);

    const title = this.add.text(width / 2, height / 2 - 20, "PAUSA", {
      fontSize: "24px",
      color: "#ffffff",
      fontFamily: "monospace"
    }).setOrigin(0.5);
    this.pauseMenu.add(title);

    const resumeText = this.add.text(width / 2, height / 2 + 20, "Presiona 'P' para Continuar", {
      fontSize: "12px",
      color: "#ffff00",
      fontFamily: "monospace"
    }).setOrigin(0.5);
    this.pauseMenu.add(resumeText);

    // Efecto de pulsado para el texto de pausa
    this.tweens.add({
      targets: resumeText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1
    });
  }

  private hidePauseMenu(): void {
    if (this.pauseMenu) {
      this.pauseMenu.destroy();
    }
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
    // Tecla de Pausa
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.togglePause();
    }

    if (this.isPaused) return;

    // Update de las deidades
    this.deities.getChildren().forEach(d => (d as SkyDeity).update());

    // Update de los enemigos avanzados
    this.enemies.getChildren().forEach(e => (e as Enemy).update());

    // Update de la mascota (Pachita)
    this.pet.update();

    // Update player and HUD
    this.player.update(this.cursors, this.dashKey, this.attackKey, this.hugKey, this.petSkillKey);
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
