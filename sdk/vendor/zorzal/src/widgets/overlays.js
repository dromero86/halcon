/**
 * Widgets de overlays y paneles laterales: sidebar, sidemenu, window, popup,
 * tooltip y context.
 *
 * Todos siguen el contrato del core: la factory recibe el contexto, devuelve
 * `{ el, update, destroy?, api? }` y emite eventos propios. Los estilos viven
 * en `src/zorzal.css` con prefijo `z-`; la unica escritura inline son las
 * variables CSS con las que se fija la geometria (`--z-window-*`,
 * `--z-popup-*`, `--z-tooltip-*`, `--z-context-*`), que el stylesheet consume.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { Widget } from '../core/widget.js';

/** @param {unknown} value */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/** @param {unknown} value @returns {number} */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Escribe una variable CSS en el nodo. En el navegador usa `setProperty`
 * (unica via valida para custom properties); en el DOM minimo de los tests,
 * donde `style` es un objeto plano, asigna la propiedad.
 *
 * @param {Element} el
 * @param {string} name
 * @param {string} value
 */
function setVar(el, name, value) {
  const style = el && el.style;
  if (!style) return;
  if (typeof style.setProperty === 'function') style.setProperty(name, value);
  else style[name] = value;
}

/**
 * @param {Element} el
 * @param {string} name
 */
function removeVar(el, name) {
  const style = el && el.style;
  if (!style) return;
  if (typeof style.removeProperty === 'function') style.removeProperty(name);
  else delete style[name];
}

/**
 * @param {unknown} value
 * @returns {boolean} true si es un numero o una medida CSS usable
 */
function isMeasure(value) {
  if (value === undefined || value === null || value === '') return false;
  return Number.isFinite(Number(value)) || typeof value === 'string';
}

/**
 * Medida CSS: los numeros son pixeles.
 * @param {unknown} value
 * @returns {string}
 */
function measureOf(value) {
  return typeof value === 'number' ? `${value}px` : asText(value);
}

/**
 * Caja de un nodo. Usa `getBoundingClientRect` cuando existe y cae a las
 * medidas de layout (`offsetLeft`, `offsetTop`, ...) en entornos minimos.
 *
 * @param {Element|null} node
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
function rectOf(node) {
  if (!node) return { left: 0, top: 0, width: 0, height: 0 };
  if (typeof node.getBoundingClientRect === 'function') {
    const rect = node.getBoundingClientRect() || {};
    return {
      left: toNumber(rect.left),
      top: toNumber(rect.top),
      width: toNumber(rect.width),
      height: toNumber(rect.height),
    };
  }
  return {
    left: toNumber(node.offsetLeft),
    top: toNumber(node.offsetTop),
    width: toNumber(node.offsetWidth),
    height: toNumber(node.offsetHeight),
  };
}

/**
 * Quita las clases que empiezan con un prefijo y agrega la indicada.
 * Trabaja sobre el atributo `class` para no depender de que `classList` sea
 * iterable (el DOM minimo de los tests no lo es).
 *
 * @param {Element} el
 * @param {string} prefix
 * @param {string} name
 */
function replacePrefixedClass(el, prefix, name) {
  const tokens = (el.getAttribute('class') || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !token.startsWith(prefix));
  tokens.push(name);
  el.setAttribute('class', tokens.join(' '));
}

/**
 * Resuelve un ancla: selector, elemento o instancia.
 * @param {any} ctx
 * @param {unknown} target
 * @returns {Element|null}
 */
function resolveAnchor(ctx, target) {
  if (target === undefined || target === null || target === '') return null;
  if (target instanceof Widget) return target.el;
  if (typeof target === 'string') return ctx.doc().querySelector(target);
  if (typeof target === 'object' && typeof target.nodeType === 'number') return target;
  return null;
}

/**
 * Normaliza items de menu con anidamiento.
 *
 * Acepta `{ id, text, icon, disabled, children }` y strings sueltos. El `id`
 * es la clave estable que se emite en `select`; si falta, se usa el indice de
 * su nivel. `expanded` marca las ramas abiertas de entrada.
 *
 * @param {unknown} items
 * @returns {{ id: string, text: string, icon: string, disabled: boolean, expanded: boolean, children: any[] }[]}
 */
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (item === null || item === undefined) {
      return {
        id: String(index),
        text: '',
        icon: '',
        disabled: false,
        expanded: false,
        children: [],
      };
    }
    if (typeof item === 'object') {
      const rawId = item.id !== undefined ? item.id : item.value !== undefined ? item.value : index;
      const id = asText(rawId);
      const label = item.text !== undefined ? item.text : item.label !== undefined ? item.label : rawId;
      const nested = item.children !== undefined ? item.children : item.items;
      return {
        id,
        text: asText(label),
        icon: asText(item.icon),
        disabled: Boolean(item.disabled),
        expanded: Boolean(item.expanded),
        children: normalizeItems(nested),
      };
    }
    return {
      id: String(index),
      text: asText(item),
      icon: '',
      disabled: false,
      expanded: false,
      children: [],
    };
  });
}

