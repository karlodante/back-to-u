import { Scene } from "../core/Scene";
import { CustomPlayer } from "../entities/CustomPlayer";
import { BasicEnemy } from "../entities/BasicEnemy";
import { Vector2 } from "../math/Vector2";
import { CollisionSystem } from "../systems/CollisionSystem";
import { CustomHUD } from "../ui/CustomHUD";
import { CombatSystem } from "../systems/CombatSystem";
import { Camera } from "../core/Camera";
import { EventBus } from "../core/EventBus";
import { Debugger } from "../core/Debugger";
import { SaveSystem } from "../core/SaveSystem";
import { Tilemap } from "../core/Tilemap";
import { Spawner } from "../systems/Spawner";

/**
 * Escena de prueba del motor personalizado profesional.
 */
export class DevScene extends Scene {
  private player!: CustomPlayer;
  private enemies: BasicEnemy[] = [];
  private staticHazards: { x: number; y: number; w: number; h: number }[] = [];
  private hud!: CustomHUD;
  private camera!: Camera;
  private tilemap!: Tilemap;
  private spawner!: Spawner;

  init() {
    this.player = new CustomPlayer("player_1");
    this.hud = new CustomHUD(this.player);
    this.camera = new Camera(800, 600);
    this.camera.setTarget(this.player);

    // 1. Crear Tilemap simple
    const mapData = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ];
    this.tilemap = new Tilemap(100, mapData);

    // 2. Configurar Spawner
    this.spawner = new Spawner(
      this, 
      (x, y) => {
        const e = new BasicEnemy(`enemy_${Date.now()}`, [new Vector2(x, y), new Vector2(x + 100, y)]);
        e.setTarget(this.player);
        return e;
      },
      5.0, // cada 5 segundos
      3    // máximo 3 enemigos
    );

    // Cargar datos guardados...
    const saveData = SaveSystem.load();
    if (saveData) {
      this.player.xp = saveData.xp || 0;
    }

    EventBus.getInstance().on("player_death", () => {
      console.log("¡Game Over!");
    });
  }

  // Método requerido por el Spawner
  addEntity(entity: BasicEnemy) {
    this.enemies.push(entity);
  }

  update(dt: number) {
    this.player.update(dt, this.tilemap);
    this.enemies.forEach(e => e.update(dt, this.tilemap));
    this.camera.update(dt);
    this.spawner.update(dt, this.enemies.length);
    Debugger.update();

    // Colisiones entre entidades
    this.enemies.forEach(enemy => {
      if (CollisionSystem.checkCollision(this.player, enemy)) {
        if (this.player.getCurrentStateName?.() !== "dash") {
          CombatSystem.dealDamage(enemy, this.player, 10 * dt, 200);
        }
        CollisionSystem.resolveCollision(this.player, enemy);
      }
    });

    if (Math.random() < 0.001) SaveSystem.save({ xp: this.player.xp });
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.camera.apply(ctx);

    // Dibujar Tilemap
    this.tilemap.render(ctx);
    
    this.player.render(ctx);
    this.enemies.forEach(e => e.render(ctx));

    this.camera.restore(ctx);
    this.hud.render(ctx);
    Debugger.render(ctx, [this.player, ...this.enemies]);
  }

  cleanup() {
    this.enemies = [];
  }
}
