/**
 * Interfaz para un estado individual.
 */
export interface State {
  name: string;
  enter?: () => void;
  update?: (dt: number) => void;
  exit?: () => void;
}

/**
 * Máquina de Estados Finita (FSM)
 * Gestiona la transición y actualización de estados para entidades.
 */
export class StateMachine {
  private states: Map<string, State> = new Map();
  private currentState: State | null = null;

  /**
   * Añadir un estado a la máquina.
   */
  add(state: State) {
    this.states.set(state.name, state);
  }

  /**
   * Cambiar al estado especificado.
   */
  change(name: string) {
    if (this.currentState?.name === name) return;

    const nextState = this.states.get(name);
    if (nextState) {
      this.currentState?.exit?.();
      this.currentState = nextState;
      this.currentState.enter?.();
    } else {
      console.warn(`Estado "${name}" no encontrado.`);
    }
  }

  /**
   * Actualizar el estado actual.
   */
  update(dt: number) {
    this.currentState?.update?.(dt);
  }

  getCurrentStateName(): string {
    return this.currentState?.name || "none";
  }
}
