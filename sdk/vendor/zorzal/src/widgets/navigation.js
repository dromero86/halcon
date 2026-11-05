/**
 * Widgets de navegacion: menu, submenu, toolbar, contextmenu y hint.
 *
 * Todos siguen el contrato del core: la factory recibe el contexto, devuelve
 * `{ el, update, destroy?, api? }` y emite eventos propios. Los estilos viven
 * en `src/zorzal.css` con prefijo `z-`; la unica escritura inline son las
 * variables CSS de posicion (`--z-contextmenu-*`, `--z-hint-*`), que el
 * stylesheet consume.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { Widget } from '../core/widget.js';

/** @param {unknown} value */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
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
  const style = el.style || {};
  if (typeof style.setProperty === 'function') style.setProperty(name, value);
  else style[name] = value;
}

/**
 * Normaliza una lista de items de menu.
 *
 * Acepta `{ id, text, icon, disabled, items }` y strings sueltos. El `id` es
 * la clave estable que se emite en `select`; si falta, se usa el indice.
 *
 * @param {unknown} items
 * @returns {{ id: string, text: string, icon: string, disabled: boolean, children: any[] }[]}
 */
function normalizeMenuItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (item === null || item === undefined) {
      return { id: String(index), text: '', icon: '', disabled: false, children: [] };
    }
    if (typeof item === 'object') {
      const rawId = item.id !== undefined ? item.id : item.value !== undefined ? item.value : index;
      const id = String(rawId);
      const label = item.text !== undefined ? item.text : item.label !== undefined ? item.label : id;
      const children = item.items !== undefined ? item.items : item.children;
      return {
        id,
        text: asText(label),
        icon: asText(item.icon),
        disabled: Boolean(item.disabled),
        children: normalizeMenuItems(children),
      };
    }
    return { id: String(index), text: asText(item), icon: '', disabled: false, children: [] };
  });
}

define('menu', (ctx) => {
  const el = ctx.h('ul', { class: 'z-menu', role: 'menubar' });
  /** @type {{ button: Element, item: any }[]} */
  let rows = [];
  let signature = null;

  const paint = (selected) => {
    const value = asText(selected);
    for (const { button, item } of rows) {
      const on = item.id === value;
      button.setAttribute(
        'class',
        cls(
          'z-menu__item',
          on && 'z-menu__item--selected',
          item.disabled && 'z-menu__item--disabled'
        )
      );
      button.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  };

  const activate = (item, event) => {
    if (item.disabled || ctx.props.disabled) return;
    ctx.props.selected = item.id;
    paint(item.id);
    const data = { id: item.id, item, event };
    ctx.emit('select', data);
    ctx.emit('itemclick', data);
  };

  const build = (props) => {
    const items = normalizeMenuItems(props.items);
    const next = JSON.stringify(items);
    if (next !== signature) {
      signature = next;
      for (const { button } of rows) ctx.release(button, 'click');
      while (el.firstChild) el.removeChild(el.firstChild);
      rows = items.map((item) => {
        const button = ctx.h(
          'button',
          {
            class: 'z-menu__item',
            type: 'button',
            role: 'menuitem',
            'data-id': item.id,
            disabled: item.disabled,
            'aria-disabled': item.disabled ? 'true' : 'false',
          },
          [
            item.icon
              ? ctx.h('span', { class: 'z-menu__icon', 'aria-hidden': 'true', text: item.icon })
              : null,
            ctx.h('span', { class: 'z-menu__text', text: item.text }),
          ]
        );
        ctx.on(button, 'click', (event) => {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          activate(item, event);
        });
        el.appendChild(ctx.h('li', { class: 'z-menu__row' }, [button]));
        return { button, item };
      });
    }
    paint(props.selected);
  };

  const update = (props) => {
    const horizontal = props.orientation === 'horizontal' || props.horizontal === true;
    el.setAttribute(
      'class',
      cls(
        'z-menu',
        horizontal ? 'z-menu--horizontal' : 'z-menu--vertical',
        props.plain && 'z-menu--plain',
        props.disabled && 'z-menu--disabled'
      )
    );
    el.setAttribute('aria-orientation', horizontal ? 'horizontal' : 'vertical');
    build(props);
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      get selected() {
        return asText(ctx.props.selected);
      },
      /**
       * Selecciona un item por id y emite `select`/`itemclick`.
       * @param {unknown} id
       * @returns {boolean} true si el item existe y esta habilitado
       */
      select(id) {
        const value = asText(id);
        const found = rows.find((row) => row.item.id === value);
        if (!found || found.item.disabled || ctx.props.disabled) return false;
        ctx.props.selected = value;
        paint(value);
        const data = { id: value, item: found.item, event: null };
        ctx.emit('select', data);
        ctx.emit('itemclick', data);
        return true;
      },
    },
  };
});

