/**
 * Plugin `mainbar` como kind de Zorzal.
 *
 * Conserva la estructura original: una toolbar con el logo, el boton que
 * colapsa la barra lateral, la caja de busqueda y el boton de opciones.
 *
 * El kind se registra con `define('mainbar', factory)`. El factory arma una
 * `toolbar` de Zorzal: los botones son items del toolbar (por eso salen como
 * `.z-toolbar__button`), el logo y la busqueda son widgets anidados, y los
 * iconos se pintan con el set de Zorzal al montar.
 *
 * API del plugin:
 *
 *  - `setSidebarToggle(handler)`: reemplaza el toggle lateral. El handler
 *    devuelve `true` si se hizo cargo del cambio; el dashboard lo usa para
 *    abrir el drawer en pantallas angostas y para contraer el sidebar en
 *    escritorio.
 *  - `logo`: plantilla del logo (`_mb_logo`).
 *  - `action`: nodo del boton de colapso (`_main_btn_action`).
 *  - `theme`: nodo del boton de tema (`_main_btn_theme`).
 *  - `options`: nodo del boton de opciones (`_main_tool_option`).
 *  - `search`: campo de busqueda (`_main_search`).
 *  - `paintLogo(collapsed)`: cambia el texto y la clase del logo.
 *  - `toggleTheme()`: alterna claro/oscuro y repinta el boton.
 *
 * Tema claro/oscuro: el boton escribe `data-theme` en el elemento raiz del
 * documento y guarda la eleccion en `localStorage` con la clave `hc-theme`. Sin
 * eleccion guardada no se escribe el atributo: el CSS resuelve con
 * `prefers-color-scheme`. El acceso a `localStorage` y a `matchMedia` esta
 * siempre dentro de funciones, nunca al importar el modulo.
 *
 * Limitaciones conocidas: la plantilla del logo es de texto (Zorzal interpola
 * texto, no HTML) y el colapso cambia el contenido y una clase CSS, no el
 * ancho real.
 */

import { create, define } from '../../vendor/zorzal/src/zorzal.js';
import { usr, __ } from '../../compat/globals.js';
import { paintIcon, paintIconSpans } from '../../compat/icons.js';
import { icons } from '../../vendor/zorzal/src/services/icons.js';

/** Id del logo. */
export const LOGO_ID = '_mb_logo';

/** Id del boton de colapso de la barra lateral. */
export const ACTION_ID = '_main_btn_action';

/** Id de la caja de busqueda. */
export const SEARCH_ID = '_main_search';

/** Id del boton de opciones. */
export const OPTION_ID = '_main_tool_option';

/** Id del boton de tema. */
export const THEME_ID = '_main_btn_theme';

/** Clave de `localStorage` donde se guarda la eleccion de tema. */
export const THEME_KEY = 'hc-theme';

/** Atributo del elemento raiz que fija el tema. */
export const THEME_ATTR = 'data-theme';

/** Nombre del tema claro. */
export const THEME_LIGHT = 'light';

/** Nombre del tema oscuro. */
export const THEME_DARK = 'dark';

/** Icono del boton cuando el tema activo es el claro. */
const THEME_ICON_LIGHT = 'moon';

/** Icono del boton cuando el tema activo es el oscuro. */
const THEME_ICON_DARK = 'sun';

/** Etiqueta del boton cuando el tema activo es el claro. */
const THEME_LABEL_TO_DARK = 'Activar tema oscuro';

/** Etiqueta del boton cuando el tema activo es el oscuro. */
const THEME_LABEL_TO_LIGHT = 'Activar tema claro';

/**
 * El set de Zorzal no trae `moon` ni `sun`: se dan de alta con el mismo
 * formato que el resto (grilla 24x24, trazo de 2 px, `currentColor`) usando el
 * alta publica del servicio. Se hace al importar el modulo porque no toca el
 * DOM ni el almacenamiento.
 */
