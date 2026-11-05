/**
 * Dashboard de Halcon migrado al shim de Zorzal.
 *
 * Origen: `sdk/app/dashboard.js` (Webix + `sdk/sys/plugins/sidebar.js`). El
 * original montaba un layout vertical con el `mainbar` arriba y, abajo, el
 * `sidebar` de Webix a la izquierda y el area de contenido a la derecha; al
 * hacer clic en un item llamaba a `app.require(id)` y mantenia un popup
 * "Submenu" con acciones del usuario.
 *
 * Este modulo conserva la estructura y reemplaza las piezas de Webix:
 *
 *  - el sidebar es el widget `sidebar` nativo de Zorzal (`z-sidebar`), no el
 *    plugin de Webix: acepta items anidados con `id`, `name` e `icon`, marca el
 *    activo y emite `select`;
 *  - el popup de submenu es el widget `popup` de Zorzal con una `unitlist`
 *    adentro, y muestra los hijos del item con hijos que se selecciono;
 *  - el area de contenido muestra el nombre del item seleccionado y llama a
 *    `app.require(id)` para que el shim resuelva la pantalla si esta definida.
 *
 * Fuera de esta migracion (ver `sdk/compat/README.md`): el efecto `waves`, la
 * sesion real y el loader dinamico de Halcon. Los tres dependen de piezas que
 * el shim no tiene.
 *
 * Uso:
 *
 *   import { mount } from './pages/dashboard.js';
 *   const dashboard = mount(document.querySelector('#app'));
 *   dashboard.select('app.demo.tablero');
 *
 * El menu sale de `usr.menu` (global o el objeto de `sdk/compat/globals.js`),
 * igual que en el original. `mount(root, { menu })` permite pasar otro menu sin
 * tocar el global.
 */

import { webix, normalizeSpec } from '../webix-shim.js';
import { app } from '../app-shim.js';
import { usr } from '../globals.js';
import '../plugins/mainbar.js';

/** Id del sidebar: el `mainbar` portado lo usa para el toggle lateral. */
const SIDEBAR_ID = '_sidebar';

/** Id del popup de submenu, igual que en el original. */
const POPUP_ID = 'my_pop';

const TITLE_ID = 'content_title';
const BODY_ID = 'content_body';

/**
 * Texto seguro para plantillas y etiquetas.
 * @param {unknown} value
 * @returns {string}
 */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * Normaliza una rama del menu al formato del sidebar nativo.
 *
 * Acepta `{ id, name, icon, items }`, la forma del original
 * (`{ id, value, icon, data }`) y variantes con `label`, `text`, `children`.
 * Los hijos se normalizan igual, sin limite de profundidad.
 *
 * @param {unknown} source
 * @returns {{ id: string, text: string, icon: string, disabled: boolean, expanded: boolean, children: any[] }[]}
 */
function normalizeMenu(source) {
  if (!Array.isArray(source)) return [];
  const out = [];
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    if (!item || typeof item !== 'object') continue;
    const rawId = item.id !== undefined ? item.id : item.value !== undefined ? item.value : `menu${index}`;
    const label =
      item.name !== undefined
        ? item.name
        : item.label !== undefined
          ? item.label
          : item.value !== undefined
            ? item.value
            : item.text !== undefined
              ? item.text
              : rawId;
    const nestedSource = item.items !== undefined ? item.items : item.children !== undefined ? item.children : item.data;
    const node = {
      id: asText(rawId),
      text: asText(label),
      icon: asText(item.icon),
      disabled: Boolean(item.disabled),
      expanded: Boolean(item.expanded),
      children: normalizeMenu(nestedSource),
    };
    out.push(node);
  }
  return out;
}

/**
 * Indexa los items normalizados por id, para resolver un id a su nodo.
 * @param {any[]} nodes
 * @param {Map<string, any>} index
 * @returns {Map<string, any>}
 */
function indexMenu(nodes, index) {
  for (const node of nodes) {
    index.set(node.id, node);
    if (node.children.length > 0) indexMenu(node.children, index);
  }
  return index;
}

/**
 * Menu de ejemplo: el `usr.menu` del piloto si existe, el del stub si no.
 * @param {{ menu?: unknown }} options
 * @returns {any[]}
 */
function readMenu(options) {
  if (Array.isArray(options.menu)) return options.menu;
  const globalUsr = typeof globalThis === 'undefined' ? null : globalThis.usr;
  if (globalUsr && Array.isArray(globalUsr.menu)) return globalUsr.menu;
  if (usr && Array.isArray(usr.menu)) return usr.menu;
  return [];
}