/**
 * Ids de las ramas marcadas como abiertas en los items.
 * @param {unknown} items
 * @returns {string[]}
 */
function collectExpanded(items) {
  const out = [];
  const walk = (list) => {
    for (const item of normalizeItems(list)) {
      if (item.children.length > 0 && item.expanded) out.push(item.id);
      walk(item.children);
    }
  };
  walk(items);
  return out;
}

// --- sidebar ----------------------------------------------------------

define('sidebar', (ctx) => {
  const titleEl = ctx.h('span', { class: 'z-sidebar__title' });
  const toggleBtn = ctx.h('button', {
    class: 'z-sidebar__toggle',
    type: 'button',
    'aria-expanded': 'true',
    'aria-label': 'Contraer',
  });
  const header = ctx.h('header', { class: 'z-sidebar__header' }, [titleEl, toggleBtn]);
  const list = ctx.h('ul', { class: 'z-sidebar__list', role: 'tree' });
  const el = ctx.h('aside', { class: 'z-sidebar' }, [header, list]);

  /** @type {{ button: Element, item: any }[]} */
  let rows = [];
  /** @type {Map<string, { nested: Element, button: Element, item: any }>} */
  let branches = new Map();
  /** @type {Set<string>} */
  let expanded = new Set(collectExpanded(ctx.props.items));
  let signature = null;

  const paint = () => {
    const selected = asText(ctx.props.selected);
    for (const { button, item } of rows) {
      const on = selected !== '' && item.id === selected;
      button.classList.toggle('z-sidebar__item--active', on);
      if (on) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  };

  const activate = (item, event) => {
    if (item.disabled || ctx.props.disabled) return false;
    ctx.props.selected = item.id;
    paint();
    ctx.emit('select', { id: item.id, item, event });
    return true;
  };

  const applyBranch = (id, open) => {
    const branch = branches.get(asText(id));
    if (!branch) return false;
    if (open) expanded.add(branch.item.id);
    else expanded.delete(branch.item.id);
    branch.nested.classList.toggle('z-hidden', !open);
    branch.button.setAttribute('aria-expanded', open ? 'true' : 'false');
    branch.button.classList.toggle('z-sidebar__item--open', open);
    return true;
  };

  const buildNodes = (host, items, depth) => {
    for (const item of items) {
      const hasChildren = item.children.length > 0;
      const open = hasChildren && expanded.has(item.id);
      const button = ctx.h(
        'button',
        {
          class: cls(
            'z-sidebar__item',
            hasChildren && 'z-sidebar__item--branch',
            item.disabled && 'z-sidebar__item--disabled'
          ),
          type: 'button',
          role: 'treeitem',
          'data-id': item.id,
          'data-depth': String(depth),
          'aria-level': String(depth + 1),
          'aria-expanded': hasChildren ? (open ? 'true' : 'false') : null,
          disabled: item.disabled,
        },
        [
          item.icon
            ? ctx.h('span', { class: 'z-sidebar__icon', 'aria-hidden': 'true', text: item.icon })
            : null,
          ctx.h('span', { class: 'z-sidebar__text', text: item.text }),
          hasChildren ? ctx.h('span', { class: 'z-sidebar__arrow', 'aria-hidden': 'true' }, '\u203a') : null,
        ]
      );
      const nested = hasChildren
        ? ctx.h('ul', {
            class: cls('z-sidebar__list', 'z-sidebar__list--nested', !open && 'z-hidden'),
            role: 'group',
          })
        : null;
      host.appendChild(ctx.h('li', { class: 'z-sidebar__row' }, [button, nested]));
      rows.push({ button, item });

      if (hasChildren) {
        branches.set(item.id, { nested, button, item });
        buildNodes(nested, item.children, depth + 1);
      }

      ctx.on(button, 'click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (item.disabled || ctx.props.disabled) return;
        if (hasChildren) {
          const nowOpen = !expanded.has(item.id);
          applyBranch(item.id, nowOpen);
          ctx.emit(nowOpen ? 'expand' : 'collapse', { id: item.id, item, branch: true });
          return;
        }
        activate(item, event);
      });
    }
  };

  const build = (props) => {
    const items = normalizeItems(props.items);
    const next = JSON.stringify(items);
    if (next === signature) return;
    signature = next;
    for (const { button } of rows) ctx.release(button, 'click');
    while (list.firstChild) list.removeChild(list.firstChild);
    rows = [];
    branches = new Map();
    buildNodes(list, items, 0);
  };

  const paintState = (props) => {
    const collapsed = Boolean(props.collapsed);
    el.classList.toggle('z-sidebar--collapsed', collapsed);
    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggleBtn.setAttribute('aria-label', collapsed ? 'Expandir' : 'Contraer');
    toggleBtn.textContent = collapsed ? '\u203a' : '\u2039';
    titleEl.textContent = asText(props.title);
    titleEl.classList.toggle('z-hidden', props.title === undefined || props.title === '');
  };

  const update = (props) => {
    el.setAttribute(
      'class',
      cls(
        'z-sidebar',
        Boolean(props.collapsed) && 'z-sidebar--collapsed',
        props.side === 'right' && 'z-sidebar--right',
        props.plain && 'z-sidebar--plain',
        props.disabled && 'z-sidebar--disabled'
      )
    );
    const width = props.width;
    if (width === undefined || width === null || width === '') removeVar(el, '--z-sidebar-width');
    else setVar(el, '--z-sidebar-width', typeof width === 'number' ? `${width}px` : asText(width));
    build(props);
    paintState(props);
    paint();
  };
  update(ctx.props);

  const setCollapsed = (value, reason) => {
    const collapsed = Boolean(value);
    if (Boolean(ctx.props.collapsed) === collapsed) return false;
    ctx.props.collapsed = collapsed;
    paintState(ctx.props);
    ctx.emit(collapsed ? 'collapse' : 'expand', { collapsed, reason });
    return true;
  };

  ctx.on(toggleBtn, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    setCollapsed(!ctx.props.collapsed, 'toggle');
  });

  return {
    el,
    update,
    api: {
      /**
       * Marca un item como activo y emite `select`.
       * @param {unknown} id
       * @returns {boolean} true si el item existe y esta habilitado
       */
      select(id) {
        const value = asText(id);
        const found = rows.find((row) => row.item.id === value);
        if (!found) return false;
        return activate(found.item, null);
      },
      /** @returns {string} */
      get selected() {
        return asText(ctx.props.selected);
      },
      /**
       * Contrae el panel.
       * @param {string} [reason]
       * @returns {boolean} true si cambio de estado
       */
      collapse(reason = 'api') {
        return setCollapsed(true, reason);
      },
      /**
       * Expande el panel.
       * @param {string} [reason]
       * @returns {boolean} true si cambio de estado
       */
      expand(reason = 'api') {
        return setCollapsed(false, reason);
      },
      /** @returns {boolean} estado despues del cambio */
      toggle() {
        setCollapsed(!ctx.props.collapsed, 'api');
        return Boolean(ctx.props.collapsed);
      },
      /** @returns {boolean} */
      get collapsed() {
        return Boolean(ctx.props.collapsed);
      },
      /**
       * Abre o cierra una rama.
       * @param {unknown} id
       * @param {boolean} [open]
       * @returns {boolean} true si la rama existe
       */
      setBranch(id, open) {
        const value = open === undefined ? !expanded.has(asText(id)) : Boolean(open);
        return applyBranch(id, value);
      },
      /** @returns {string[]} ids de las ramas abiertas */
      get expandedIds() {
        return [...expanded];
      },
      /** @returns {number} cantidad de items renderizados */
      get itemCount() {
        return rows.length;
      },
    },
  };
});

