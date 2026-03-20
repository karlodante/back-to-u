type Callback = (data?: any) => void;

/**
 * Sistema de Eventos Global (Event Bus)
 * Permite la comunicación desacoplada entre sistemas (ej. Player -> HUD).
 */
export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Callback[]> = new Map();

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Suscribirse a un evento.
   */
  on(event: string, callback: Callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  /**
   * Emitir un evento.
   */
  emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  /**
   * Eliminar suscripción.
   */
  off(event: string, callback: Callback) {
    const list = this.listeners.get(event);
    if (list) {
      this.listeners.set(event, list.filter(cb => cb !== callback));
    }
  }
}
