export class Dash {
  public dashSpeed: number = 400;
  public dashDuration: number = 200;
  public cooldownTime: number = 1000;

  /**
   * Tries to start a dash for the player.
   * @param player The player entity to dash.
   * @param dx Current movement direction (-1, 0, 1).
   */
  public tryDash(player: any, dx: number): void {
    if (player.dashCooldown <= 0 && !player.isDashing) {
      player.isDashing = true;
      player.dashCooldown = this.cooldownTime;
      
      // Determine dash direction
      const dashDir = dx !== 0 ? dx : (player.flipX ? -1 : 1);
      
      // Execute the dash (assuming Phaser physics)
      if (player.setVelocityX) {
        player.setVelocityX(dashDir * this.dashSpeed);
        player.setVelocityY(0);
      }
      
      player.setAlpha(0.7);

      // End dash after duration
      player.scene.time.delayedCall(this.dashDuration, () => {
        player.isDashing = false;
        player.setAlpha(1);
      });
    }
  }

  /**
   * Updates dash cooldown.
   * @param player The player entity to update.
   * @param delta Delta time in ms.
   */
  public update(player: any, delta: number = 16.67): void {
    if (player.dashCooldown > 0) {
      player.dashCooldown -= delta;
    }
  }
}
