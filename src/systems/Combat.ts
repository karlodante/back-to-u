export class Combat {
  /**
   * Deals damage to a target entity that has a takeDamage method.
   * @param target The target to receive damage.
   * @param amount The amount of damage to deal.
   */
  static dealDamage(target: { takeDamage: (amount: number) => void }, amount: number): void {
    if (target && typeof target.takeDamage === "function") {
      target.takeDamage(amount);
    }
  }
}
