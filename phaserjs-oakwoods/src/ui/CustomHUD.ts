import { CustomPlayer } from "../entities/CustomPlayer";

/**
 * HUD lógico para el motor personalizado.
 */
export class CustomHUD {
  private player: CustomPlayer;

  constructor(player: CustomPlayer) {
    this.player = player;
  }

  render(ctx: CanvasRenderingContext2D) {
    // Fondo de HUD
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(10, 10, 220, 70);

    // Texto de Vida
    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial";
    ctx.fillText("JUGADOR", 20, 30);
    
    // Barra de Vida
    const barWidth = 150;
    const barHeight = 15;
    const healthRatio = this.player.health / this.player.maxHealth;
    
    ctx.fillStyle = "#333";
    ctx.fillRect(20, 40, barWidth, barHeight);
    ctx.fillStyle = healthRatio > 0.3 ? "#2ecc71" : "#e74c3c";
    ctx.fillRect(20, 40, barWidth * healthRatio, barHeight);
    
    // Texto numérico de vida
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText(`${Math.ceil(this.player.health)} / ${this.player.maxHealth} HP`, 180, 52);

    // Indicador de Dash (lógico, sin barra aún)
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    const dashCooldown = this.player.getDashCooldownProgress();
    const dashText = dashCooldown > 0 ? `DASH: CARGANDO (${Math.ceil(dashCooldown * 100)}%)` : "DASH: ¡LISTO!";
    ctx.fillText(dashText, 20, 70);
  }
}