// --- sidemenu ---------------------------------------------------------

define('sidemenu', (ctx) => {
  const titleEl = ctx.h('span', { class: 'z-sidemenu__title' });
  const closeBtn = ctx.h('button', {
    class: 'z-sidemenu__close',
    type: 'button',
    'aria-label': 'Cerrar',
  }, 'x');
  const header = ctx.h('header', { class: 'z-sidemenu__header' }, [titleEl, closeBtn]);
  const list = ctx.h('ul', { class: 'z-sidemenu__list', role: 'menu' });
  const panel = ctx.h(
    'aside',
    { class: 'z-sidemenu__panel', role: 'dialog', 'aria-modal': 'true' },
    [header, list]
  );
  const overlay = ctx.h('div', { class: 'z-sidemenu__overlay' });
  const el = ctx.h('div', { class: 'z-sidemenu z-hidden' }, [overlay, panel]);

  /** @type {{ button: Element, item: any }[]} */
  let rows = [];
  let signature = null;
  let escapeHandler = null;

  const isOpen = () => Boolean(ctx.props.open);

  const releaseKeys = () => {
    if (!escapeHandler) return;
    ctx.release(ctx.doc(), 'keydown', escapeHandler);
    escapeHandler = null;
  };

  const bindKeys = () => {
    if (escapeHandler) return;
    escapeHandler = (event) => {
      if (event && event.key === 'Escape') close('escape');
    };
    ctx.on(ctx.doc(), 'keydown', escapeHandler);
  };

  const activate = (item, event) => {
    if (item.disabled || ctx.props.disabled) return false;
    ctx.props.selected = item.id;
    for (const row of rows) {
      const on = row.item.id === item.id;
      row.button.classList.toggle('z-sidemenu__item--active', on);
      if (on) row.button.setAttribute('aria-current', 'page');
      else row.button.removeAttribute('aria-current');
    }
    ctx.emit('select', { id: item.id, item, event });
    if (ctx.props.closeOnSelect !== false) close('select');
    return true;
  };

  const close = (reason = 'api') => {
    if (!isOpen()) return false;
    ctx.props.open = false;
    el.classList.add('z-hidden');
    el.classList.remove('z-is-open');
    el.setAttribute('aria-hidden', 'true');
    releaseKeys();
    ctx.emit('close', { reason });
    return true;
  };

  const open = (reason = 'api') => {
    if (isOpen()) return;
    ctx.props.open = true;
    el.classList.remove('z-hidden');
    el.classList.add('z-is-open');
    el.setAttribute('aria-hidden', 'false');
    bindKeys();
    ctx.emit('open', { reason });
  };

  const build = (props) => {
    const items = normalizeItems(props.items);
    const next = JSON.stringify(items);
    if (next === signature) return;
    signature = next;
    for (const { button } of rows) ctx.release(button, 'click');
    while (list.firstChild) list.removeChild(list.firstChild);
    rows = [];
    for (const item of items) {
      const button = ctx.h(
        'button',
        {
          class: cls(
            'z-sidemenu__item',
            item.id === asText(props.selected) && 'z-sidemenu__item--active',
            item.disabled && 'z-sidemenu__item--disabled'
          ),
          type: 'button',
          role: 'menuitem',
          'data-id': item.id,
          disabled: item.disabled,
        },
        [
          item.icon
            ? ctx.h('span', { class: 'z-sidemenu__icon', 'aria-hidden': 'true', text: item.icon })
            : null,
          ctx.h('span', { class: 'z-sidemenu__text', text: item.text }),
        ]
      );
      ctx.on(button, 'click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        activate(item, event);
      });
      list.appendChild(ctx.h('li', { class: 'z-sidemenu__row' }, [button]));
      rows.push({ button, item });
    }
  };

  const update = (props) => {
    el.setAttribute(
      'class',
      cls(
        'z-sidemenu',
        isOpen() ? 'z-is-open' : 'z-hidden',
        props.side === 'right' && 'z-sidemenu--right',
        props.plain && 'z-sidemenu--plain'
      )
    );
    el.setAttribute('aria-hidden', isOpen() ? 'false' : 'true');
    panel.setAttribute('aria-label', asText(props.title));
    titleEl.textContent = asText(props.title);
    const width = props.width;
    if (width === undefined || width === null || width === '') removeVar(panel, '--z-sidemenu-width');
    else setVar(panel, '--z-sidemenu-width', typeof width === 'number' ? `${width}px` : asText(width));
    build(props);
    if (isOpen()) bindKeys();
    else releaseKeys();
  };
  update(ctx.props);

  ctx.on(closeBtn, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    close('button');
  });
  ctx.on(overlay, 'click', () => {
    if (ctx.props.dismissible === false) return;
    close('overlay');
  });

  return {
    el,
    update,
    api: {
      /** @returns {boolean} */
      get opened() {
        return isOpen();
      },
      /** Abre el panel y emite `open`. */
      open(reason = 'api') {
        open(reason);
      },
      /** Cierra el panel y emite `close`. */
      close(reason = 'api') {
        close(reason);
      },
      /** @returns {boolean} estado despues del cambio */
      toggle() {
        if (isOpen()) {
          close('api');
          return false;
        }
        open('api');
        return true;
      },
      /**
       * Marca un item como activo; si `closeOnSelect` esta activo cierra.
       * @param {unknown} id
       * @returns {boolean}
       */
      select(id) {
        const found = rows.find((row) => row.item.id === asText(id));
        if (!found) return false;
        return activate(found.item, null);
      },
      /** @returns {number} */
      get itemCount() {
        return rows.length;
      },
    },
  };
});