/**
 * Resuelve el contenedor donde montar.
 * @param {unknown} root
 * @returns {Element}
 */
function resolveRoot(root) {
  if (root === undefined || root === null || root === '') {
    throw new Error('dashboard.mount: falta el contenedor');
  }
  if (typeof root === 'string') {
    const found = document.querySelector(root);
    if (!found) throw new Error(`dashboard.mount: no se encontro "${root}"`);
    return found;
  }
  if (typeof root.appendChild === 'function') return root;
  throw new TypeError('dashboard.mount: contenedor invalido (elemento, selector o id)');
}

/**
 * Descripcion corta del valor que devolvio una definicion.
 * @param {unknown} value
 * @returns {string}
 */
function describe(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return 'una funcion';
  if (typeof value === 'object') return 'un objeto';
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

/**
 * Monta el dashboard dentro de `root`.
 *
 * @param {Element|string} root contenedor (elemento o selector)
 * @param {{ menu?: unknown, onChange?: (node: any) => void }} [options]
 * @returns {{
 *   root: Element,
 *   layout: any,
 *   popup: any,
 *   menu: any[],
 *   select: (id: unknown) => boolean,
 *   destroy: () => void,
 * }}
 */
export function mount(root, options = {}) {
  const host = resolveRoot(root);
  const menu = normalizeMenu(readMenu(options));
  const index = indexMenu(menu, new Map());
  const onChange = typeof options.onChange === 'function' ? options.onChange : null;

  if (menu.length === 0) {
    console.warn('[compat/pages/dashboard] usr.menu vacio: el sidebar queda sin items');
  }

  const shell = document.createElement('div');
  shell.className = 'halcon-dashboard hc-dashboard';
  host.appendChild(shell);

  const layout = webix.ui(
    {
      id: 'app.page',
      view: 'layout',
      rows: [
        {
          id: 'app.header',
          view: 'layout',
          cols: [{ id: 'app.mainbar', view: 'mainbar' }],
        },
        {
          id: 'app.body',
          view: 'layout',
          cols: [
            {
              id: SIDEBAR_ID,
              view: 'sidebar',
              title: 'Menu',
              width: 250,
              items: menu,
              on: {
                select: (payload) => {
                  handleSelect(payload ? payload.id : undefined);
                },
                expand: (payload) => {
                  // El sidebar nativo abre la rama pero no la selecciona; se
                  // marca el activo con su propia API para que emita `select`.
                  selectInSidebar(payload ? payload.id : undefined);
                },
                collapse: () => {
                  closePopup();
                },
              },
            },
            {
              id: 'content',
              view: 'layout',
              rows: [
                { id: TITLE_ID, view: 'template', value: 'Dashboard' },
                { id: BODY_ID, view: 'template', value: 'Elegi un item del menu.' },
              ],
            },
          ],
        },
      ],
    },
    shell
  );

  const popup = webix.ui({ id: POPUP_ID, view: 'popup', width: 220 }, document.body);

  // El shim no traslada `css` al DOM; estas clases dan un gancho estable para
  // el tema propio (`compat/theme.css`). Las `halcon-*` se conservan para el
  // CSS que ya existia y las `hc-*` son las del theme nuevo.
  const themeClasses = [
    ['content', 'halcon-content', 'hc-content'],
    [TITLE_ID, 'halcon-content__title', 'hc-content__title'],
    [BODY_ID, 'halcon-content__body', 'hc-content__body'],
  ];
  for (const [id, ...classNames] of themeClasses) {
    const mounted = webix.$$(id);
    if (mounted && mounted.el && mounted.el.classList) mounted.el.classList.add(...classNames);
  }

  // La mainbar es una toolbar y el logo una plantilla interna: se marcan sobre
  // el DOM porque el `id` del widget resuelve la celda del layout, no la barra.
  const mark = (node, ...classNames) => {
    if (node && node.classList) node.classList.add(...classNames);
  };
  mark(shell.querySelector('.z-toolbar'), 'hc-mainbar');
  mark(shell.querySelector('.z-toolbar > .z-template'), 'hc-logo');
  mark(shell.querySelector('.z-sidebar'), 'hc-sidebar');

  /**
   * @param {string} id
   * @returns {any}
   */
  function view(id) {
    return webix.$$(id);
  }

  /**
   * Boton del sidebar para un id. El popup de submenu se ancla ahi.
   * @param {string} id
   * @returns {Element|null}
   */
  function itemButton(id) {
    const sidebar = view(SIDEBAR_ID);
    if (!sidebar || !sidebar.el) return null;
    const buttons = sidebar.el.querySelectorAll('.z-sidebar__item');
    for (const button of buttons) {
      if (button.getAttribute('data-id') === asText(id)) return button;
    }
    return null;
  }

  /** Cierra el popup de submenu si esta abierto. */
  function closePopup() {
    if (popup && typeof popup.hide === 'function') popup.hide('dashboard');
  }

  /**
   * Cuerpo del popup: titulo y lista de hijos del item con hijos.
   * @param {any} node
   * @returns {Record<string, any>}
   */
  function submenuBody(node) {
    return {
      kind: 'layout',
      orientation: 'vertical',
      plain: true,
      children: [
        { kind: 'template', value: `Submenu: ${node.text}` },
        normalizeSpec({
          view: 'list',
          id: 'app.submenu_list',
          // El shim ve `#icon#` en la plantilla y monta el `svg` del set de
          // Zorzal en lugar del texto del icono.
          template: '#icon# #name#',
          data: node.children.map((child) => ({
            id: child.id,
            name: child.text,
            icon: child.icon,
          })),
          on: {
            select: (payload) => {
              closePopup();
              selectInSidebar(payload ? payload.id : undefined);
            },
          },
        }),
      ],
    };
  }

  /**
   * Abre el popup de submenu anclado al item del sidebar.
   * @param {any} node
   */
  function openSubmenu(node) {
    if (node.children.length === 0) {
      closePopup();
      return;
    }
    popup.set({ body: submenuBody(node) });
    const anchor = itemButton(node.id);
    if (anchor && typeof popup.showFor === 'function') popup.showFor(anchor);
    else popup.set({ open: true });
  }

  /**
   * Pinta el nombre y el detalle del item en el area de contenido. Si el id
   * tiene definicion en `app`, la resuelve y monta la pantalla cuando la
   * definicion expone `mount`.
   * @param {any} node
   */
  function paintContent(node) {
    const title = view(TITLE_ID);
    const body = view(BODY_ID);
    if (title && typeof title.set === 'function') title.set({ value: node.text });
    if (!body || typeof body.set !== 'function') return;

    const lines = [`Id: ${node.id}`];
    if (node.children.length > 0) {
      lines.push(`Seccion con ${node.children.length} items. El submenu se abre al costado.`);
    }

    if (!app.isDefined(node.id)) {
      lines.push('Sin pantalla registrada para este id en el shim.');
      body.set({ value: lines.join('\n') });
      return;
    }

    body.set({ value: lines.join('\n') });
    try {
      const page = app.require(node.id);
      if (page && typeof page.mount === 'function') {
        page.mount(body.content);
      } else {
        lines.push(`app.require devolvio ${describe(page)}.`);
        body.set({ value: lines.join('\n') });
      }
    } catch (error) {
      lines.push(`app.require fallo: ${error && error.message ? error.message : String(error)}`);
      body.set({ value: lines.join('\n') });
    }
  }

  /**
   * Efecto de seleccionar un item: contenido, submenu y navegacion.
   * @param {unknown} id
   * @returns {boolean}
   */
  function handleSelect(id) {
    if (id === undefined || id === null) return false;
    const node = index.get(asText(id));
    if (!node) return false;
    paintContent(node);
    if (node.children.length > 0) openSubmenu(node);
    else closePopup();
    if (onChange) onChange(node);
    return true;
  }

  /**
   * Selecciona por id a traves del sidebar nativo, para que quede marcado el
   * activo y se emita `select`. Si el sidebar no esta disponible (o el id no
   * es un item del menu) cae al efecto directo.
   * @param {unknown} id
   * @returns {boolean}
   */
  function selectInSidebar(id) {
    if (id === undefined || id === null) return false;
    const sidebar = view(SIDEBAR_ID);
    if (sidebar && typeof sidebar.select === 'function') return Boolean(sidebar.select(id));
    return handleSelect(id);
  }

  /**
   * Desmonta el dashboard y el popup.
   */
  function destroy() {
    closePopup();
    if (popup && typeof popup.destroy === 'function') popup.destroy();
    if (layout && typeof layout.destroy === 'function') layout.destroy();
    if (shell.parentNode) shell.parentNode.removeChild(shell);
  }

  return {
    root: shell,
    layout,
    popup,
    menu,
    select: selectInSidebar,
    destroy,
  };
}

/**
 * Definicion de la pantalla en el shim de `app`. La factory no toca el DOM:
 * montar sigue siendo responsabilidad de quien llama a `mount`.
 */
app.define('app.dashboard', () => ({ mount }));

export default { mount };
