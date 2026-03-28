import { EventBus } from "../core/EventBus";
import { Player } from "../entities/Player";
import { Pachita } from "../entities/Pachita";
import { EnemyAISystem } from "./EnemyAISystem";

/**
 * Sistema de Debug Centralizado
 * Maneja el modo debug con F1, mostrando hitboxes y estados
 */
export class DebugSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private pachita: Pachita;
  private enemyAISystem: EnemyAISystem;
  
  private debugEnabled: boolean = false;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private debugKey!: Phaser.Input.Keyboard.Key;

  constructor(
    scene: Phaser.Scene, 
    player: Player, 
    pachita: Pachita, 
    enemyAISystem: EnemyAISystem
  ) {
    this.scene = scene;
    this.player = player;
    this.pachita = pachita;
    this.enemyAISystem = enemyAISystem;
    this.initialize();
  }

  /**
   * Inicializa el sistema de debug
   */
  private initialize(): void {
    // Configurar tecla F1 para toggle debug
    this.debugKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
    
    // Crear elementos gráficos de debug
    this.debugGraphics = this.scene.add.graphics().setDepth(1002);
    this.debugGraphics.setVisible(false);
    
    this.debugText = this.scene.add.text(10, 60, "", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#00ffff",
      stroke: "#000000",
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(1003);
    this.debugText.setVisible(false);
  }

  /**
   * Actualiza el sistema de debug
   */
  public update(): void {
    // Toggle debug mode con F1
    if (Phaser.Input.Keyboard.JustDown(this.debugKey)) {
      this.toggleDebug();
    }

    if (this.debugEnabled) {
      this.updateDebugDisplay();
    }
  }

  /**
   * Activa/desactiva el modo debug
   */
  private toggleDebug(): void {
    this.debugEnabled = !this.debugEnabled;
    this.debugGraphics.setVisible(this.debugEnabled);
    this.debugText.setVisible(this.debugEnabled);
  }

  /**
   * Actualiza la visualización de debug
   */
  private updateDebugDisplay(): void {
    // Limpiar gráficos anteriores
    this.debugGraphics.clear();
    this.debugGraphics.lineStyle(1, 0xffff00, 1);

    // Dibujar hitbox del jugador
    this.drawPlayerHitbox();
    
    // Dibujar hitboxes de enemigos
    this.drawEnemyHitboxes();
    
    // Dibujar información de debug
    this.updateDebugText();
  }

  /**
   * Dibuja el hitbox del jugador
   */
  private drawPlayerHitbox(): void {
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    if (pBody) {
      // Hitbox principal
      this.debugGraphics.strokeRect(pBody.x, pBody.y, pBody.width, pBody.height);
      
      // Indicador de ventana de ataque
      if (this.player.isAttackWindow()) {
        this.debugGraphics.fillStyle(0xff0000, 0.3);
        this.debugGraphics.fillRect(pBody.x - 5, pBody.y - 5, pBody.width + 10, pBody.height + 10);
      }
      
      // Indicador de invulnerabilidad
      if (this.player.getIsInvulnerable()) {
        this.debugGraphics.fillStyle(0x00ff00, 0.2);
        this.debugGraphics.fillRect(pBody.x, pBody.y, pBody.width, pBody.height);
      }
    }
  }

  /**
   * Dibuja los hitboxes de los enemigos
   */
  private drawEnemyHitboxes(): void {
    const enemies = this.enemyAISystem.getEnemies();
    
    enemies.forEach((enemy) => {
      const eBody = enemy.sprite.body as Phaser.Physics.Arcade.Body;
      if (eBody) {
        // Hitbox principal
        this.debugGraphics.strokeRect(eBody.x, eBody.y, eBody.width, eBody.height);
        
        // Color según estado
        const stateColors = {
          idle: 0x00ff00,
          patrol: 0xffff00,
          chase: 0xff8800,
          attack: 0xff0000
        };
        
        const stateColor = stateColors[enemy.getStateName() as keyof typeof stateColors] || 0xffffff;
        this.debugGraphics.fillStyle(stateColor, 0.2);
        this.debugGraphics.fillRect(eBody.x, eBody.y, eBody.width, eBody.height);
        
        // Indicador de HP
        const hpPercent = enemy.hp / enemy.maxHp;
        const barWidth = 30;
        const barHeight = 3;
        this.debugGraphics.fillStyle(0xff0000, 0.8);
        this.debugGraphics.fillRect(eBody.x, eBody.y - 8, barWidth, barHeight);
        this.debugGraphics.fillStyle(0x00ff00, 0.8);
        this.debugGraphics.fillRect(eBody.x, eBody.y - 8, barWidth * hpPercent, barHeight);
      }
    });
  }

  /**
   * Actualiza el texto de debug
   */
  private updateDebugText(): void {
    const enemies = this.enemyAISystem.getEnemies();
    const enemyStats = this.enemyAISystem.getStats();
    
    const debugInfo = [
      `DEBUG ON`,
      `Player: hp=${Math.ceil(this.player.health)}/${this.player.maxHealth} level=${this.player.getLevel()}`,
      `Pachita: totalXp=${Math.ceil(this.pachita.totalXp)} level=${this.pachita.getLevel()}`,
      `Heal XP: ${Math.ceil(this.pachita.xp)}/${this.pachita.xpToHealCost}`,
      `AttackWindow: ${this.player.isAttackWindow() ? "YES" : "NO"} inst=${this.player.getAttackInstanceId()}`,
      `Invulnerable: ${this.player.getIsInvulnerable() ? "YES" : "NO"}`,
      `Enemies: ${enemyStats.alive}/${enemyStats.maxAlive} total=${enemyStats.totalSpawned}`,
      ...enemies.slice(0, 5).map((enemy) => 
        `E:${enemy.id.split("_")[0]} ${enemy.kind} ${enemy.getStateName()} hp=${enemy.hp}/${enemy.maxHp}`
      )
    ];

    this.debugText.setText(debugInfo.join("\n"));
  }

  /**
   * Verifica si el modo debug está activo
   */
  public isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  /**
   * Limpia el sistema de debug
   */
  public destroy(): void {
    if (this.debugGraphics) this.debugGraphics.destroy();
    if (this.debugText) this.debugText.destroy();
  }
}
