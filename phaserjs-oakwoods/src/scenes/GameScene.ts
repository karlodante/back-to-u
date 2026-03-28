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

  // Cooldown para evitar congelamiento por múltiples interacciones
  private lastCombatTime: number = 0;
  private combatCooldownMs: number = 50; // Reducido a 50ms para mejor respuesta

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

    // === PRUEBA CONTROLADA - DEBUG REAL ===
    // Probar si wara_idle se puede renderizar correctamente como SPRITESHEET
    console.log("🧪 DEBUG: Iniciando prueba controlada de Wara (SPRITESHEET)...");
    
    if (this.textures.exists('wara_idle')) {
      console.log("✅ DEBUG: Textura wara_idle existe");
      
      // PRUEBA 1: Sprite estático con frame 0 del spritesheet
      const testSprite = this.physics.add.sprite(400, 300, 'wara_idle', 0);
      testSprite.setOrigin(0.5, 1);
      testSprite.setDepth(10);
      testSprite.setScale(1.5);
      testSprite.setImmovable(true);
      testSprite.body?.setAllowGravity(false);
      console.log("🧪 DEBUG: Sprite de prueba creado en (400, 300) con frame 0");
      
      // PRUEBA 2: Verificar propiedades
      console.log("🧪 DEBUG: Propiedades del sprite de prueba:");
      console.log(`  - key: ${testSprite.texture.key}`);
      console.log(`  - frame: ${testSprite.frame.name}`);
      console.log(`  - visible: ${testSprite.visible}`);
      console.log(`  - alpha: ${testSprite.alpha}`);
      console.log(`  - scale: ${testSprite.scaleX}`);
      
      // PRUEBA 3: Intentar reproducir animación
      if (this.anims.exists('wara_idle_anim')) {
        console.log("🧪 DEBUG: Animación wara_idle_anim existe, probando...");
        setTimeout(() => {
          testSprite.play('wara_idle_anim', true);
          console.log("🧪 DEBUG: Reproduciendo animación wara_idle_anim");
        }, 1000);
      } else {
        console.log("❌ DEBUG: Animación wara_idle_anim NO existe");
      }
      
      // Eliminar después de 5 segundos para no interferir
      this.time.delayedCall(5000, () => {
        testSprite.destroy();
        console.log("🧪 DEBUG: Sprite de prueba eliminado");
      });
      
    } else {
      console.log("❌ DEBUG: Textura wara_idle NO existe");
    }

    // === PLAYER CHARACTER ===
    // Create custom player instance
    console.log("🎮 DEBUG: Creando Player único...");
    // Coordenada exacta del suelo: 184 (groundY) - altura del sprite
    this.player = new Player(this, 100, 184); // Exactamente en la coordenada del suelo
    this.pachita = new Pachita(this, this.player);
    
    // Conectar Pachita con Player para bonos de combate
    this.player.setPachita(this.pachita);

    // Verificar que solo exista un Player
    const playerCount = this.children.list.filter(child => child instanceof Player).length;
    console.log(`🔍 DEBUG: Número de Players en escena: ${playerCount}`);
    if (playerCount > 1) {
      console.warn("⚠️ ADVERTENCIA: Múltiples Players detectados");
    }

    // === ENEMY SPAWN SYSTEM (PREPARACIÓN) ===
    // Estructura para futuras probabilidades de spawn
    const enemyTypes = [
      { type: 'alma_angry', weight: 0.6, spriteKey: 'alma_angry_idle' },
      { type: 'alma_normal', weight: 0.4, spriteKey: 'alma_idle' }
    ];
    
    console.log("🎲 DEBUG: Sistema de probabilidades de spawn preparado");
    console.log(`🎲 DEBUG: Tipos de enemigos disponibles: ${enemyTypes.length}`);
    
    // NOTA: Esto es preparación para futura implementación
    // El sistema actual sigue usando el método existente

    // Inicializar EnemyAI primero
    this.enemyAISystem = new EnemyAISystem(this, this.player);
    
    // Inicializar sistemas centralizados (después de crear jugador y pachita)
    this.initializeSystems();

    // === COLISIONES ESENCIALES CON SUELO ===
    // Add collision between player and ground
    this.physics.add.collider(this.player, this.groundLayer);
    
    // Add collision between enemies and ground
    this.physics.add.collider(this.enemyAISystem.getEnemiesGroup(), this.groundLayer);
    
    console.log("🏗️ DEBUG: Colisiones con suelo configuradas");

    // === SISTEMA DE COMBATE UNIFICADO ===
    // Un solo sistema para manejar tanto daño como ataque
    this.physics.add.overlap(
      this.player, 
      this.enemyAISystem.getEnemiesGroup(), 
      (player: any, enemy: any) => this.handleCombatInteraction(player, enemy), 
      undefined, 
      this
    );
    
    console.log("⚔️ DEBUG: Sistema de combate unificado activado");

    // === CAMERA ===
    // Set up camera to follow player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(50, 50);
    this.cameras.main.setZoom(1.2); // Zoom ajustado para mejor proporción

    // Set world bounds - ajustar al tamaño real del tilemap para evitar desbordamiento
    const mapWidth = 500 * 24; // 12000px de ancho
    const mapHeight = 200; // 200px de alto (suficiente para el suelo)
    
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    
    console.log(`🎥 DEBUG: Cámara configurada - Mundo: ${mapWidth}x${mapHeight}, Zoom: 1.2`);

    // === DEBUG VISUAL ELIMINADO ===
    // Cuadrados morados eliminados para mejor experiencia
    console.log("🔍 DEBUG: Debug visual desactivado - juego limpio");

    // === DEPURACIÓN DE SPRITES ===
    // Contar todos los sprites para detectar duplicaciones
    const allSprites = this.children.list;
    const playerSprites = allSprites.filter(child => {
      const hasTexture = 'texture' in child && child.texture !== undefined;
      const isWaraTexture = hasTexture && (child.texture as any).key?.includes('wara');
      return child instanceof Player || isWaraTexture;
    });
    console.log(`🔍 DEBUG: Total sprites en escena: ${allSprites.length}`);
    console.log(`🔍 DEBUG: Sprites de Wara/Player: ${playerSprites.length}`);
    playerSprites.forEach((sprite, index) => {
      const textureKey = 'texture' in sprite ? (sprite.texture as any).key : 'unknown';
      const isVisible = 'visible' in sprite ? sprite.visible : 'unknown';
      const alpha = 'alpha' in sprite ? sprite.alpha : 'unknown';
      console.log(`🔍 DEBUG: Sprite ${index}: key=${textureKey}, visible=${isVisible}, alpha=${alpha}`);
    });

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

  /**
   * Maneja la interacción de combate unificada entre player y enemigos
   */
  private handleCombatInteraction(player: Player, enemy: any): void {
    // Cooldown para evitar múltiples llamadas rápidas
    const currentTime = this.time.now;
    if (currentTime - this.lastCombatTime < this.combatCooldownMs) {
      return; // Estamos en cooldown, ignorar
    }
    this.lastCombatTime = currentTime;
    
    console.log("⚔️ DEBUG: Interacción de combate detectada");
    console.log("⚔️ DEBUG: Tipo de objeto enemigo:", typeof enemy);
    
    // CRÍTICO: Obtener la instancia del enemigo desde la referencia guardada en el sprite
    let actualEnemy: any = enemy;
    
    // Si es un sprite, obtener la instancia del enemigo guardada
    if (enemy instanceof Phaser.GameObjects.Sprite) {
      console.log("⚔️ DEBUG: Enemigo es un sprite, obteniendo instancia desde enemyInstance");
      
      // Obtener la instancia del enemigo guardada en el sprite
      const enemyInstance = (enemy as any).enemyInstance;
      
      if (enemyInstance && typeof enemyInstance.takeDamage === 'function') {
        actualEnemy = enemyInstance;
        console.log("✅ DEBUG: Instancia del enemigo obtenida desde sprite");
        console.log("✅ DEBUG: Tipo de instancia:", typeof actualEnemy);
        console.log("✅ DEBUG: enemyType:", actualEnemy.enemyType);
      } else {
        console.error("❌ ERROR: El sprite no tiene enemyInstance o no tiene takeDamage");
        console.error("❌ enemyInstance:", enemyInstance);
        console.error("❌ Métodos en enemyInstance:", enemyInstance ? Object.getOwnPropertyNames(enemyInstance) : 'null');
        return;
      }
    }
    
    // Verificación final de que tenemos el objeto correcto con takeDamage
    if (typeof actualEnemy.takeDamage !== 'function') {
      console.error("❌ ERROR: El objeto colisionado no tiene el método takeDamage");
      console.error("❌ Tipo:", typeof actualEnemy);
      console.error("❌ Métodos disponibles:", Object.getOwnPropertyNames(actualEnemy));
      return;
    }
    
    // Verificar que el enemigo no esté muerto
    if (actualEnemy.isDead) {
      console.log("🛡️ DEBUG: Enemigo está muerto, ignorando");
      return;
    }
    
    // Si el player está atacando, aplicar daño al enemigo
    console.log("🔍 DEBUG: Verificando si player puede atacar...");
    console.log(`🔍 DEBUG: player.isAttackWindow(): ${player.isAttackWindow()}`);
    console.log(`🔍 DEBUG: player.getIsAttacking(): ${player.getIsAttacking()}`);
    console.log(`🔍 DEBUG: player.attackCooldownLeftMs: ${player.attackCooldownLeftMs}`);
    console.log(`🔍 DEBUG: actualEnemy.hp: ${actualEnemy.hp}/${actualEnemy.maxHp}`);
    console.log(`🔍 DEBUG: actualEnemy.isDead: ${actualEnemy.isDead}`);
    
    if (player.isAttackWindow()) {
      console.log("⚔️ DEBUG: Player está atacando, aplicando daño a enemigo");
      const damage = player.getCurrentAttackDamage();
      console.log(`⚔️ DEBUG: Daño a aplicar: ${damage}`);
      console.log(`⚔️ DEBUG: HP del enemigo antes: ${actualEnemy.hp}/${actualEnemy.maxHp}`);
      
      try {
        // SOLO usar el método normal - SIN FORZADO
        actualEnemy.takeDamage(damage, player.x, player.y, 200);
        console.log("✅ DEBUG: takeDamage ejecutado correctamente");
        console.log(`⚔️ DEBUG: HP del enemigo después: ${actualEnemy.hp}/${actualEnemy.maxHp}`);
        
        // SOLO verificar si murió (sin forzar)
        if (actualEnemy.hp <= 0) {
          console.log("💀 DEBUG: Enemigo murió naturalmente - animación debería ejecutarse");
        }
      } catch (error) {
        console.error("❌ ERROR al ejecutar takeDamage:", error);
      }
      return;
    }
    
    // Si no está atacando, aplicar daño al player
    // Verificar si el enemigo está en animación de muerte
    const enemySprite = actualEnemy.sprite || actualEnemy;
    if (enemySprite && enemySprite.anims && enemySprite.anims.currentAnim && 
        enemySprite.anims.currentAnim.key.includes('death')) {
      console.log("🛡️ DEBUG: Enemigo en animación de muerte, no aplica daño a player");
      return;
    }
    
    console.log("💔 DEBUG: Player no está atacando, aplicando daño al Player");
    console.log(`💔 DEBUG: Vida actual del Player: ${player.health}`);
    
    // Daño priorizado: Si es sirviente élite, daño mayor
    let damageAmount = 10;
    if (actualEnemy.enemyType === 'sirviente') {
      // Daño base por contacto: 10 HP
      damageAmount = 10;
      console.log("⚔️ DEBUG: Sirviente ÉLITE aplica daño de contacto: 10 HP");
      
      // Verificar si está ejecutando ataque especial para daño aumentado
      const enemySprite = actualEnemy.sprite || actualEnemy;
      if (enemySprite && enemySprite.anims && enemySprite.anims.currentAnim) {
        const currentAnim = enemySprite.anims.currentAnim.key;
        
        if (currentAnim === 'sirviente_attack') {
          // Si está en animación de ataque, daño aumentado a 30 HP
          damageAmount = 30;
          console.log("⚔️ DEBUG: Sirviente ÉLITE aplica daño especial (ataque): 30 HP");
        }
        
        // Verificar si está dash o golpe sísmico por estado
        if (actualEnemy.isDashing) {
          damageAmount = 25; // Dash alto daño
          console.log("⚔️ DEBUG: Sirviente ÉLITE aplica daño de dash: 25 HP");
        }
      }
    }
    
    player.takeDamage(damageAmount);
    console.log(`💔 DEBUG: Vida del Player después del daño: ${player.health}`);
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

    // === ANIMACIONES DE WARA (SPRITESHEETS) ===
    if (this.textures.exists('wara_idle')) {
      console.log("🎨 DEBUG: Creando animaciones de Wara desde spritesheets...");
      
      // Detectar automáticamente el número de frames
      const idleTexture = this.textures.get('wara_idle');
      const idleFrames = Math.floor(idleTexture.source[0].width / 32); // 32 = frameWidth corregido
      
      console.log(`🔍 DEBUG: Wara idle tiene ${idleFrames} frames`);
      
      // Animación IDLE
      this.anims.create({
        key: "wara_idle_anim",
        frames: this.anims.generateFrameNumbers("wara_idle", {
          start: 0,
          end: idleFrames - 1,
        }),
        frameRate: 8,
        repeat: -1,
      });

      // Animación WALK
      const walkTexture = this.textures.get('wara_walk');
      const walkFrames = Math.floor(walkTexture.source[0].width / 32);
      
      this.anims.create({
        key: "wara_walk_anim",
        frames: this.anims.generateFrameNumbers("wara_walk", {
          start: 0,
          end: walkFrames - 1,
        }),
        frameRate: 10,
        repeat: -1,
      });

      // Animación RUN
      const runTexture = this.textures.get('wara_run');
      const runFrames = Math.floor(runTexture.source[0].width / 32);
      
      this.anims.create({
        key: "wara_run_anim",
        frames: this.anims.generateFrameNumbers("wara_run", {
          start: 0,
          end: runFrames - 1,
        }),
        frameRate: 12,
        repeat: -1,
      });

      // Animación JUMP
      const jumpTexture = this.textures.get('wara_jump');
      const jumpFrames = Math.floor(jumpTexture.source[0].width / 32);
      
      this.anims.create({
        key: "wara_jump_anim",
        frames: this.anims.generateFrameNumbers("wara_jump", {
          start: 0,
          end: jumpFrames - 1,
        }),
        frameRate: 10,
        repeat: 0,
      });

      // Animación ATTACK
      const attackTexture = this.textures.get('wara_attack');
      const attackFrames = Math.floor(attackTexture.source[0].width / 32);
      
      this.anims.create({
        key: "wara_attack_anim",
        frames: this.anims.generateFrameNumbers("wara_attack", {
          start: 0,
          end: attackFrames - 1,
        }),
        frameRate: 15,
        repeat: 0,
      });

      // Animación AIR ATTACK
      const airAttackTexture = this.textures.get('wara_air_attack');
      const airAttackFrames = Math.floor(airAttackTexture.source[0].width / 32);
      
      this.anims.create({
        key: "wara_air_attack_anim",
        frames: this.anims.generateFrameNumbers("wara_air_attack", {
          start: 0,
          end: airAttackFrames - 1,
        }),
        frameRate: 15,
        repeat: 0,
      });

      console.log("✅ DEBUG: Animaciones de Wara creadas correctamente");
      console.log(`🔍 DEBUG: Frames detectados - idle:${idleFrames} walk:${walkFrames} run:${runFrames} jump:${jumpFrames} attack:${attackFrames} air_attack:${airAttackFrames}`);
    } else {
      console.log("❌ DEBUG: No se encontraron spritesheets de Wara");
    }

    // === ANIMACIONES DE ENEMIGOS ===
    if (this.textures.exists('alma_angry_idle')) {
      console.log("👾 DEBUG: Creando animaciones de Alma en Pena Enojada con medidas reales...");
      
      // Detectar frames para alma enojada idle (48x48)
      const angryIdleTexture = this.textures.get('alma_angry_idle');
      const angryIdleFrames = Math.floor(angryIdleTexture.source[0].width / 48); // 48 = frameWidth real
      
      // Animación IDLE (reposo)
      this.anims.create({
        key: "alma_angry_idle_anim",
        frames: this.anims.generateFrameNumbers("alma_angry_idle", {
          start: 0,
          end: angryIdleFrames - 1,
        }),
        frameRate: 8, // Aumentado a 8 para mayor fluidez
        repeat: -1,
      });
      
      console.log(`👾 DEBUG: Alma angry idle tiene ${angryIdleFrames} frames (48x48)`);
    }
    
    if (this.textures.exists('alma_angry_death')) {
      // Detectar frames para alma enojada muerte (32x96)
      const angryDeathTexture = this.textures.get('alma_angry_death');
      const angryDeathFrames = Math.floor(angryDeathTexture.source[0].width / 32); // 32 = frameWidth real
      
      // Animación DEATH (muerte) - UNA SOLA VEZ
      this.anims.create({
        key: "alma_angry_death_anim",
        frames: this.anims.generateFrameNumbers("alma_angry_death", {
          start: 0,
          end: angryDeathFrames - 1,
        }),
        frameRate: 10, // Aumentado a 10 para mayor fluidez
        repeat: 0, // CRÍTICO: Solo una vez
      });
      
      console.log(`👾 DEBUG: Alma angry death tiene ${angryDeathFrames} frames (32x96)`);
    }
    
    // === ANIMACIONES DE SIRVIENTE PIRICHUCHO ===
    if (this.textures.exists('sirviente_aleteo')) {
      console.log("👾 DEBUG: Creando animaciones de Sirviente Pirichucho...");
      
      // Animación WALK (aleteo) - 6 frames de 48x48
      const walkTexture = this.textures.get('sirviente_aleteo');
      const walkFrames = Math.floor(walkTexture.source[0].width / 48); // 288/48 = 6 frames
      
      this.anims.create({
        key: "sirviente_walk",
        frames: this.anims.generateFrameNumbers("sirviente_aleteo", {
          start: 0,
          end: walkFrames - 1,
        }),
        frameRate: 8,
        repeat: -1,
      });
      
      console.log(`👾 DEBUG: Sirviente walk tiene ${walkFrames} frames (48x48)`);
    }
    
    if (this.textures.exists('sirviente_golpe')) {
      // Animación ATTACK (golpecito) - 6 frames de 48x96
      const attackTexture = this.textures.get('sirviente_golpe');
      const attackFrames = Math.floor(attackTexture.source[0].width / 48); // 288/48 = 6 frames
      
      this.anims.create({
        key: "sirviente_attack",
        frames: this.anims.generateFrameNumbers("sirviente_golpe", {
          start: 0,
          end: attackFrames - 1,
        }),
        frameRate: 10,
        repeat: 0,
      });
      
      console.log(`👾 DEBUG: Sirviente attack tiene ${attackFrames} frames (48x96)`);
    }
    
    if (this.textures.exists('sirviente_muerte')) {
      // Animación DEATH (muerte) - 9 frames de 32x96
      const deathTexture = this.textures.get('sirviente_muerte');
      const deathFrames = Math.floor(deathTexture.source[0].width / 32); // 288/32 = 9 frames
      
      this.anims.create({
        key: "sirviente_death",
        frames: this.anims.generateFrameNumbers("sirviente_muerte", {
          start: 0,
          end: deathFrames - 1,
        }),
        frameRate: 10,
        repeat: 0,
      });
      
      console.log(`👾 DEBUG: Sirviente death tiene ${deathFrames} frames (32x96)`);
    }
    
    console.log("✅ DEBUG: Animaciones de Sirviente Pirichucho creadas correctamente");
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
