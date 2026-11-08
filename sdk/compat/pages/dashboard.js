/**
 * Dashboard de Halcon sobre el widget set de Zorzal.
 *
 * Monta un layout vertical con el `mainbar` arriba y, abajo, el sidebar a la
 * izquierda y el area de contenido a la derecha. Al hacer clic en un item
 * resuelve la pantalla con el callback `navigate` que recibe en las opciones y
 * mantiene el popup "Submenu".
 *
 * Este modulo arma el mismo shell con los widgets de Zorzal y guarda la
 * referencia de cada uno:
 *
 *  - el sidebar es el widget `sidebar` nativo (`z-sidebar`), que acepta items
 *    anidados con `id`, `text` e `icon`, marca el activo y emite `select`;
 *  - el popup de submenu es el widget `popup` con una `unitlist` adentro, con
 *    los hijos del item con hijos que se selecciono;
 *  - el area de contenido muestra el nombre del item y llama al callback
 *    `navigate(id)` para montar la pantalla.
 *
 * No hay busqueda por id global: `mount` devuelve el controlador con las
 * instancias (`sidebar`, `mainbar`, `title`, `body`, `popup`, `layout`) y el
 * codigo que lo usa trabaja con esas referencias.
 *
 * Accesibilidad del shell: un skip link al inicio que lleva al contenido
 * (`#hc-main`), `role="main"` y `tabindex="-1"` en el cuerpo, `aria-current=
 * "page"` en el item activo del sidebar y `aria-label` en el boton de menu de
 * la mainbar.
 *
 * Sesion: el shell no crea ni guarda tokens, solo observa. `mount` recibe el
 * nombre del usuario (`user`) y la sesion (`session`); la mainbar muestra el
 * nombre y el boton `Salir`, que llama a `session.logout()` y avisa con
 * `onLogout` para que el dueno del shell vuelva al login.
 *
 * Responsive: por debajo de 900 px el sidebar pasa a drawer. Al elegir un item
 * del menu el contenido se pinta primero y despues el drawer se cierra, para
 * que el panel no tape la pantalla recien elegida; el controlador lo expone en
 * `drawer` (`isOpen`, `open`, `close`, `toggle`).
 *
 * Uso:
 *
 *   import { mount } from './pages/dashboard.js';
 *   const dashboard = mount(document.querySelector('#app'));
 *   dashboard.select('app.demo.tablero');
 *
 * El menu sale de `usr.menu` (global o el objeto de `compat/globals.js`).
 * `mount(root, { menu })` permite pasar otro menu sin tocar el global.
 */

import { create } from '../../vendor/zorzal/src/zorzal.js';
import { usr } from '../globals.js';
import { initTheme, setSidebarToggle } from '../../src/plugins/mainbar.js';
import { paintIconSpans, renderIcon } from '../icons.js';

/** Id de la pantalla del shell. */
export const PAGE_ID = 'app.dashboard';

/** Id del sidebar. */
const SIDEBAR_ID = '_sidebar';

/** Breakpoint del drawer: por debajo, el sidebar deja de ocupar una columna. */
const MOBILE_QUERY = '(max-width: 900px)';

/** Id del popup de submenu, igual que en el original. */
const POPUP_ID = 'my_pop';

/** Id de la plantilla del titulo del contenido. */
const TITLE_ID = 'content_title';

/** Id de la plantilla del cuerpo del contenido. */
const BODY_ID = 'content_body';

/** Id del nodo de contenido: destino del skip link y region `main`. */
const MAIN_ID = 'hc-main';

/** Id del skip link. */
const SKIP_ID = 'hc-skip-link';

/** Texto del skip link. */
const SKIP_TEXT = 'Saltar al contenido';

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
    out.push({
      id: asText(rawId),
      text: asText(label),
      icon: asText(item.icon),
      disabled: Boolean(item.disabled),
      expanded: Boolean(item.expanded),
      children: normalizeMenu(nestedSource),
    });
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
 * Menu: el de las opciones si existe, el de `usr.menu` si no.
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
 * Monta el dashboard dentro de `root`.
 *
 * @param {Element|string} root contenedor (elemento o selector)
 * @param {{
 *   menu?: unknown,
 *   navigate?: (id: unknown) => ({ mount: (host: unknown) => unknown } | null),
 *   onChange?: (node: any) => void,
 *   user?: string,
 *   session?: any,
 *   onLogout?: () => void,
 * }} [options]
 * @returns {{
 *   root: Element,
 *   layout: any,
 *   mainbar: any,
 *   sidebar: any,
 *   title: any,
 *   body: any,
 *   popup: any,
 *   menu: any[],
 *   user: string,
 *   logout: HTMLButtonElement|null,
 *   select: (id: unknown) => boolean,
 *   drawer: { isOpen: () => boolean, open: () => boolean, close: () => boolean, toggle: () => boolean },
 *   destroy: () => void,
 * }}
 */