icons.addIcon('moon', [{ d: 'M20 13.2A8.5 8.5 0 1 1 10.8 4 6.8 6.8 0 0 0 20 13.2z' }]);
icons.addIcon('sun', [
  { d: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z' },
  { d: 'M12 2.5v2' },
  { d: 'M12 19.5v2' },
  { d: 'M2.5 12h2' },
  { d: 'M19.5 12h2' },
  { d: 'M5.1 5.1l1.4 1.4' },
  { d: 'M17.5 17.5l1.4 1.4' },
  { d: 'M18.9 5.1l-1.4 1.4' },
  { d: 'M6.5 17.5l-1.4 1.4' },
]);

/** Texto del logo cuando la barra esta colapsada. */
const LOGO_COLLAPSED = 'GN';

/**
 * Documento del entorno, si existe.
 * @returns {Document|null}
 */
function currentDocument() {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.document || null;
}

/**
 * Elemento que lleva `data-theme`: la raiz del documento.
 * @param {Document|null} [doc]
 * @returns {Element|null}
 */
function themeRoot(doc = currentDocument()) {
  if (!doc) return null;
  return doc.documentElement || doc.body || null;
}

/**
 * `localStorage` del entorno, si esta disponible y se puede leer.
 * @returns {Storage|null}
 */
function themeStorage() {
  if (typeof globalThis === 'undefined') return null;
  try {
    const storage = globalThis.localStorage;
    return storage && typeof storage.getItem === 'function' ? storage : null;
  } catch (error) {
    return null;
  }
}

/**
 * Tema guardado por el usuario.
 * @returns {'light'|'dark'|null}
 */
export function readThemePreference() {
  const storage = themeStorage();
  if (!storage) return null;
  try {
    const value = storage.getItem(THEME_KEY);
    if (value === THEME_DARK) return THEME_DARK;
    if (value === THEME_LIGHT) return THEME_LIGHT;
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Guarda la eleccion. Devuelve `false` si no hay almacenamiento disponible.
 * @param {'light'|'dark'} theme
 * @returns {boolean}
 */
export function saveThemePreference(theme) {
  const storage = themeStorage();
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(THEME_KEY, theme === THEME_DARK ? THEME_DARK : THEME_LIGHT);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Tema que pide el sistema. `null` si el entorno no expone `matchMedia`.
 * @returns {'light'|'dark'|null}
 */
export function systemTheme() {
  if (typeof globalThis === 'undefined') return null;
  try {
    const matchMedia = globalThis.matchMedia;
    if (typeof matchMedia !== 'function') return null;
    const query = matchMedia('(prefers-color-scheme: dark)');
    if (!query) return null;
    return query.matches === true ? THEME_DARK : THEME_LIGHT;
  } catch (error) {
    return null;
  }
}

/**
 * Tema efectivo: el atributo escrito en la raiz, si no la eleccion guardada, si
 * no lo que pide el sistema y, como ultimo recurso, el claro.
 * @param {{ doc?: Document, root?: Element }} [options]
 * @returns {'light'|'dark'}
 */
export function currentTheme(options = {}) {
  const root = options.root || themeRoot(options.doc);
  const attr = root && typeof root.getAttribute === 'function' ? root.getAttribute(THEME_ATTR) : null;
  if (attr === THEME_DARK) return THEME_DARK;
  if (attr === THEME_LIGHT) return THEME_LIGHT;
  return readThemePreference() || systemTheme() || THEME_LIGHT;
}

/**
 * Escribe `data-theme` en la raiz.
 * @param {'light'|'dark'} theme
 * @param {{ doc?: Document, root?: Element }} [options]
 * @returns {'light'|'dark'} el tema aplicado
 */
export function applyTheme(theme, options = {}) {
  const value = theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
  const root = options.root || themeRoot(options.doc);
  if (root && typeof root.setAttribute === 'function') root.setAttribute(THEME_ATTR, value);
  return value;
}

/**
 * Aplica y guarda el tema elegido.
 * @param {'light'|'dark'} theme
 * @param {{ doc?: Document, root?: Element }} [options]
 * @returns {'light'|'dark'} el tema aplicado
 */
export function setTheme(theme, options = {}) {
  const applied = applyTheme(theme, options);
  saveThemePreference(applied);
  return applied;
}

/**
 * Resuelve el tema al montar el shell.
 *
 * Con una eleccion guardada escribe `data-theme`; sin ella deja la raiz sin
 * atributo para que el CSS siga a `prefers-color-scheme`.
 * @param {{ doc?: Document, root?: Element }} [options]
 * @returns {'light'|'dark'} el tema efectivo
 */
export function initTheme(options = {}) {
  const stored = readThemePreference();
  if (stored) return applyTheme(stored, options);
  const system = systemTheme();
  // Sin `matchMedia` (por ejemplo en Node) se fija el claro de forma explicita.
  if (!system) return applyTheme(THEME_LIGHT, options);
  return system;
}

/**
 * Pasa al tema contrario al efectivo y lo guarda.
 * @param {{ doc?: Document, root?: Element }} [options]
 * @returns {'light'|'dark'} el tema aplicado
 */
export function toggleTheme(options = {}) {
  return setTheme(currentTheme(options) === THEME_DARK ? THEME_LIGHT : THEME_DARK, options);
}

/**
 * Handler que puede reemplazar el toggle lateral. Lo usa el dashboard para
 * abrir el drawer en pantallas angostas y para contraer el sidebar en
 * escritorio.
 * @type {null | (() => boolean)}
 */
let sidebarToggleOverride = null;

/**
 * Registra un reemplazo para el toggle lateral. Pasar `null` lo quita.
 * @param {null | (() => boolean)} handler
 */
export function setSidebarToggle(handler) {
  sidebarToggleOverride = typeof handler === 'function' ? handler : null;
}

/**
 * Alterna la barra lateral a traves del handler registrado.
 */
function toggleSidebar() {
  if (sidebarToggleOverride && sidebarToggleOverride() === true) return;
  console.warn('[mainbar] no hay barra lateral conectada: se omite el toggle lateral');
}

define('mainbar', (ctx) => {
  __.current.mb = { open: true };

  const logo = create({
    id: LOGO_ID,
    kind: 'template',
    template: '{{ name }}',
    value: { name: usr.name.toUpperCase() },
  });
  logo.el.classList.add('hc-logo', 'main_logo');

  /**
   * Cambia el contenido del logo y marca la clase del estado colapsado.
   * @param {boolean} collapsed
   */
  const paintLogo = (collapsed) => {
    logo.set({ value: { name: collapsed ? LOGO_COLLAPSED : usr.name.toUpperCase() } });
    if (logo.el && logo.el.classList) logo.el.classList.toggle('main_logo--collapsed', collapsed);
  };

  /** Colapsa o expande la barra lateral y ajusta el logo. */
  const onAction = () => {
    const state = __.current.mb;
    if (state.open === true) {
      paintLogo(true);
      state.open = false;
    } else {
      paintLogo(false);
      state.open = true;
    }
    toggleSidebar();
  };

  const search = create({
    id: SEARCH_ID,
    kind: 'text',
    placeholder: 'Buscar',
  });
  search.el.classList.add('acople', 'input-text');

  /**
   * Repinta el boton de tema: icono, `aria-pressed` y `aria-label`. El boton
   * muestra el icono del tema al que se pasa, y `aria-pressed` refleja si el
   * tema oscuro esta activo.
   */
  function paintTheme() {
    const button = toolbar.el.querySelector(`[data-id="${THEME_ID}"]`);
    if (!button || typeof button.setAttribute !== 'function') return;
    const dark = currentTheme() === THEME_DARK;
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? THEME_LABEL_TO_LIGHT : THEME_LABEL_TO_DARK);
    const span = button.querySelector('.z-toolbar__icon');
    if (span) paintIcon(span, dark ? THEME_ICON_DARK : THEME_ICON_LIGHT);
  }

  /**
   * Alterna el tema, guarda la eleccion y repinta el boton.
   * @returns {'light'|'dark'} tema aplicado
   */
  function onTheme() {
    const applied = toggleTheme();
    paintTheme();
    return applied;
  }

  const toolbar = create({
    kind: 'toolbar',
    items: [
      logo,
      { id: ACTION_ID, icon: 'bars', title: 'Colapsar menu' },
      search,
      create({ kind: 'spacer', flex: true }),
      { id: THEME_ID, icon: THEME_ICON_LIGHT, title: 'Tema' },
      { id: OPTION_ID, icon: 'ellipsis-v', title: 'Opciones' },
    ],
    on: {
      click: (payload) => {
        if (payload && payload.id === ACTION_ID) onAction();
        if (payload && payload.id === THEME_ID) onTheme();
      },
    },
  });
  toolbar.el.classList.add('main-toolbar', 'hc-mainbar');
  paintIconSpans(toolbar.el);
  paintTheme();

  return {
    el: toolbar.el,
    /** Los hijos se arman una vez a partir de las props del montaje. */
    update() {},
    destroy() {
      toolbar.destroy();
    },
    api: {
      /** @returns {any} instancia del logo */
      get logo() {
        return logo;
      },
      /** @returns {any} instancia de la caja de busqueda */
      get search() {
        return search;
      },
      /** @returns {Element|null} nodo del boton de colapso */
      get action() {
        return toolbar.el.querySelector(`[data-id="${ACTION_ID}"]`);
      },
      /** @returns {Element|null} nodo del boton de tema */
      get theme() {
        return toolbar.el.querySelector(`[data-id="${THEME_ID}"]`);
      },
      /** @returns {Element|null} nodo del boton de opciones */
      get options() {
        return toolbar.el.querySelector(`[data-id="${OPTION_ID}"]`);
      },
      paintLogo,
      paintTheme,
      /** @returns {'light'|'dark'} tema aplicado */
      toggleTheme: onTheme,
    },
  };
});

export default 'mainbar';
