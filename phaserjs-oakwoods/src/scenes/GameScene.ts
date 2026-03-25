import Phaser from "phaser";
import { Player } from "../entities/Player";
import { HUD } from "../ui/HUD";
import { Pachita } from "../entities/Pachita";
import { EventBus } from "../core/EventBus";
import { SaveSystem } from "../core/SaveSystem";
import { PhaserEnemy } from "../entities/PhaserEnemy";
import { CombatSystem } from "../systems/CombatSystem";
import { EnemyAISystem } from "../systems/EnemyAISystem";
import { ProgressionSystem } from "../systems/ProgressionSystem";
import { FeedbackSystem } from "../systems/FeedbackSystem";
import { GameLoopSystem } from "../systems/GameLoopSystem";
import { DebugSystem } from "../systems/DebugSystem";
import { AudioSystem } from "../core/AudioSystem";

export class GameScene extends Phaser.Scene {
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private map!: Phaser.Tilemaps.Tilemap;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private player!: Player;
  private hud!: HUD;
  private pachita!: Pachita;
  private hazards!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private dashKey!: Phaser.Input.Keyboard.Key;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private healKey!: Phaser.Input.Keyboard.Key;
  private transformKey!: Phaser.Input.Keyboard.Key;

  // Background layers for parallax scrolling
  private bgLayer1!: Phaser.GameObjects.TileSprite;
  private bgLayer2!: Phaser.GameObjects.TileSprite;
  private bgLayer3!: Phaser.GameObjects.TileSprite;

  // Track how far ground has been generated
  private groundGeneratedToX: number = 0;

  // Sistemas centralizados
  private combatSystem!: CombatSystem;
  private enemyAISystem!: EnemyAISystem;
  private progressionSystem!: ProgressionSystem;
  private feedbackSystem!: FeedbackSystem;
  private gameLoopSystem!: GameLoopSystem;
  private debugSystem!: DebugSystem;
  private audioSystem!: AudioSystem;

  // Inicializar sistemas centralizados
  private initializeSystems(): void {
    try {
      this.audioSystem = new AudioSystem(this);
      this.combatSystem = new CombatSystem(this, this.enemyAISystem.getEnemiesGroup());
      this.combatSystem.setEnemyMapping(this.enemyAISystem.getEnemyMapping());
      this.progressionSystem = new ProgressionSystem(this, this.player, this.pachita);
      this.feedbackSystem = new FeedbackSystem(this);
      this.gameLoopSystem = new GameLoopSystem(this);
      this.debugSystem = new DebugSystem(this, this.player, this.pachita, this.enemyAISystem);
      
      // Conectar audio con el jugador
      this.player.setAudioSystem(this.audioSystem);
      
      // Inicializar sistemas
      this.enemyAISystem.initialize();
      this.progressionSystem.initialize();
      this.gameLoopSystem.initialize();
      
      // Configurar colisiones
      this.combatSystem.setupPlayerEnemyCollision(this.player);
      
      console.log("✅ Sistemas inicializados correctamente");
    } catch (error) {
      console.error("❌ Error inicializando sistemas:", error);
    }
  }

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
    this.pachita = new Pachita(this, this.player);
    
    // Conectar Pachita con Player para bonos de combate
    this.player.setPachita(this.pachita);

    // Inicializar EnemyAI primero
    this.enemyAISystem = new EnemyAISystem(this, this.player);
    
    // Inicializar sistemas centralizados (después de crear jugador y pachita)
    this.initializeSystems();

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