// --- window -----------------------------------------------------------

define('window', (ctx) => {
  const titleEl = ctx.h('span', { class: 'z-window__title' });
  const closeBtn = ctx.h('button', {
    class: 'z-window__close',
    type: 'button',
    'aria-label': 'Cerrar',
  }, 'x');
  const header = ctx.h('header', { class: 'z-window__header' }, [titleEl, closeBtn]);
  const body = ctx.h('div', { class: 'z-window__body' });
  const footer = ctx.h('div', { class: 'z-window__footer' });
  const panel = ctx.h(
    'div',
    { class: 'z-window', role: 'dialog', tabindex: '-1' },
    [header, body, footer]
  );
  const overlay = ctx.h('div', { class: 'z-window__overlay' });
  const el = ctx.h('div', { class: 'z-window-layer z-hidden' }, [overlay, panel]);

  let closed = false;
  let escapeHandler = null;
  let drag = null;

  const isVisible = () => Boolean(ctx.props.open) && !closed;
  const isModal = () => ctx.props.modal === true || ctx.props.modal === 'true' || ctx.props.modal === 1;

  const moveTo = (x, y) => {
    const left = toNumber(x);
    const top = toNumber(y);
    ctx.props.x = left;
    ctx.props.y = top;
    setVar(panel, '--z-window-x', `${left}px`);
    setVar(panel, '--z-window-y', `${top}px`);
    setVar(panel, '--z-window-tx', '0px');
    setVar(panel, '--z-window-ty', '0px');
    return { x: left, y: top };
  };

  const releaseDrag = () => {
    if (!drag) return;
    if (drag.move) ctx.release(ctx.doc(), 'mousemove', drag.move);
    if (drag.up) ctx.release(ctx.doc(), 'mouseup', drag.up);
    drag = null;
  };

  const beginDrag = (event) => {
    if (ctx.props.movable === false) return;
    const target = event && event.target;
    if (target && (target === closeBtn || (closeBtn.contains && closeBtn.contains(target)))) return;
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    releaseDrag();
    const rect = rectOf(panel);
    const startX = event && Number.isFinite(Number(event.clientX)) ? Number(event.clientX) : 0;
    const startY = event && Number.isFinite(Number(event.clientY)) ? Number(event.clientY) : 0;
    const originX = Number.isFinite(Number(ctx.props.x)) ? toNumber(ctx.props.x) : rect.left;
    const originY = Number.isFinite(Number(ctx.props.y)) ? toNumber(ctx.props.y) : rect.top;
    setVar(panel, '--z-window-tx', '0px');
    setVar(panel, '--z-window-ty', '0px');
    const record = {
      startX,
      startY,
      originX,
      originY,
      move: null,
      up: null,
    };
    record.move = (moveEvent) => {
      const clientX = moveEvent && Number.isFinite(Number(moveEvent.clientX)) ? Number(moveEvent.clientX) : startX;
      const clientY = moveEvent && Number.isFinite(Number(moveEvent.clientY)) ? Number(moveEvent.clientY) : startY;
      const position = moveTo(originX + (clientX - startX), originY + (clientY - startY));
      ctx.emit('move', { ...position, event: moveEvent });
    };
    record.up = (upEvent) => {
      releaseDrag();
      ctx.emit('moved', {
        x: Number.isFinite(Number(ctx.props.x)) ? toNumber(ctx.props.x) : originX,
        y: Number.isFinite(Number(ctx.props.y)) ? toNumber(ctx.props.y) : originY,
        event: upEvent,
      });
    };
    drag = record;
    ctx.on(ctx.doc(), 'mousemove', record.move);
    ctx.on(ctx.doc(), 'mouseup', record.up);
    ctx.emit('dragstart', { x: originX, y: originY, event });
  };

  const releaseKeys = () => {
    if (!escapeHandler) return;
    ctx.release(ctx.doc(), 'keydown', escapeHandler);
    escapeHandler = null;
  };

  const close = (reason = 'api') => {
    if (!ctx.props.open && closed) return false;
    ctx.props.open = false;
    closed = true;
    releaseDrag();
    releaseKeys();
    update(ctx.props);
    ctx.emit('close', { reason });
    return true;
  };

  const hide = (reason = 'api') => {
    if (!isVisible()) return false;
    ctx.props.open = false;
    releaseKeys();
    update(ctx.props);
    ctx.emit('hide', { reason });
    return true;
  };

  const show = () => {
    const wasVisible = isVisible();
    closed = false;
    ctx.props.open = true;
    update(ctx.props);
    if (typeof panel.focus === 'function') panel.focus();
    if (!wasVisible) ctx.emit('show', { instance: ctx.instance });
    return true;
  };

  const update = (props) => {
    const visible = Boolean(props.open) && !closed;
    const modal = isModal();
    el.setAttribute(
      'class',
      cls(
        'z-window-layer',
        visible ? 'z-is-open' : 'z-hidden',
        modal && 'z-window-layer--modal',
        props.plain && 'z-window-layer--plain'
      )
    );
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
    panel.setAttribute(
      'class',
      cls('z-window', modal && 'z-window--modal', props.movable === false && 'z-window--fixed')
    );
    panel.setAttribute('aria-modal', modal ? 'true' : 'false');
    panel.setAttribute('aria-label', asText(props.title));
    titleEl.textContent = asText(props.title);
    overlay.classList.toggle('z-hidden', !modal);
    overlay.classList.toggle('z-is-open', modal && visible);
    ctx.content(body, props.body !== undefined ? props.body : props.content);
    ctx.content(footer, props.footer);
    footer.classList.toggle('z-hidden', props.footer === undefined);
    header.classList.toggle('z-hidden', props.header === false);
    if (isMeasure(props.x)) moveTo(props.x, isMeasure(props.y) ? props.y : toNumber(ctx.props.y));
    if (isMeasure(props.width)) setVar(panel, '--z-window-width', measureOf(props.width));
    if (isMeasure(props.height)) setVar(panel, '--z-window-height', measureOf(props.height));

    if (visible && props.closeOnEscape !== false && !escapeHandler) {
      escapeHandler = (event) => {
        if (event && event.key === 'Escape') close('escape');
      };
      ctx.on(ctx.doc(), 'keydown', escapeHandler);
    }
    if (!visible) releaseKeys();
  };
  update(ctx.props);

  ctx.on(closeBtn, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    close('button');
  });
  ctx.on(header, 'mousedown', beginDrag);
  ctx.on(overlay, 'click', () => {
    if (ctx.props.dismissible === false) return;
    close('overlay');
  });

  return {
    el,
    update,
    destroy() {
      releaseDrag();
    },
    api: {
      /** Muestra la ventana. */
      show,
      /** Oculta la ventana sin marcarla como cerrada. */
      hide,
      /**
       * Cierra la ventana y emite `close`.
       * @param {string} [reason]
       */
      close,
      /**
       * Mueve la ventana a las coordenadas indicadas (px de viewport).
       * @param {number} x
       * @param {number} y
       * @returns {{ x: number, y: number }}
       */
      moveTo,
      /** @returns {boolean} */
      get visible() {
        return isVisible();
      },
      /** @returns {boolean} */
      get closed() {
        return closed;
      },
      /** @returns {boolean} */
      get modal() {
        return isModal();
      },
      /** @returns {Element} nodo de la ventana (sin el overlay) */
      get panel() {
        return panel;
      },
      /** @returns {Element} nodo del cuerpo */
      get body() {
        return body;
      },
      /** @returns {Element} nodo del header, usado para arrastrar */
      get header() {
        return header;
      },
    },
  };
});