define('submenu', (ctx) => {
  const iconEl = ctx.h('span', { class: 'z-submenu__icon', 'aria-hidden': 'true' });
  const textEl = ctx.h('span', { class: 'z-submenu__text' });
  const arrowEl = ctx.h('span', { class: 'z-submenu__arrow', 'aria-hidden': 'true' }, '\u25be');
  const trigger = ctx.h(
    'button',
    {
      class: 'z-submenu__trigger',
      type: 'button',
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
    },
    [iconEl, textEl, arrowEl]
  );
  const list = ctx.h('ul', { class: 'z-submenu__list z-hidden', role: 'menu' });
  const el = ctx.h('div', { class: 'z-submenu' }, [trigger, list]);

  let escapeHandler = null;
  let signature = null;
  /** @type {Element[]} */
  let branchButtons = [];

  const isOpen = () => Boolean(ctx.props.open);

  const reveal = (nested, button) => {
    nested.classList.remove('z-hidden');
    button.setAttribute('aria-expanded', 'true');
  };

  const collapse = (nested, button) => {
    nested.classList.add('z-hidden');
    button.setAttribute('aria-expanded', 'false');
  };

  const apply = (open) => {
    ctx.props.open = open;
    el.classList.toggle('z-is-open', open);
    list.classList.toggle('z-hidden', !open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && !escapeHandler) {
      escapeHandler = (event) => {
        if (event && event.key === 'Escape') close('escape');
      };
      ctx.on(ctx.doc(), 'keydown', escapeHandler);
    }
    if (!open) {
      for (const button of branchButtons) button.setAttribute('aria-expanded', 'false');
      for (const nested of el.querySelectorAll('.z-submenu__list--nested')) {
        nested.classList.add('z-hidden');
      }
      if (escapeHandler) {
        ctx.release(ctx.doc(), 'keydown', escapeHandler);
        escapeHandler = null;
      }
    }
  };

  const openMenu = (reason = 'api') => {
    if (isOpen()) return;
    apply(true);
    ctx.emit('open', { reason });
  };

  const close = (reason = 'api') => {
    if (!isOpen()) return;
    apply(false);
    ctx.emit('close', { reason });
  };

  const emitSelect = (item, event) => {
    const data = { id: item.id, item, event };
    ctx.emit('select', data);
    ctx.emit('itemclick', data);
  };

  const buildList = (host, items) => {
    for (const item of items) {
      const hasChildren = item.children.length > 0;
      const nested = hasChildren
        ? ctx.h('ul', { class: 'z-submenu__list z-submenu__list--nested z-hidden', role: 'menu' })
        : null;
      const button = ctx.h(
        'button',
        {
          class: cls('z-submenu__item', hasChildren && 'z-submenu__item--branch'),
          type: 'button',
          role: 'menuitem',
          'data-id': item.id,
          disabled: item.disabled,
          'aria-haspopup': hasChildren ? 'true' : null,
          'aria-expanded': hasChildren ? 'false' : null,
        },
        [
          item.icon
            ? ctx.h('span', { class: 'z-submenu__item-icon', 'aria-hidden': 'true', text: item.icon })
            : null,
          ctx.h('span', { class: 'z-submenu__item-text', text: item.text }),
          hasChildren
            ? ctx.h('span', { class: 'z-submenu__arrow', 'aria-hidden': 'true' }, '\u25b8')
            : null,
        ]
      );
      const row = ctx.h('li', { class: 'z-submenu__row' }, [button, nested]);
      host.appendChild(row);

      if (hasChildren) {
        branchButtons.push(button);
        ctx.on(row, 'mouseenter', () => reveal(nested, button));
        ctx.on(row, 'mouseleave', () => collapse(nested, button));
        buildList(nested, item.children);
      }

      ctx.on(button, 'click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (item.disabled || ctx.props.disabled) return;
        if (hasChildren) {
          reveal(nested, button);
          return;
        }
        emitSelect(item, event);
        close('select');
      });
    }
  };

  const build = (props) => {
    const items = normalizeMenuItems(props.items);
    const next = JSON.stringify(items);
    if (next !== signature) {
      signature = next;
      for (const button of list.querySelectorAll('button')) ctx.release(button, 'click');
      while (list.firstChild) list.removeChild(list.firstChild);
      branchButtons = [];
      buildList(list, items);
    }
  };

  const update = (props) => {
    const horizontal = props.orientation === 'horizontal' || props.horizontal === true;
    el.setAttribute(
      'class',
      cls(
        'z-submenu',
        horizontal && 'z-submenu--horizontal',
        props.plain && 'z-submenu--plain',
        props.disabled && 'z-submenu--disabled'
      )
    );
    iconEl.setAttribute('class', cls('z-submenu__icon', !props.icon && 'z-hidden'));
    iconEl.textContent = asText(props.icon);
    textEl.textContent = asText(props.text !== undefined ? props.text : props.label);
    if (props.disabled) trigger.setAttribute('disabled', '');
    else trigger.removeAttribute('disabled');
    build(props);
    apply(Boolean(props.open));
  };
  update(ctx.props);

  ctx.on(trigger, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (ctx.props.disabled) return;
    if (isOpen()) close('trigger');
    else openMenu('trigger');
  });
  ctx.on(trigger, 'mouseenter', () => {
    if (!ctx.props.disabled) openMenu('hover');
  });
  ctx.on(el, 'mouseleave', () => {
    if (isOpen()) close('hover');
  });

  return {
    el,
    update,
    destroy() {
      if (escapeHandler) {
        ctx.release(ctx.doc(), 'keydown', escapeHandler);
        escapeHandler = null;
      }
    },
    api: {
      open() {
        if (ctx.props.disabled) return;
        openMenu('api');
      },
      close() {
        close('api');
      },
      /** @returns {boolean} estado despues del cambio */
      toggle() {
        if (isOpen()) {
          close('api');
          return false;
        }
        openMenu('api');
        return isOpen();
      },
      /** @returns {boolean} */
      get opened() {
        return isOpen();
      },
    },
  };
});