    // === INPUT === (movido al final para asegurar que todo esté inicializado)
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.dashKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.healKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.transformKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V);

    // Tecla ESC para pausar
    this.input.keyboard!.on("keydown-ESC", () => {
      // Verificar si la escena está activa antes de pausar
      if (this.scene.isActive()) {
        this.scene.pause();
        this.scene.launch("PauseScene");
      } else {
        console.log("⚠️ DEBUG: GameScene no está activa, no se puede pausar");
      }
    });

    console.log("✅ Input configurado correctamente");

    // === VALIDACIÓN DE CARGA DE SPRITES KARLO ===
    // Solo verificar que los sprites cargaron, sin mostrar pruebas visuales
    console.log("🔍 DEBUG: Verificando carga de sprites...");
    
    if (this.textures.exists('wara_idle')) {
      console.log("✅ DEBUG: Sprite Wara (player) cargado correctamente");
    } else {
      console.log("⚠️ DEBUG: Sprite Wara (player) no encontrado, usando fallback");
    }

    if (this.textures.exists('alma_idle')) {
      console.log("✅ DEBUG: Sprite Alma (enemigo) cargado correctamente");
    } else {
      console.log("⚠️ DEBUG: Sprite Alma (enemigo) no encontrado, usando fallback");
    }

    if (this.textures.exists('sirviente_idle')) {
      console.log("✅ DEBUG: Sprite Sirviente (enemigo) cargado correctamente");
    } else {
      console.log("⚠️ DEBUG: Sprite Sirviente (enemigo) no encontrado, usando fallback");
    }

    // Pachita usa su sprite original (círculo amarillo)
    console.log("✅ DEBUG: Pachita usando sprite original (círculo amarillo)");

    // === HUD ===
    this.hud = new HUD(this, this.player, this.pachita);

    // Escuchar evento de muerte
    this.player.on("player_died", () => {
      this.gameLoopSystem.handlePlayerDeath();
    });

    // === PLATFORMS ===
    // Eliminado temporalmente para debuggear movimiento del personaje
    // this.platforms = this.physics.add.staticGroup();
    // this.createPlatforms();

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

    // Colision jugador con plataformas (comentado temporalmente)
    // this.physics.add.collider(this.player, this.platforms);

    // Colision jugador con hazards
    this.physics.add.overlap(this.player, this.hazards, (playerObj, hazardObj) => {
      const p = playerObj as Player;
      // El jugador ya tiene su propia lógica de i-frames y muerte
      p.takeDamage(10);
    });

    // === ENEMIGOS ===
    // El sistema de IA maneja todo el spawn y colisiones

  }


  /**
   * Crea plataformas a diferentes alturas
   */
  private createPlatforms(): void {
    const groundY = 184;

    // Plataforma 1: Salto inicial (fácilmente accesible)
    const platform1 = this.physics.add.sprite(250, groundY - 45, "oakwoods-grass1").setOrigin(0.5, 1);
    platform1.setDisplaySize(90, 12);
    this.platforms.add(platform1);
    (platform1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);

    // Plataforma 2: Nivel medio (requiere buen salto)
    const platform2 = this.physics.add.sprite(450, groundY - 80, "oakwoods-grass2").setOrigin(0.5, 1);
    platform2.setDisplaySize(100, 12);
    this.platforms.add(platform2);
    (platform2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);

    // Plataforma 3: Nivel alto (desafío pero alcanzable)
    const platform3 = this.physics.add.sprite(650, groundY - 110, "oakwoods-grass3").setOrigin(0.5, 1);
    platform3.setDisplaySize(95, 12);
    this.platforms.add(platform3);
    (platform3.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);

    // Plataforma 4: Secuencia de saltos (intermedia)
    const platform4 = this.physics.add.sprite(800, groundY - 65, "oakwoods-grass1").setOrigin(0.5, 1);
    platform4.setDisplaySize(80, 12);
    this.platforms.add(platform4);
    (platform4.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);

    // Plataforma 5: Recompensa alta (máximo desafío)
    const platform5 = this.physics.add.sprite(1000, groundY - 95, "oakwoods-grass2").setOrigin(0.5, 1);
    platform5.setDisplaySize(85, 12);
    this.platforms.add(platform5);
    (platform5.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);

    // Pequeñas plataformas de conexión (para crear rutas)
    const connector1 = this.physics.add.sprite(350, groundY - 30, "oakwoods-grass3").setOrigin(0.5, 1);
    connector1.setDisplaySize(50, 8);
    this.platforms.add(connector1);
    (connector1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);

    const connector2 = this.physics.add.sprite(550, groundY - 55, "oakwoods-grass1").setOrigin(0.5, 1);
    connector2.setDisplaySize(55, 8);
    this.platforms.add(connector2);
    (connector2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);

    const connector3 = this.physics.add.sprite(720, groundY - 85, "oakwoods-grass2").setOrigin(0.5, 1);
    connector3.setDisplaySize(45, 8);
    this.platforms.add(connector3);
    (connector3.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);

    // Plataforma de inicio (para facilitar el acceso inicial)
    const starterPlatform = this.physics.add.sprite(150, groundY - 25, "oakwoods-grass3").setOrigin(0.5, 1);
    starterPlatform.setDisplaySize(70, 10);
    this.platforms.add(starterPlatform);
    (starterPlatform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);
  }

  private createAnimations(): void {
    console.log("🔍 DEBUG: Creando animaciones...");
    
    // SOLO crear animaciones del spritesheet original (para fallback)
    if (this.anims.exists("char-blue-idle")) {
      console.log("📦 DEBUG: Animaciones originales ya existen");
    } else {
      console.log("📦 DEBUG: Creando animaciones con spritesheet oakwoods");
      
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

      this.anims.create({
        key: "char-blue-hurt",
        frames: this.anims.generateFrameNumbers("oakwoods-char-blue", {
          start: 42,
          end: 45,
        }),
        frameRate: 12,
        repeat: 0,
      });

      console.log("✅ DEBUG: Animaciones del spritesheet creadas correctamente");
    }

    // Ya no creamos animaciones de Wara porque usamos imágenes individuales
    if (this.textures.exists('wara_idle')) {
      console.log("🎨 DEBUG: Wara usa imágenes individuales (no se crean animaciones)");
    }
  }

  update(): void {
    // Verificar si el juego ha terminado
    if (this.gameLoopSystem.isGameEnded()) return;

    // Update player primero (prioridad máxima)
    this.player.update(this.cursors, this.dashKey, this.attackKey);
    this.pachita.update();

    // Actualizar sistemas (solo si no hay problemas)
    try {
      this.enemyAISystem.update();
      this.debugSystem.update();
      this.gameLoopSystem.update();
    } catch (error) {
      console.log("Error en sistemas:", error);
    }

    // Controles del jugador
    if (Phaser.Input.Keyboard.JustDown(this.healKey)) {
      this.progressionSystem.transferXpToLife();
    }

    if (Phaser.Input.Keyboard.JustDown(this.transformKey)) {
      this.pachita.transform();
    }

    // HUD always visible
    this.hud.update();

    // Camera look (ligero hacia donde va)
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    const vx = body?.velocity?.x ?? 0;
    const lookX = Phaser.Math.Clamp((vx / 220) * 26, -34, 34);
    this.cameras.main.setFollowOffset(lookX, 0);

    // --- PARALLAX + INFINITE GROUND ---

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