// --- popup ------------------------------------------------------------

define('popup', (ctx) => {
  const body = ctx.h('div', { class: 'z-popup__body' });
  const el = ctx.h('div', { class: 'z-popup z-hidden', role: 'dialog' }, [body]);

  let escapeHandler = null;
  let outsideHandler = null;

  const isOpen = () => Boolean(ctx.props.open);

  const attach = () => {
    const host = ctx.doc().body;
    if (el.parentNode !== host) host.appendChild(el);
  };

  const apply = (open) => {
    ctx.props.open = open;
    el.classList.toggle('z-hidden', !open);
    el.classList.toggle('z-is-open', open);
    el.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      if (!escapeHandler) {
        escapeHandler = (event) => {
          if (event && event.key === 'Escape') close('escape');
        };
        ctx.on(ctx.doc(), 'keydown', escapeHandler);
      }
      if (!outsideHandler) {
        outsideHandler = (event) => {
          const anchor = ctx.instance ? ctx.instance.anchor : null;
          const target = event && event.target;
          if (anchor && (anchor === target || (anchor.contains && anchor.contains(target)))) return;
          if (!el.contains(target)) close('outside');
        };
        ctx.on(ctx.doc(), 'click', outsideHandler);
      }
    } else {
      releaseDoc();
    }
  };

  const releaseDoc = () => {
    if (escapeHandler) {
      ctx.release(ctx.doc(), 'keydown', escapeHandler);
      escapeHandler = null;
    }
    if (outsideHandler) {
      ctx.release(ctx.doc(), 'click', outsideHandler);
      outsideHandler = null;
    }
  };

  const close = (reason = 'api') => {
    if (!isOpen()) return false;
    apply(false);
    ctx.emit('close', { reason });
    return true;
  };

  const placeAt = (x, y) => {
    const left = toNumber(x);
    const top = toNumber(y);
    setVar(el, '--z-popup-x', `${left}px`);
    setVar(el, '--z-popup-y', `${top}px`);
    return { x: left, y: top };
  };

  const placementClass = (placement) => {
    replacePrefixedClass(el, 'z-popup--', `z-popup--${asText(placement || 'bottom-start')}`);
  };

  const showAt = (x, y) => {
    const position = placeAt(x, y);
    placementClass('at');
    ctx.props.x = position.x;
    ctx.props.y = position.y;
    attach();
    apply(true);
    ctx.emit('open', { ...position, anchor: null, reason: 'coords' });
    return position;
  };

  const showFor = (target) => {
    const anchor = resolveAnchor(ctx, target !== undefined ? target : ctx.props.anchor);
    if (!anchor) return false;
    ctx.props.anchor = target !== undefined ? target : ctx.props.anchor;
    const rect = rectOf(anchor);
    const placement = asText(ctx.props.placement || 'bottom-start');
    const offsetX = Number.isFinite(Number(ctx.props.offsetX)) ? Number(ctx.props.offsetX) : 0;
    const offsetY = Number.isFinite(Number(ctx.props.offsetY)) ? Number(ctx.props.offsetY) : 0;
    const left = rect.left + offsetX;
    const top = placement.startsWith('top')
      ? rect.top - offsetY
      : placement.startsWith('left') || placement.startsWith('right')
        ? rect.top + offsetY
        : rect.top + rect.height + offsetY;
    const x = placement.startsWith('left') ? rect.left - offsetX : left;
    placementClass(placement);
    const position = placeAt(x, top);
    ctx.props.x = position.x;
    ctx.props.y = position.y;
    attach();
    apply(true);
    ctx.emit('open', { ...position, anchor, reason: 'anchor' });
    return true;
  };

  const update = (props) => {
    ctx.content(body, props.body !== undefined ? props.body : props.content);
    if (isMeasure(props.width)) setVar(el, '--z-popup-width', measureOf(props.width));
    if (isOpen()) apply(true);
    else apply(false);
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: releaseDoc,
    api: {
      /**
       * Abre el popup anclado al target (selector, elemento o instancia).
       * @param {unknown} [target]
       * @returns {boolean} false si el ancla no se pudo resolver
       */
      showFor,
      /**
       * Abre el popup en coordenadas de viewport.
       * @param {number} x
       * @param {number} y
       * @returns {{ x: number, y: number }}
       */
      showAt,
      /** Oculta el popup. */
      hide(reason = 'api') {
        return close(reason);
      },
      /** Cierra el popup y emite `close`. */
      close,
      /** @returns {boolean} */
      get open() {
        return isOpen();
      },
      /** @returns {number} */
      get x() {
        return toNumber(ctx.props.x);
      },
      /** @returns {number} */
      get y() {
        return toNumber(ctx.props.y);
      },
      /** @returns {Element|null} */
      get anchor() {
        return resolveAnchor(ctx, ctx.props.anchor);
      },
      /** @returns {Element} nodo del cuerpo */
      get body() {
        return body;
      },
    },
  };
});