define('toolbar', (ctx) => {
  const el = ctx.h('div', { class: 'z-toolbar', role: 'toolbar' });

  /** @type {{ button: Element, entry: any }[]} */
  let records = [];
  /** @type {Element[]} */
  let groups = [];
  let lastItems = null;

  const makeSeparator = () =>
    ctx.h('span', { class: 'z-toolbar__separator', role: 'separator', 'aria-orientation': 'vertical' });

  const makeButton = (entry) => {
    const id = entry.id !== undefined && entry.id !== null ? String(entry.id) : '';
    const text = asText(entry.text !== undefined ? entry.text : entry.label);
    const icon = asText(entry.icon);
    const button = ctx.h(
      'button',
      {
        class: cls('z-toolbar__button', entry.variant && `z-toolbar__button--${entry.variant}`),
        type: 'button',
        'data-id': id || null,
        title: entry.title ? asText(entry.title) : null,
        'aria-label': !text && icon ? asText(entry.title || icon) : null,
        disabled: Boolean(entry.disabled),
      },
      [
        icon ? ctx.h('span', { class: 'z-toolbar__icon', 'aria-hidden': 'true', text: icon }) : null,
        text ? ctx.h('span', { class: 'z-toolbar__text', text }) : null,
      ]
    );
    records.push({ button, entry });
    ctx.on(button, 'click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (entry.disabled || ctx.props.disabled) return;
      const data = { id, item: entry, event };
      ctx.emit('click', data);
      if (id) ctx.emit('select', data);
    });
    return button;
  };

  /**
   * Devuelve un nodo o un spec listo para `ctx.content`.
   * @param {unknown} entry
   * @returns {any}
   */
  const entryNode = (entry) => {
    if (entry === null || entry === undefined || entry === false || entry === '-' || entry === '|') {
      return makeSeparator();
    }
    if (typeof entry === 'string' || typeof entry === 'number') {
      return makeButton({ text: String(entry) });
    }
    if (typeof entry !== 'object') return null;
    if (entry.separator === true) return makeSeparator();
    if (typeof entry.kind === 'string') return entry;
    const nested = entry.group !== undefined ? entry.group : entry.items;
    if (Array.isArray(nested)) {
      const box = ctx.h('div', { class: 'z-toolbar__group', role: 'group' });
      const nodes = [];
      for (const member of nested) {
        const node = entryNode(member);
        if (node !== null) nodes.push(node);
      }
      ctx.content(box, nodes);
      groups.push(box);
      return box;
    }
    return makeButton(entry);
  };

  const strip = () => {
    for (const { button } of records) ctx.release(button, 'click');
    records = [];
    for (const box of groups) ctx.content(box, []);
    groups = [];
    ctx.content(el, []);
  };

  const paintDisabled = () => {
    for (const { button, entry } of records) {
      if (entry.disabled || ctx.props.disabled) button.setAttribute('disabled', '');
      else button.removeAttribute('disabled');
    }
  };

  const update = (props) => {
    el.setAttribute(
      'class',
      cls(
        'z-toolbar',
        props.plain && 'z-toolbar--plain',
        props.compact && 'z-toolbar--compact',
        props.sticky && 'z-toolbar--sticky',
        props.disabled && 'z-toolbar--disabled'
      )
    );
    el.setAttribute('aria-orientation', 'horizontal');
    if (props.items !== lastItems) {
      lastItems = props.items;
      strip();
      const nodes = [];
      const items = Array.isArray(props.items) ? props.items : [];
      for (const entry of items) {
        const node = entryNode(entry);
        if (node !== null) nodes.push(node);
      }
      ctx.content(el, nodes);
    }
    paintDisabled();
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {number} cantidad de botones renderizados */
      get count() {
        return records.length;
      },
      /** Fuerza el rearmado de `items` aunque sea el mismo array. */
      refresh() {
        lastItems = null;
        update(ctx.props);
      },
    },
  };
});

