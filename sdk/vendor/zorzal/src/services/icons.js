/**
 * Servicio de iconos.
 *
 * El set es propio: cada icono son trazos SVG sobre una grilla de 24x24 con
 * `stroke-width` 2, sin fuentes externas, dependencias ni licencias de
 * terceros. El widget `icon` consume este servicio: `getIcon(nombre)` devuelve
 * la lista de formas `{ d }` que el widget convierte en nodos `path`.
 *
 * Un nombre desconocido resuelve al icono por defecto (`dot`), que es lo que
 * el widget dibuja cuando recibe un nombre que no existe.
 */

/** Grilla sobre la que estan dibujados los trazos. */
export const VIEW_BOX = '0 0 24 24';

/** Grosor de trazo del set; el widget lo aplica al SVG. */
export const STROKE_WIDTH = 2;

/** Icono que se dibuja cuando el nombre pedido no resuelve. */
export const DEFAULT_ICON = 'dot';

/**
 * Set de iconos: nombre -> lista de formas `{ d }`.
 *
 * @type {Record<string, Array<{ d: string }>>}
 */
export const ICONS = {
  // --- base (15 iconos previos) ---------------------------------------
  check: [{ d: 'M4 12.5l5 5L20 6.5' }],
  close: [{ d: 'M6 6l12 12' }, { d: 'M18 6L6 18' }],
  search: [{ d: 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z' }, { d: 'M16.2 16.2L21 21' }],
  info: [{ d: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z' }, { d: 'M12 11v6' }, { d: 'M12 7.6v.2' }],
  alert: [{ d: 'M12 3.5L21 20H3L12 3.5z' }, { d: 'M12 9.5v5' }, { d: 'M12 17.4v.2' }],
  plus: [{ d: 'M12 5v14' }, { d: 'M5 12h14' }],
  minus: [{ d: 'M5 12h14' }],
  'chevron-down': [{ d: 'M6 9l6 6 6-6' }],
  'chevron-up': [{ d: 'M6 15l6-6 6 6' }],
  star: [{ d: 'M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9L12 3.5z' }],
  user: [{ d: 'M12 4.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' }, { d: 'M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5' }],
  home: [{ d: 'M4 11l8-7 8 7' }, { d: 'M6.5 9.5V20h11V9.5' }],
  menu: [{ d: 'M4 7h16' }, { d: 'M4 12h16' }, { d: 'M4 17h16' }],
  trash: [{ d: 'M5 7h14' }, { d: 'M9 7V5h6v2' }, { d: 'M7 7l1 13h8l1-13' }],
  dot: [{ d: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z' }],

  // --- navegacion y tablero -------------------------------------------
  dashboard: [
    { d: 'M4.5 4.5h6V11h-6z' },
    { d: 'M13.5 4.5h6v3.5h-6z' },
    { d: 'M13.5 11h6v8.5h-6z' },
    { d: 'M4.5 14h6v5.5h-6z' },
  ],
  'ellipsis-v': [{ d: 'M12 5.9v.2' }, { d: 'M12 11.9v.2' }, { d: 'M12 17.9v.2' }],
  cog: [
    { d: 'M9.9 6.8L10.6 3.9L13.4 3.9L14.1 6.8L14.1 6.8L16.7 5.3L18.7 7.3L17.2 9.9L17.2 9.9L20.1 10.6L20.1 13.4L17.2 14.1L17.2 14.1L18.7 16.7L16.7 18.7L14.1 17.2L14.1 17.2L13.4 20.1L10.6 20.1L9.9 17.2L9.9 17.2L7.3 18.7L5.3 16.7L6.8 14.1L6.8 14.1L3.9 13.4L3.9 10.6L6.8 9.9L6.8 9.9L5.3 7.3L7.3 5.3L9.9 6.8Z' },
    { d: 'M12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z' },
  ],
  'chevron-left': [{ d: 'M15 6l-6 6 6 6' }],

  // --- sistema y estado -----------------------------------------------
  'power-off': [{ d: 'M12 3.5v8.5' }, { d: 'M7.5 5.9a8.5 8.5 0 1 0 9 0' }],
  question: [
    { d: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z' },
    { d: 'M9.2 9.2a3 3 0 0 1 5.5 1c0 1.9-2.6 2.4-2.6 3.9' },
    { d: 'M12 17.1v.2' },
  ],
  save: [
    { d: 'M4.5 4.5h11l4 4v11h-15z' },
    { d: 'M8 4.5V10h7V4.5' },
    { d: 'M8 19.5v-6h8v6' },
  ],
  'cloud-upload': [
    { d: 'M6.8 16a3.9 3.9 0 0 1 1.4-7.5 5.1 5.1 0 0 1 9.5 1.2 3.5 3.5 0 0 1 .1 6.3' },
    { d: 'M12 20.5v-7' },
    { d: 'M8.8 16.7L12 13.5l3.2 3.2' },
  ],

  // --- comercio y agenda ----------------------------------------------
  ticket: [
    { d: 'M4 7.5h16V10a1 1 0 0 0 0 2v4.5H4V12a1 1 0 0 0 0-2V7.5z' },
    { d: 'M12 9v1.6' },
    { d: 'M12 13.4v1.6' },
  ],
  'address-book': [
    { d: 'M7.5 4.5H19a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7.5z' },
    { d: 'M7.5 4.5v15' },
    { d: 'M4.5 8.5h3' },
    { d: 'M4.5 12h3' },
    { d: 'M4.5 15.5h3' },
    { d: 'M11 9h5.5' },
    { d: 'M11 12h5.5' },
    { d: 'M11 15h3.5' },
  ],
  'shopping-bag': [
    { d: 'M5.5 8.5h13l-1 11.5h-11L5.5 8.5z' },
    { d: 'M9 8.5V7a3 3 0 0 1 6 0v1.5' },
  ],
  'shopping-cart': [
    { d: 'M3 4.5h2.2l2.5 10.5h9.8' },
    { d: 'M6.2 7.5h13.4l-1.7 5.5H8' },
    { d: 'M9.5 18.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z' },
    { d: 'M17.2 18.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z' },
  ],
  truck: [
    { d: 'M2.5 6.5h11V16h-11z' },
    { d: 'M13.5 9.5h4l3 3.2V16h-7z' },
    { d: 'M6 16.3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z' },
    { d: 'M17 16.3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z' },
  ],
  flag: [{ d: 'M6.5 3.5v17' }, { d: 'M6.5 4.5h11l-2.4 4 2.4 4h-11' }],
};

/**
 * Alias de nombres: el alias responde a `hasIcon` y `getIcon` con los trazos
 * del nombre real. Se mantiene para no renombrar las pantallas que ya usan el
 * nombre alternativo.
 *
 * @type {Record<string, string>}
 */
export const ICON_ALIASES = {
  bars: 'menu',
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/** @param {unknown} value @returns {string} */
function asName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Nombre real del icono. Resuelve los alias y, si el nombre no existe o no es
 * un string, devuelve `DEFAULT_ICON`.
 *
 * @param {unknown} name
 * @returns {string}
 */
export function resolveIcon(name) {
  const key = asName(name);
  if (hasOwn(ICONS, key)) return key;
  if (hasOwn(ICON_ALIASES, key)) {
    const target = ICON_ALIASES[key];
    if (hasOwn(ICONS, target)) return target;
  }
  return DEFAULT_ICON;
}

/**
 * Indica si el nombre existe en el set (incluidos los alias).
 *
 * @param {unknown} name
 * @returns {boolean}
 */
export function hasIcon(name) {
  const key = asName(name);
  if (hasOwn(ICONS, key)) return true;
  return hasOwn(ICON_ALIASES, key) && hasOwn(ICONS, ICON_ALIASES[key]);
}

/**
 * Formas `{ d }` del icono. Un nombre desconocido devuelve los trazos de
 * `DEFAULT_ICON`, igual que el render del widget.
 *
 * @param {unknown} name
 * @returns {Array<{ d: string }>}
 */
export function getIcon(name) {
  return ICONS[resolveIcon(name)];
}

/**
 * Normaliza una lista de trazos. Acepta strings con el atributo `d` o formas
 * `{ d }` (con atributos extra opcionales).
 *
 * @param {unknown} paths
 * @returns {Array<{ d: string }>}
 */
function toShapes(paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  if (list.length === 0) {
    throw new TypeError('icons.addIcon: hace falta al menos un trazo');
  }
  return list.map((shape) => {
    const source = typeof shape === 'string' ? { d: shape } : shape;
    const d = source && typeof source.d === 'string' ? source.d.trim() : '';
    if (d === '') {
      throw new TypeError('icons.addIcon: cada trazo necesita un atributo "d" no vacio');
    }
    return { ...source, d };
  });
}

/**
 * Agrega o reemplaza un icono. Si el nombre era un alias, el alta lo convierte
 * en un icono propio con esos trazos.
 *
 * @param {string} name
 * @param {Array<string|{ d: string }>|string|{ d: string }} paths
 * @returns {Array<{ d: string }>} los trazos registrados
 */
export function addIcon(name, paths) {
  const key = asName(name);
  if (key === '') {
    throw new TypeError('icons.addIcon: el nombre no puede estar vacio');
  }
  const shapes = toShapes(paths);
  ICONS[key] = shapes;
  delete ICON_ALIASES[key];
  return shapes;
}

/**
 * Nombres disponibles, incluidos los alias, en orden de alta.
 *
 * @returns {string[]}
 */
export function iconNames() {
  const names = Object.keys(ICONS);
  for (const alias of Object.keys(ICON_ALIASES)) {
    if (!hasOwn(ICONS, alias)) names.push(alias);
  }
  return names;
}

/** Namespace del servicio, para `ui.icons` y las exportaciones. */
export const icons = {
  getIcon,
  hasIcon,
  addIcon,
  iconNames,
  resolveIcon,
  ICONS,
  ICON_ALIASES,
  DEFAULT_ICON,
  VIEW_BOX,
  STROKE_WIDTH,
};

export default icons;