// --- tooltip ----------------------------------------------------------

define('tooltip', (ctx) => {
  const body = ctx.h('div', { class: 'z-tooltip__body' });
  const el = ctx.h('div', { class: 'z-tooltip z-hidden', role: 'tooltip', 'aria-hidden': 'true' }, [body]);

  let timer = null;

  const clearTimer = () => {
    if (timer === null) return;
    if (typeof clearTimeout === 'function') clearTimeout(timer);
    timer = null;
  };

  const attach = () => {
    const host = ctx.doc().body;
    if (el.parentNode !== host) host.appendChild(el);
  };

  const placementClass = (placement) => {
    replacePrefixedClass(el, 'z-tooltip--', `z-tooltip--${asText(placement || 'bottom')}`);
  };

  const place = (anchor) => {
    const rect = rectOf(anchor);
    const placement = asText(ctx.props.placement || 'bottom');
    const offsetX = Number.isFinite(Number(ctx.props.offsetX)) ? Number(ctx.props.offsetX) : 0;
    const offsetY = Number.isFinite(Number(ctx.props.offsetY)) ? Number(ctx.props.offsetY) : 0;
    let x = rect.left + offsetX;
    let y = rect.top + rect.height + offsetY;
    if (placement === 'top') y = rect.top - offsetY;
    else if (placement === 'left') x = rect.left - offsetX;
    else if (placement === 'right') x = rect.left + rect.width + offsetX;
    setVar(el, '--z-tooltip-x', `${x}px`);
    setVar(el, '--z-tooltip-y', `${y}px`);
  };

  const reveal = (anchor) => {
    attach();
    place(anchor);
    placementClass(ctx.props.placement);
    ctx.props.open = true;
    el.classList.remove('z-hidden');
    el.classList.add('z-is-open');
    el.setAttribute('aria-hidden', 'false');
    ctx.emit('show', { anchor, target: ctx.props.anchor, delay: toNumber(ctx.props.delay) });
  };

  const hide = (reason = 'api') => {
    clearTimer();
    if (!ctx.props.open) return false;
    ctx.props.open = false;
    el.classList.add('z-hidden');
    el.classList.remove('z-is-open');
    el.setAttribute('aria-hidden', 'true');
    ctx.emit('hide', { reason });
    return true;
  };

  const showFor = (target) => {
    const value = target !== undefined ? target : ctx.props.anchor;
    const anchor = resolveAnchor(ctx, value);
    if (!anchor) return false;
    ctx.props.anchor = value;
    clearTimer();
    const delay = Math.max(0, toNumber(ctx.props.delay));
    if (delay > 0) {
      timer = setTimeout(() => {
        timer = null;
        if (ctx.instance && ctx.instance.destroyed) return;
        reveal(anchor);
      }, delay);
      ctx.emit('schedule', { anchor, target: value, delay });
      return true;
    }
    reveal(anchor);
    return true;
  };

  const update = (props) => {
    const text = props.text !== undefined ? props.text : props.html;
    body.textContent = asText(text);
    placementClass(props.placement);
    if (props.width !== undefined) setVar(el, '--z-tooltip-max-width', measureOf(props.width));
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: clearTimer,
    api: {
      /**
       * Muestra el globo anclado al elemento indicado, respetando `delay`.
       * @param {unknown} target selector, elemento o instancia
       * @returns {boolean} false si el ancla no se pudo resolver
       */
      showFor,
      /** Cancela el delay y oculta el globo. */
      hide,
      /** @returns {boolean} */
      get open() {
        return Boolean(ctx.props.open);
      },
      /** @returns {boolean} true si hay un `showFor` esperando el delay */
      get pending() {
        return timer !== null;
      },
      /** @returns {Element|null} */
      get anchor() {
        return resolveAnchor(ctx, ctx.props.anchor);
      },
      /** @returns {Element} nodo del cuerpo */
      get body() {
        return body;
      },
    },
  };
});