export function mount(root, options = {}) {
  const host = resolveRoot(root);
  const menu = normalizeMenu(readMenu(options));
  const index = indexMenu(menu, new Map());
  const onChange = typeof options.onChange === 'function' ? options.onChange : null;
  const usuario = typeof options.user === 'string' ? options.user.trim() : '';
  const sesion = options.session && typeof options.session === 'object' ? options.session : null;
  const onLogout = typeof options.onLogout === 'function' ? options.onLogout : null;
  const doc = host.ownerDocument || document;

  if (menu.length === 0) {
    console.warn('[compat/pages/dashboard] usr.menu vacio: el sidebar queda sin items');
  }

  const shell = doc.createElement('div');
  shell.className = 'halcon-dashboard hc-dashboard';
  host.appendChild(shell);

  // --- tema claro/oscuro -----------------------------------------------
  // Se resuelve al montar el shell y antes de crear los widgets: si el usuario
  // ya eligio, la clave `hc-theme` de `localStorage` fija `data-theme` en la
  // raiz; si no hay eleccion, la raiz queda sin atributo y el CSS del theme
  // sigue a `prefers-color-scheme`.
  initTheme({ doc });

  // --- accesibilidad del shell -----------------------------------------
  // El skip link va primero en el orden de tabulacion y lleva al contenido;
  // queda fuera de pantalla hasta que recibe el foco.
  const skip = doc.createElement('a');
  skip.id = SKIP_ID;
  skip.className = 'hc-skip-link';
  skip.href = `#${MAIN_ID}`;
  skip.textContent = SKIP_TEXT;
  skip.style.position = 'absolute';
  skip.style.left = '-9999px';
  skip.style.top = '8px';
  skip.style.zIndex = '10';
  skip.style.padding = '8px 12px';
  skip.style.background = '#1d2430';
  skip.style.color = '#f6f7f9';
  skip.style.borderRadius = '6px';
  skip.addEventListener('focus', () => {
    skip.style.left = '8px';
  });
  skip.addEventListener('blur', () => {
    skip.style.left = '-9999px';
  });
  shell.appendChild(skip);

  // --- piezas del shell ------------------------------------------------

  const mainbar = create({ id: 'app.mainbar', kind: 'mainbar' });

  // --- sesion en la mainbar -------------------------------------------
  // El nombre del usuario y el boton de salida viven en la mainbar, a la
  // derecha del spacer. El boton cierra la sesion en el modulo de auth y
  // avisa a quien monto el shell; el estado de la sesion lo decide ese
  // modulo, no el shell.
  const bloqueSesion = doc.createElement('div');
  bloqueSesion.className = 'hc-mainbar__sesion';

  const nombreUsuario = doc.createElement('span');
  nombreUsuario.className = 'hc-mainbar__usuario';
  nombreUsuario.setAttribute('data-usuario', usuario === '' ? 'anonimo' : usuario);
  nombreUsuario.textContent = usuario;
  bloqueSesion.appendChild(nombreUsuario);

  const salir = doc.createElement('button');
  salir.type = 'button';
  salir.className = 'hc-mainbar__salir';
  salir.name = 'salir';
  salir.textContent = 'Salir';
  salir.setAttribute('aria-label', usuario === '' ? 'Cerrar la sesion' : `Cerrar la sesion de ${usuario}`);
  bloqueSesion.appendChild(salir);

  /**
   * Cierra la sesion: revoca el refresh en el emulador y vuelve al login.
   * @returns {Promise<void>}
   */
  async function cerrarSesion() {
    if (salir.disabled) return;
    salir.disabled = true;
    salir.textContent = 'Saliendo...';
    try {
      if (sesion && typeof sesion.logout === 'function') await sesion.logout();
    } catch (fallo) {
      // La sesion local ya quedo cerrada: el emulador puede no estar.
    }
    if (onLogout) {
      onLogout();
      return;
    }
    salir.disabled = false;
    salir.textContent = 'Salir';
  }

  salir.addEventListener('click', cerrarSesion);

  mainbar.el.appendChild(bloqueSesion);

  const sidebar = create({
    id: SIDEBAR_ID,
    kind: 'sidebar',
    title: 'Menu',
    width: 250,
    items: menu,
    on: {
      select: (payload) => {
        handleSelect(payload ? payload.id : undefined);
      },
      expand: (payload) => {
        // El sidebar nativo abre la rama pero no la selecciona; se marca el
        // activo con su propia API para que emita `select`.
        selectInSidebar(payload ? payload.id : undefined);
      },
      collapse: () => {
        closePopup();
      },
    },
  });
  sidebar.el.classList.add('hc-sidebar');
  paintIconSpans(sidebar.el);

  const title = create({ id: TITLE_ID, kind: 'template', value: 'Dashboard' });
  title.el.classList.add('halcon-content__title', 'hc-content__title');

  const body = create({ id: BODY_ID, kind: 'template', value: 'Elegi un item del menu.' });
  body.el.classList.add('halcon-content__body', 'hc-content__body');
  body.el.id = MAIN_ID;
  body.el.setAttribute('role', 'main');
  body.el.setAttribute('tabindex', '-1');

  skip.addEventListener('click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof body.el.focus === 'function') body.el.focus();
  });

  const content = create({ kind: 'layout', orientation: 'vertical', children: [title, body] });
  content.el.classList.add('halcon-content', 'hc-content');

  const pageBody = create({ kind: 'layout', orientation: 'horizontal', children: [sidebar, content] });
  const layout = create({ kind: 'layout', orientation: 'vertical', children: [mainbar, pageBody] });
  shell.appendChild(layout.el);

  const popup = create({ id: POPUP_ID, kind: 'popup', width: 220 });

  // --- responsive: sidebar como drawer en pantallas angostas ----------
  // Zorzal no trae breakpoints: el layout es flex y el sidebar expone
  // collapse/expand/toggle. El drawer se arma aca, con una media query, y
  // reutiliza el boton de la mainbar como disparador.
  const sidebarCell = sidebar.el.closest ? sidebar.el.closest('.z-layout__cell') : null;
  if (sidebarCell) sidebarCell.classList.add('hc-sidebar-cell');

  const backdrop = doc.createElement('div');
  backdrop.className = 'hc-drawer-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  shell.appendChild(backdrop);

  const actionEl = mainbar.action;
  if (actionEl) {
    actionEl.setAttribute('aria-label', 'Abrir o cerrar el menu');
    actionEl.setAttribute('aria-controls', SIDEBAR_ID);
  }

  const media =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_QUERY)
      : null;
  const isMobile = () => Boolean(media && media.matches);
  let mobileMode = false;
  let drawerOpen = false;
  let desktopCollapsed = Boolean(sidebar.collapsed);

  /**
   * Abre o cierra el drawer. En escritorio no hace nada: ahi manda el
   * colapso normal del sidebar.
   * @param {boolean} open
   * @returns {boolean} `true` si cambio el estado
   */
  function setDrawer(open) {
    const next = Boolean(open) && isMobile();
    if (next === drawerOpen) {
      if (!next && sidebarCell && isMobile()) sidebarCell.inert = true;
      return false;
    }
    drawerOpen = next;
    shell.classList.toggle('hc-dashboard--drawer-open', next);
    if (sidebarCell) sidebarCell.inert = isMobile() ? !next : false;
    if (actionEl) actionEl.setAttribute('aria-expanded', String(next));
    if (next) sidebar.expand('drawer');
    else closePopup();
    return true;
  }

  /**
   * Aplica el modo segun el ancho. Al entrar en mobile guarda el colapso de
   * escritorio y expande el sidebar para que el drawer se vea completo; al
   * volver a escritorio restaura ese estado.
   */
  function applyMode() {
    const mobile = isMobile();
    if (mobile === mobileMode) return;
    mobileMode = mobile;
    if (mobile) {
      desktopCollapsed = Boolean(sidebar.collapsed);
      shell.classList.add('hc-dashboard--mobile');
      setDrawer(false);
      closePopup();
      if (sidebarCell) sidebarCell.inert = true;
      sidebar.expand('responsive');
    } else {
      shell.classList.remove('hc-dashboard--mobile');
      setDrawer(false);
      if (sidebarCell) sidebarCell.inert = false;
      if (desktopCollapsed) sidebar.collapse('responsive');
      else sidebar.expand('responsive');
    }
  }

  setSidebarToggle(() => {
    if (!isMobile()) {
      sidebar.toggle();
      return true;
    }
    setDrawer(!drawerOpen);
    return true;
  });

  backdrop.addEventListener('click', () => setDrawer(false));

  const onKeyDown = (event) => {
    if (event && event.key === 'Escape' && drawerOpen) setDrawer(false);
  };
  doc.addEventListener('keydown', onKeyDown);

  const onMediaChange = () => applyMode();
  if (media) {
    if (typeof media.addEventListener === 'function') media.addEventListener('change', onMediaChange);
    else if (typeof media.addListener === 'function') media.addListener(onMediaChange);
  }
  applyMode();

  // --- submenu y navegacion -------------------------------------------

  /**
   * Boton del sidebar para un id. El popup de submenu se ancla ahi.
   * @param {string} id
   * @returns {Element|null}
   */
  function itemButton(id) {
    const buttons = sidebar.el.querySelectorAll('.z-sidebar__item');
    for (const button of buttons) {
      if (button.getAttribute('data-id') === asText(id)) return button;
    }
    return null;
  }

  /**
   * Marca el item activo del sidebar con `aria-current="page"` y quita la
   * marca de los demas. El sidebar nativo ya pinta la clase activa; esto es
   * lo que anuncia el lector de pantalla.
   * @param {string} id
   */
  function marcarActual(id) {
    const botones = sidebar.el.querySelectorAll('.z-sidebar__item');
    for (const button of botones) {
      if (button.getAttribute('data-id') === asText(id)) button.setAttribute('aria-current', 'page');
      else if (typeof button.removeAttribute === 'function') button.removeAttribute('aria-current');
    }
  }

  /** Cierra el popup de submenu si esta abierto. */
  function closePopup() {
    popup.hide('dashboard');
  }

  /**
   * Cuerpo del popup: titulo y lista de hijos del item con hijos. Cada fila
   * dibuja el icono del set de Zorzal y el nombre del hijo.
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
        {
          kind: 'unitlist',
          id: 'app.submenu_list',
          data: node.children.map((child) => ({ id: child.id, name: child.text, icon: child.icon })),
          template: (scope) => [renderIcon(scope.icon, { doc }), ` ${asText(scope.name)}`],
          on: {
            select: (payload) => {
              closePopup();
              selectInSidebar(payload ? payload.id : undefined);
            },
          },
        },
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
    if (anchor) popup.showFor(anchor);
  }

  let lastPage = null;

  /**
   * Pinta el nombre y el detalle del item en el area de contenido. Si el id
   * resuelve a una pantalla con el callback `navigate`, la monta.
   * @param {any} node
   */
  function paintContent(node) {
    title.set({ value: node.text });
    lastPage = null;

    const lines = [`Id: ${node.id}`];
    if (node.children.length > 0) {
      lines.push(`Seccion con ${node.children.length} items. El submenu se abre al costado.`);
    }

    body.set({ value: lines.join('\n') });
    if (typeof options.navigate !== 'function') return;

    const page = options.navigate(node.id);
    if (!page || typeof page.mount !== 'function') {
      lines.push('Sin pantalla para este id.');
      body.set({ value: lines.join('\n') });
      return;
    }

    try {
      lastPage = page.mount(body.content);
    } catch (error) {
      lines.push(`la pantalla fallo al montar: ${error && error.message ? error.message : String(error)}`);
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
    marcarActual(node.id);
    if (node.children.length > 0) {
      // En mobile la rama ya se expande inline; el popup duplicaria el
      // submenu y taparia el contenido.
      if (isMobile()) closePopup();
      else openSubmenu(node);
    } else {
      closePopup();
    }
    // El drawer tapa el contenido recien pintado: se cierra despues de
    // pintarlo, tanto para un item con hijos como para uno hoja.
    if (isMobile()) setDrawer(false);
    if (onChange) onChange(node);
    return true;
  }

  /**
   * Selecciona por id a traves del sidebar nativo, para que quede marcado el
   * activo y se emita `select`.
   * @param {unknown} id
   * @returns {boolean}
   */
  function selectInSidebar(id) {
    if (id === undefined || id === null) return false;
    return Boolean(sidebar.select(id)) || handleSelect(id);
  }

  /**
   * Desmonta el dashboard y el popup.
   */
  function destroy() {
    closePopup();
    setSidebarToggle(null);
    salir.removeEventListener('click', cerrarSesion);
    if (media) {
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', onMediaChange);
      else if (typeof media.removeListener === 'function') media.removeListener(onMediaChange);
    }
    doc.removeEventListener('keydown', onKeyDown);
    if (sidebarCell) sidebarCell.inert = false;
    popup.destroy();
    layout.destroy();
    if (shell.parentNode) shell.parentNode.removeChild(shell);
  }

  return {
    root: shell,
    layout,
    mainbar,
    sidebar,
    title,
    body,
    content: body.content,
    popup,
    menu,
    user: usuario,
    logout: salir,
    /** @returns {any} controlador de la ultima pantalla montada por `app.require` */
    get page() {
      return lastPage;
    },
    select: selectInSidebar,
    drawer: {
      isOpen: () => drawerOpen,
      open: () => setDrawer(true),
      close: () => setDrawer(false),
      toggle: () => setDrawer(!drawerOpen),
    },
    destroy,
  };
}

export default { mount };
