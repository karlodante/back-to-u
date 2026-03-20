/**
 * Sistema de Guardado
 * Maneja la persistencia de datos en LocalStorage.
 */
export class SaveSystem {
  private static readonly SAVE_KEY = "vibe_oak_woods_save";

  /**
   * Guardar datos.
   */
  static save(data: any) {
    try {
      const jsonData = JSON.stringify(data);
      localStorage.setItem(this.SAVE_KEY, jsonData);
    } catch (e) {
      console.error("Error guardando datos:", e);
    }
  }

  /**
   * Cargar datos.
   */
  static load(): any | null {
    try {
      const jsonData = localStorage.getItem(this.SAVE_KEY);
      return jsonData ? JSON.parse(jsonData) : null;
    } catch (e) {
      console.error("Error cargando datos:", e);
      return null;
    }
  }

  /**
   * Borrar datos.
   */
  static clear() {
    localStorage.removeItem(this.SAVE_KEY);
  }
}