// --- context ----------------------------------------------------------

define('context', (ctx) => {
  const body = ctx.h('div', { class: 'z-context__body' });
  const el = ctx.h('div', { class: 'z-context z-hidden', role: 'dialog' }, [body]);

  let escapeHandler = null;
  let outsideHandler = null;

  const isOpen = () => Boolean(ctx.props.open);

  const attach = () => {
    const host = ctx.doc().body;
    if (el.parentNode !== host) host.appendChild(el);
  };

  const releaseDoc = () => {
    if (escapeHandler) {
      ctx.release(ctx.doc(), 'keydown', escapeHandler);
      escapeHandler = null;
    }
    if (outsideHandler) {
      ctx.release(ctx.doc(), 'click', outsideHandler);
      outsideHandler = null;
    }
  };

  const apply = (open) => {
    ctx.props.open = open;
    el.classList.toggle('z-hidden', !open);
    el.classList.toggle('z-is-open', open);
    el.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (!open) {
      releaseDoc();
      return;
    }
    if (!escapeHandler) {
      escapeHandler = (event) => {
        if (event && event.key === 'Escape') close('escape');
      };
      ctx.on(ctx.doc(), 'keydown', escapeHandler);
    }
    if (!outsideHandler) {
      outsideHandler = (event) => {
        if (!el.contains(event && event.target)) close('outside');
      };
      ctx.on(ctx.doc(), 'click', outsideHandler);
    }
  };

  const close = (reason = 'api') => {
    if (!isOpen()) return false;
    apply(false);
    ctx.emit('close', { reason });
    return true;
  };

  const showAt = (x, y) => {
    const left = toNumber(x);
    const top = toNumber(y);
    setVar(el, '--z-context-x', `${left}px`);
    setVar(el, '--z-context-y', `${top}px`);
    ctx.props.x = left;
    ctx.props.y = top;
    attach();
    apply(true);
    ctx.emit('open', { x: left, y: top });
    return { x: left, y: top };
  };

  const update = (props) => {
    ctx.content(body, props.body !== undefined ? props.body : props.content);
    if (isMeasure(props.width)) setVar(el, '--z-context-width', measureOf(props.width));
    if (isOpen()) apply(true);
    else apply(false);
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: releaseDoc,
    api: {
      /**
       * Abre el contenedor en las coordenadas indicadas (px de viewport).
       * @param {number} x
       * @param {number} y
       * @returns {{ x: number, y: number }}
       */
      showAt,
      /** Oculta el contenedor. */
      hide(reason = 'api') {
        return close(reason);
      },
      /** Cierra el contenedor y emite `close`. */
      close,
      /** @returns {boolean} */
      get open() {
        return isOpen();
      },
      /** @returns {number} */
      get x() {
        return toNumber(ctx.props.x);
      },
      /** @returns {number} */
      get y() {
        return toNumber(ctx.props.y);
      },
      /** @returns {Element} nodo del cuerpo */
      get body() {
        return body;
      },
    },
  };
});

/**
 * Tipos de overlay y panel lateral que este modulo registra al importarse.
 * @type {string[]}
 */
export const OVERLAY_WIDGETS = ['sidebar', 'sidemenu', 'window', 'popup', 'tooltip', 'context'];