define('contextmenu', (ctx) => {
  const list = ctx.h('ul', { class: 'z-contextmenu__list', role: 'menu' });
  const el = ctx.h(
    'div',
    { class: 'z-contextmenu z-hidden', role: 'menu', 'aria-hidden': 'true' },
    [list]
  );

  /** @type {{ button: Element, item: any }[]} */
  let rows = [];
  let signature = null;
  let escapeHandler = null;
  let outsideHandler = null;

  const apply = (open) => {
    ctx.props.open = open;
    el.classList.toggle('z-hidden', !open);
    el.classList.toggle('z-is-open', open);
    el.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open && !escapeHandler) {
      escapeHandler = (event) => {
        if (event && event.key === 'Escape') close('escape');
      };
      ctx.on(ctx.doc(), 'keydown', escapeHandler);
      outsideHandler = (event) => {
        if (!el.contains(event.target)) close('outside');
      };
      ctx.on(ctx.doc(), 'click', outsideHandler);
    }
    if (!open) {
      if (escapeHandler) {
        ctx.release(ctx.doc(), 'keydown', escapeHandler);
        escapeHandler = null;
      }
      if (outsideHandler) {
        ctx.release(ctx.doc(), 'click', outsideHandler);
        outsideHandler = null;
      }
    }
  };

  const close = (reason = 'api') => {
    if (!ctx.props.open) return;
    apply(false);
    ctx.emit('close', { reason });
  };

  const showAt = (x, y) => {
    const left = Number.isFinite(Number(x)) ? Number(x) : 0;
    const top = Number.isFinite(Number(y)) ? Number(y) : 0;
    ctx.props.x = left;
    ctx.props.y = top;
    setVar(el, '--z-contextmenu-x', `${left}px`);
    setVar(el, '--z-contextmenu-y', `${top}px`);
    apply(true);
    ctx.emit('open', { x: left, y: top });
  };

  const build = (props) => {
    const items = normalizeMenuItems(props.items);
    const next = JSON.stringify(items);
    if (next !== signature) {
      signature = next;
      for (const { button } of rows) ctx.release(button, 'click');
      while (list.firstChild) list.removeChild(list.firstChild);
      rows = items.map((item) => {
        const button = ctx.h(
          'button',
          {
            class: 'z-contextmenu__item',
            type: 'button',
            role: 'menuitem',
            'data-id': item.id,
            disabled: item.disabled,
            'aria-disabled': item.disabled ? 'true' : 'false',
          },
          [
            item.icon
              ? ctx.h('span', { class: 'z-contextmenu__icon', 'aria-hidden': 'true', text: item.icon })
              : null,
            ctx.h('span', { class: 'z-contextmenu__text', text: item.text }),
          ]
        );
        ctx.on(button, 'click', (event) => {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          if (item.disabled) return;
          const data = { id: item.id, item, event };
          ctx.emit('select', data);
          ctx.emit('itemclick', data);
          close('select');
        });
        list.appendChild(ctx.h('li', { class: 'z-contextmenu__row' }, [button]));
        return { button, item };
      });
    }
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-contextmenu', props.open ? 'z-is-open' : 'z-hidden'));
    build(props);
    apply(Boolean(props.open));
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /**
       * Abre el menu en las coordenadas dadas (px de viewport).
       * @param {number} x
       * @param {number} y
       */
      showAt,
      close() {
        close('api');
      },
      /** @returns {boolean} */
      get open() {
        return Boolean(ctx.props.open);
      },
      /** @returns {number} */
      get x() {
        return Number(ctx.props.x) || 0;
      },
      /** @returns {number} */
      get y() {
        return Number(ctx.props.y) || 0;
      },
    },
  };
});

