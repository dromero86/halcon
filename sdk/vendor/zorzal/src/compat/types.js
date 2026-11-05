/**
 * type: registro de tipos de plantilla para las vistas de datos.
 *
 * `add(name, config)` guarda la configuracion y `get(name)` la devuelve. El
 * registro es un mapa del proceso: re registrar un nombre reemplaza la
 * configuracion anterior, como se espera al recargar una pantalla.
 */

const registry = new Map();

export const type = {
  /**
   * @param {string} name
   * @param {Record<string, unknown>} [config]
   * @returns {Record<string, unknown>} la configuracion guardada
   */
  add(name, config = {}) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new TypeError('compat.type.add: el nombre debe ser un string no vacio');
    }
    if (!config || typeof config !== 'object') {
      throw new TypeError(`compat.type.add("${name}"): la config debe ser un objeto`);
    }
    registry.set(name, config);
    return config;
  },

  /**
   * @param {string} name
   * @returns {Record<string, unknown>|null}
   */
  get(name) {
    if (typeof name !== 'string') return null;
    return registry.has(name) ? registry.get(name) : null;
  },
};

export default type;