define('hint', (ctx) => {
  const bodyEl = ctx.h('div', { class: 'z-hint__body' });
  const el = ctx.h('div', { class: 'z-hint z-hidden', role: 'tooltip', 'aria-hidden': 'true' }, [
    bodyEl,
  ]);

  /**
   * @param {unknown} target selector, elemento o instancia
   * @returns {Element|null}
   */
  const resolveAnchor = (target) => {
    if (target === undefined || target === null || target === '') return null;
    if (target instanceof Widget) return target.el;
    if (typeof target === 'string') return ctx.doc().querySelector(target);
    if (typeof target === 'object' && typeof target.nodeType === 'number') return target;
    return null;
  };

  const attach = (anchor) => {
    const host = anchor && anchor.parentNode ? anchor.parentNode : ctx.doc().body;
    if (el.parentNode !== host) host.appendChild(el);
  };

  const place = (anchor) => {
    const offsetX = Number(ctx.props.offsetX) || 0;
    const offsetY = Number(ctx.props.offsetY) || 0;
    const left = anchor && Number.isFinite(anchor.offsetLeft) ? anchor.offsetLeft : 0;
    const top = anchor && Number.isFinite(anchor.offsetTop) ? anchor.offsetTop : 0;
    const height = anchor && Number.isFinite(anchor.offsetHeight) ? anchor.offsetHeight : 0;
    setVar(el, '--z-hint-x', `${left + offsetX}px`);
    setVar(el, '--z-hint-y', `${top + height + offsetY}px`);
  };

  const apply = (open) => {
    ctx.props.open = open;
    el.classList.toggle('z-hidden', !open);
    el.classList.toggle('z-is-open', open);
    el.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  const show = (target) => {
    if (target !== undefined) ctx.props.target = target;
    const anchor = resolveAnchor(ctx.props.target);
    const hasTarget = ctx.props.target !== undefined && ctx.props.target !== null && ctx.props.target !== '';
    if (hasTarget && !anchor) return false;
    attach(anchor);
    place(anchor);
    apply(true);
    ctx.emit('show', { target: ctx.props.target, anchor });
    return true;
  };

  const hide = (reason = 'api') => {
    if (!ctx.props.open) return;
    apply(false);
    ctx.emit('hide', { reason });
  };

  const update = (props) => {
    el.setAttribute(
      'class',
      cls(
        'z-hint',
        `z-hint--${asText(props.placement || 'bottom')}`,
        props.open ? 'z-is-open' : 'z-hidden'
      )
    );
    el.setAttribute('aria-hidden', props.open ? 'false' : 'true');
    ctx.content(bodyEl, props.body !== undefined ? props.body : props.text);
    if (props.open) {
      const anchor = resolveAnchor(props.target);
      attach(anchor);
      place(anchor);
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /**
       * Muestra el hint anclado al target actual, o al que se pasa.
       * @param {unknown} [target]
       * @returns {boolean} false si el target no se pudo resolver
       */
      show,
      hide,
      /** @returns {boolean} estado despues del cambio */
      toggle() {
        if (ctx.props.open) {
          hide('api');
          return false;
        }
        return show();
      },
      /** @returns {boolean} */
      get open() {
        return Boolean(ctx.props.open);
      },
      /** @returns {Element|null} */
      get anchor() {
        return resolveAnchor(ctx.props.target);
      },
      /** @returns {unknown} */
      get target() {
        return ctx.props.target;
      },
    },
  };
});

/**
 * Tipos de navegacion que este modulo registra al importarse.
 * @type {string[]}
 */
export const NAVIGATION_WIDGETS = ['menu', 'submenu', 'toolbar', 'contextmenu', 'hint'];
