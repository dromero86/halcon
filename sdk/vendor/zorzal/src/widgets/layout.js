/**
 * Widgets de estructura y de layout.
 *
 * Estructura: panel, bar, sheet y dialog.
 * Layout: layout, multiview, tabview, accordion, accordionitem y headerlayout.
 * Posicionamiento: gridlayout, abslayout, align, proxy, spacer y resizer.
 *
 * Los slots (`body`, `footer`, `left`, `right`, `actions`) aceptan un spec,
 * una lista de specs, una instancia ya creada o texto. Los widgets de layout
 * reciben sus hijos en `children` (o `body` en headerlayout) y los destruyen
 * junto con el padre.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { create, Widget } from '../core/widget.js';

/** @param {unknown} value */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

define('panel', (ctx) => {
  const titleEl = ctx.h('h2', { class: 'z-panel__title' });
  const toggleBtn = ctx.h('button', { class: 'z-panel__toggle', type: 'button', 'aria-expanded': 'true' });
  const header = ctx.h('header', { class: 'z-panel__header' }, [titleEl, toggleBtn]);
  const body = ctx.h('div', { class: 'z-panel__body' });
  const footer = ctx.h('div', { class: 'z-panel__footer' });
  const el = ctx.h('section', { class: 'z-panel' }, [header, body, footer]);

  const update = (props) => {
    const collapsed = Boolean(props.collapsed);
    el.setAttribute('class', cls('z-panel', collapsed && 'z-panel--collapsed', props.plain && 'z-panel--plain'));
    titleEl.textContent = asText(props.title);
    header.style.display = props.title ? '' : 'none';
    if (props.collapsible !== false) {
      toggleBtn.style.display = '';
      toggleBtn.textContent = collapsed ? '+' : '-';
      toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggleBtn.setAttribute('aria-label', collapsed ? 'Expandir' : 'Contraer');
    } else {
      toggleBtn.style.display = 'none';
    }
    body.style.display = collapsed ? 'none' : '';
    ctx.content(body, props.body !== undefined ? props.body : props.content);
    ctx.content(footer, props.footer);
    footer.style.display = props.footer === undefined ? 'none' : '';
  };
  update(ctx.props);

  ctx.on(toggleBtn, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (ctx.props.collapsible === false) return;
    ctx.props.collapsed = !ctx.props.collapsed;
    update(ctx.props);
    ctx.emit('collapse', { collapsed: ctx.props.collapsed, event });
  });

  return { el, update };
});

define('bar', (ctx) => {
  const titleEl = ctx.h('span', { class: 'z-bar__title' });
  const left = ctx.h('div', { class: 'z-bar__left' });
  const right = ctx.h('div', { class: 'z-bar__right' });
  const el = ctx.h('header', { class: 'z-bar' }, [left, titleEl, right]);

  const update = (props) => {
    el.setAttribute('class', cls('z-bar', props.sticky && 'z-bar--sticky', props.plain && 'z-bar--plain'));
    titleEl.textContent = asText(props.title);
    ctx.content(left, props.left !== undefined ? props.left : props.items);
    ctx.content(right, props.right !== undefined ? props.right : props.actions);
    left.style.display = props.left === undefined && props.items === undefined ? 'none' : '';
    right.style.display = props.right === undefined && props.actions === undefined ? 'none' : '';
  };
  update(ctx.props);

  return { el, update };
});

define('sheet', (ctx) => {
  const titleEl = ctx.h('h2', { class: 'z-sheet__title' });
  const closeBtn = ctx.h('button', { class: 'z-sheet__close', type: 'button', 'aria-label': 'Cerrar' }, 'x');
  const header = ctx.h('header', { class: 'z-sheet__header' }, [titleEl, closeBtn]);
  const body = ctx.h('div', { class: 'z-sheet__body' });
  const footer = ctx.h('div', { class: 'z-sheet__footer' });
  const panel = ctx.h('aside', { class: 'z-sheet', role: 'dialog' }, [header, body, footer]);
  const el = ctx.h('div', { class: 'z-overlay z-overlay--sheet' }, [panel]);

  let escape = null;

  const close = (reason) => {
    if (!ctx.props.open) return;
    ctx.props.open = false;
    update(ctx.props);
    ctx.emit('close', { reason });
  };

  const update = (props) => {
    const open = Boolean(props.open);
    const side = asText(props.side || 'right');
    el.style.display = open ? 'flex' : 'none';
    el.setAttribute('class', cls('z-overlay', 'z-overlay--sheet', open && 'z-is-open'));
    panel.setAttribute('class', cls('z-sheet', `z-sheet--${side}`));
    titleEl.textContent = asText(props.title);
    ctx.content(body, props.body !== undefined ? props.body : props.content);
    ctx.content(footer, props.footer);
    footer.style.display = props.footer === undefined ? 'none' : '';

    if (open && !escape) {
      escape = (event) => {
        if (event && event.key === 'Escape') close('escape');
      };
      ctx.on(ctx.doc(), 'keydown', escape);
    }
    if (!open && escape) {
      ctx.release(ctx.doc(), 'keydown', escape);
      escape = null;
    }
  };
  update(ctx.props);

  ctx.on(closeBtn, 'click', () => close('button'));
  ctx.on(el, 'click', (event) => {
    if (ctx.props.dismissible === false) return;
    if (event && (event.target === el || event.target === panel)) close('overlay');
  });

  return {
    el,
    update,
    destroy() {
      if (escape) {
        ctx.release(ctx.doc(), 'keydown', escape);
        escape = null;
      }
    },
  };
});

define('dialog', (ctx) => {
  const titleEl = ctx.h('h2', { class: 'z-dialog__title' });
  const closeBtn = ctx.h('button', { class: 'z-dialog__close', type: 'button', 'aria-label': 'Cerrar' }, 'x');
  const header = ctx.h('header', { class: 'z-dialog__header' }, [titleEl, closeBtn]);
  const body = ctx.h('div', { class: 'z-dialog__body' });
  const customFooter = ctx.h('div', { class: 'z-dialog__custom' });
  const okBtn = ctx.h('button', { class: 'z-action z-action--primary', type: 'button' }, 'Aceptar');
  const cancelBtn = ctx.h('button', { class: 'z-action z-action--ghost', type: 'button' }, 'Cancelar');
  const actions = ctx.h('div', { class: 'z-dialog__actions' }, [cancelBtn, okBtn]);
  const footer = ctx.h('div', { class: 'z-dialog__footer' }, [customFooter, actions]);
  const panel = ctx.h('div', { class: 'z-dialog', role: 'dialog', 'aria-modal': 'true' }, [header, body, footer]);
  const el = ctx.h('div', { class: 'z-overlay z-overlay--dialog' }, [panel]);

  let escape = null;

  const close = (reason) => {
    if (!ctx.props.open) return;
    ctx.props.open = false;
    update(ctx.props);
    ctx.emit('close', { reason });
  };

  const update = (props) => {
    const open = Boolean(props.open);
    const hasCustom = props.footer !== undefined;
    const showActions = !hasCustom && props.showActions !== false;

    el.style.display = open ? 'flex' : 'none';
    el.setAttribute('class', cls('z-overlay', 'z-overlay--dialog', open && 'z-is-open'));
    panel.setAttribute('aria-label', asText(props.title));
    titleEl.textContent = asText(props.title);
    ctx.content(body, props.body !== undefined ? props.body : props.content);
    ctx.content(customFooter, props.footer);
    customFooter.style.display = hasCustom ? '' : 'none';
    actions.style.display = showActions ? '' : 'none';
    okBtn.textContent = asText(props.okText || 'Aceptar');
    cancelBtn.textContent = asText(props.cancelText || 'Cancelar');
    footer.style.display = hasCustom || showActions ? '' : 'none';

    if (open && !escape) {
      escape = (event) => {
        if (event && event.key === 'Escape') close('escape');
      };
      ctx.on(ctx.doc(), 'keydown', escape);
    }
    if (!open && escape) {
      ctx.release(ctx.doc(), 'keydown', escape);
      escape = null;
    }
  };
  update(ctx.props);

  ctx.on(closeBtn, 'click', () => close('button'));
  ctx.on(okBtn, 'click', () => ctx.emit('ok', { instance: ctx.instance }));
  ctx.on(cancelBtn, 'click', () => close('cancel'));
  ctx.on(el, 'click', (event) => {
    if (event && event.target === el) close('overlay');
  });

  return {
    el,
    update,
    destroy() {
      if (escape) {
        ctx.release(ctx.doc(), 'keydown', escape);
        escape = null;
      }
    },
    api: {
      /** @returns {boolean} */
      get open() {
        return Boolean(ctx.props.open);
      },
      /** Cierra el dialogo y emite "close". */
      close() {
        close('api');
      },
    },
  };
});

// --- layout ----------------------------------------------------------

/**
 * Identificador estable de un hijo de layout: `id` del spec o su indice.
 * @param {unknown} child
 * @param {number} index
 * @returns {string}
 */
function childId(child, index) {
  if (child instanceof Widget && child.props && child.props.id !== undefined) return asText(child.props.id);
  if (child && typeof child === 'object' && !(child instanceof Widget) && child.id !== undefined) {
    return asText(child.id);
  }
  return String(index);
}

/**
 * Etiqueta visible de una vista: `tab`, `title` o `label`.
 * @param {unknown} child
 * @param {string} id
 * @returns {string}
 */
function viewLabel(child, id) {
  const props = child instanceof Widget ? child.props : child;
  if (props && typeof props === 'object') {
    for (const key of ['tab', 'title', 'label', 'text']) {
      if (props[key] !== undefined && props[key] !== null && props[key] !== '') return asText(props[key]);
    }
  }
  return id;
}

/** @param {unknown} children */
function asList(children) {
  if (Array.isArray(children)) return children;
  if (children === undefined || children === null || children === false) return [];
  return [children];
}

define('layout', (ctx) => {
  const el = ctx.h('div', { class: 'z-layout' });
  let cells = [];
  let source;

  const destroyCells = () => {
    for (const cell of cells) {
      if (cell.instance) cell.instance.destroy();
    }
    cells = [];
  };

  const build = (children) => {
    destroyCells();
    while (el.firstChild) el.removeChild(el.firstChild);
    cells = asList(children).map((child) => {
      const cell = ctx.h('div', { class: 'z-layout__cell' });
      let instance = null;
      if (child instanceof Widget) {
        instance = child;
      } else if (child && typeof child === 'object' && typeof child.kind === 'string') {
        instance = create(child);
      } else if (child !== undefined && child !== null && child !== false) {
        const node =
          typeof child === 'object' && typeof child.nodeType === 'number'
            ? child
            : ctx.doc().createTextNode(String(child));
        cell.appendChild(node);
      }
      if (instance) cell.appendChild(instance.el);
      el.appendChild(cell);
      return { cell, instance };
    });
  };

  const update = (props) => {
    const horizontal = props.orientation === 'horizontal' || props.horizontal === true;
    el.setAttribute(
      'class',
      cls('z-layout', horizontal ? 'z-layout--horizontal' : 'z-layout--vertical', props.plain && 'z-layout--plain')
    );
    if (props.children !== source) {
      source = props.children;
      build(props.children);
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: destroyCells,
    api: {
      /** @returns {'horizontal'|'vertical'} */
      get orientation() {
        return el.classList.contains('z-layout--horizontal') ? 'horizontal' : 'vertical';
      },
      /** @returns {number} */
      get length() {
        return cells.length;
      },
    },
  };
});

// --- multiview / tabview ---------------------------------------------

/**
 * Nucleo compartido por multiview y tabview: paneles hijos, vista activa y
 * evento `change`. Devuelve el contenedor de paneles y las operaciones que
 * usan los dos widgets.
 *
 * @param {any} ctx
 */
function createViews(ctx) {
  const el = ctx.h('div', { class: 'z-multiview__panels' });
  let entries = [];
  let source;
  let current = null;

  const clear = () => {
    for (const entry of entries) entry.instance.destroy();
    entries = [];
    while (el.firstChild) el.removeChild(el.firstChild);
    current = null;
  };

  const build = (children) => {
    clear();
    entries = asList(children)
      .map((child, index) => {
        if (child === undefined || child === null || child === false) return null;
        if (!(child instanceof Widget) && (typeof child !== 'object' || typeof child.kind !== 'string')) {
          throw new TypeError('zorzal: multiview espera specs o instancias en "children"');
        }
        const id = childId(child, index);
        const panel = ctx.h('section', { class: 'z-multiview__panel', 'data-id': id, role: 'tabpanel' });
        const instance = create(child);
        panel.appendChild(instance.el);
        el.appendChild(panel);
        return { id, panel, instance, label: viewLabel(child, id) };
      })
      .filter(Boolean);
  };

  const paint = (id) => {
    current = id;
    for (const entry of entries) {
      const active = entry.id === id;
      entry.panel.setAttribute('class', cls('z-multiview__panel', active && 'z-multiview__panel--active'));
      entry.panel.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) entry.panel.removeAttribute('hidden');
      else entry.panel.setAttribute('hidden', '');
    }
  };

  const find = (id) => entries.find((entry) => entry.id === asText(id)) || null;

  const activate = (id, reason) => {
    const entry = find(id);
    if (!entry || entry.id === current) return false;
    const previous = current;
    ctx.props.active = entry.id;
    paint(entry.id);
    ctx.emit('change', { id: entry.id, previous, reason });
    return true;
  };

  const sync = (props) => {
    if (props.children !== source) {
      source = props.children;
      build(props.children);
    }
    const entry = find(props.active) || entries[0] || null;
    if (entry) props.active = entry.id;
    paint(entry ? entry.id : null);
  };

  return {
    el,
    sync,
    activate,
    entries: () => entries,
    destroy: clear,
    get active() {
      return current;
    },
  };
}

define('multiview', (ctx) => {
  const views = createViews(ctx);
  const el = ctx.h('div', { class: 'z-multiview' }, [views.el]);

  const update = (props) => {
    el.setAttribute('class', cls('z-multiview', props.plain && 'z-multiview--plain'));
    views.sync(props);
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => views.destroy(),
    api: {
      /**
       * Activa la vista con ese id. Devuelve `false` si el id no existe o ya
       * estaba activa; en caso contrario emite `change`.
       * @param {string|number} id
       * @returns {boolean}
       */
      setActive(id) {
        return views.activate(id, 'api');
      },
      /** @returns {string|null} */
      get active() {
        return views.active;
      },
      /** @returns {string[]} */
      get viewIds() {
        return views.entries().map((entry) => entry.id);
      },
    },
  };
});

define('tabview', (ctx) => {
  const views = createViews(ctx);
  const bar = ctx.h('div', { class: 'z-tabview__bar', role: 'tablist' });
  const el = ctx.h('div', { class: 'z-tabview' }, [bar, views.el]);
  let tabs = [];

  const paintTabs = () => {
    const active = views.active;
    for (const tab of tabs) {
      const on = tab.id === active;
      tab.button.setAttribute('class', cls('z-tabview__tab', on && 'z-tabview__tab--active'));
      tab.button.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  };

  const buildTabs = () => {
    for (const tab of tabs) ctx.release(tab.button, 'click');
    while (bar.firstChild) bar.removeChild(bar.firstChild);
    tabs = views.entries().map((entry) => {
      const button = ctx.h(
        'button',
        {
          class: 'z-tabview__tab',
          type: 'button',
          role: 'tab',
          'data-id': entry.id,
          'aria-selected': 'false',
        },
        entry.label
      );
      ctx.on(button, 'click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        activate(entry.id, 'click');
      });
      bar.appendChild(button);
      return { id: entry.id, button };
    });
    paintTabs();
  };

  const activate = (id, reason) => {
    const changed = views.activate(id, reason);
    if (changed) paintTabs();
    return changed;
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-tabview', props.plain && 'z-tabview--plain'));
    const before = views.entries();
    views.sync(props);
    if (views.entries() !== before) buildTabs();
    paintTabs();
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => views.destroy(),
    api: {
      /**
       * Activa la vista y su tab. Emite `change` si el cambio ocurre.
       * @param {string|number} id
       * @returns {boolean}
       */
      setActive(id) {
        return activate(id, 'api');
      },
      /** @returns {string|null} */
      get active() {
        return views.active;
      },
      /** @returns {string[]} */
      get viewIds() {
        return views.entries().map((entry) => entry.id);
      },
    },
  };
});

// --- accordion / accordionitem ---------------------------------------

define('accordionitem', (ctx) => {
  const titleEl = ctx.h('span', { class: 'z-accordionitem__title' });
  const icon = ctx.h('span', { class: 'z-accordionitem__icon', 'aria-hidden': 'true' }, '+');
  const button = ctx.h(
    'button',
    { class: 'z-accordionitem__header', type: 'button', 'aria-expanded': 'true' },
    [titleEl, icon]
  );
  const body = ctx.h('div', { class: 'z-accordionitem__body' });
  const el = ctx.h('section', { class: 'z-accordionitem' }, [button, body]);

  const isOpen = (props) => props.open !== false;

  const update = (props) => {
    const open = isOpen(props);
    el.setAttribute(
      'class',
      cls('z-accordionitem', open && 'z-accordionitem--open', props.disabled && 'z-accordionitem--disabled')
    );
    titleEl.textContent = asText(props.title);
    icon.textContent = open ? '-' : '+';
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (props.disabled) button.setAttribute('disabled', '');
    else button.removeAttribute('disabled');
    if (open) body.removeAttribute('hidden');
    else body.setAttribute('hidden', '');
    ctx.content(body, props.body !== undefined ? props.body : props.content);
  };
  update(ctx.props);

  const change = (open) => {
    if (isOpen(ctx.props) === open) return false;
    ctx.props.open = open;
    update(ctx.props);
    ctx.emit('change', { id: ctx.props.id, open });
    return true;
  };

  ctx.on(button, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (ctx.props.disabled) return;
    change(!isOpen(ctx.props));
  });

  return {
    el,
    update,
    api: {
      /** @returns {boolean} */
      open() {
        return change(true);
      },
      /** @returns {boolean} */
      close() {
        return change(false);
      },
      /** @returns {boolean} */
      toggle() {
        return change(!isOpen(ctx.props));
      },
      /** @returns {boolean} */
      get opened() {
        return isOpen(ctx.props);
      },
    },
  };
});

define('accordion', (ctx) => {
  const el = ctx.h('div', { class: 'z-accordion' });
  let entries = [];
  let source;

  const multiple = () => ctx.props.multiple === true;
  const isOpen = (entry) => entry.instance.props.open !== false;

  const openIds = () => entries.filter(isOpen).map((entry) => entry.id);
  const find = (id) => entries.find((entry) => entry.id === asText(id)) || null;

  const destroyEntries = () => {
    for (const entry of entries) entry.instance.destroy();
    entries = [];
  };

  const normalize = (child, index) => {
    const id = childId(child, index);
    if (child instanceof Widget) return { id, spec: child };
    if (child && typeof child === 'object' && typeof child.kind === 'string') return { id, spec: child };
    const base = child && typeof child === 'object' ? child : { body: child };
    return { id, spec: { kind: 'accordionitem', open: false, ...base } };
  };

  const closeOthers = (id) => {
    for (const entry of entries) {
      if (entry.id !== id && isOpen(entry)) entry.instance.set({ open: false });
    }
  };

  const build = (children) => {
    destroyEntries();
    while (el.firstChild) el.removeChild(el.firstChild);
    entries = asList(children).map((child, index) => {
      const { id, spec } = normalize(child, index);
      const instance = create(spec);
      el.appendChild(instance.el);
      instance.on('change', (data) => {
        const open = Boolean(data && data.open);
        if (open && !multiple()) closeOthers(id);
        ctx.emit('change', { id, open, openIds: openIds() });
      });
      return { id, instance };
    });
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-accordion', props.multiple && 'z-accordion--multiple', props.plain && 'z-accordion--plain'));
    if (props.children !== source) {
      source = props.children;
      build(props.children);
    }
  };
  update(ctx.props);

  const setOpen = (id, next) => {
    const entry = find(id);
    if (!entry) return false;
    if (isOpen(entry) === next) return false;
    if (next && !multiple()) closeOthers(entry.id);
    entry.instance.set({ open: next });
    ctx.emit('change', { id: entry.id, open: next, openIds: openIds() });
    return true;
  };

  return {
    el,
    update,
    destroy: destroyEntries,
    api: {
      /**
       * Abre el panel con ese id y, salvo `multiple`, cierra los demas.
       * @param {string|number} id
       * @returns {boolean} `false` si el id no existe o ya estaba abierto
       */
      open(id) {
        return setOpen(id, true);
      },
      /**
       * @param {string|number} id
       * @returns {boolean}
       */
      close(id) {
        return setOpen(id, false);
      },
      /**
       * @param {string|number} id
       * @returns {boolean}
       */
      toggle(id) {
        const entry = find(id);
        if (!entry) return false;
        return setOpen(id, !isOpen(entry));
      },
      /**
       * @param {string|number} id
       * @returns {boolean}
       */
      isOpen(id) {
        const entry = find(id);
        return Boolean(entry && isOpen(entry));
      },
      /** @returns {string[]} */
      get openIds() {
        return openIds();
      },
    },
  };
});

// --- headerlayout ----------------------------------------------------

define('headerlayout', (ctx) => {
  const titleEl = ctx.h('h1', { class: 'z-headerlayout__title' });
  const actions = ctx.h('div', { class: 'z-headerlayout__actions' });
  const header = ctx.h('header', { class: 'z-headerlayout__header' }, [titleEl, actions]);
  const body = ctx.h('div', { class: 'z-headerlayout__body' });
  const el = ctx.h('section', { class: 'z-headerlayout' }, [header, body]);
  let layout = null;

  const childrenOf = (props) => (props.children !== undefined ? props.children : props.body);

  const update = (props) => {
    el.setAttribute(
      'class',
      cls(
        'z-headerlayout',
        props.plain && 'z-headerlayout--plain',
        props.sticky && 'z-headerlayout--sticky'
      )
    );
    titleEl.textContent = asText(props.title);
    if (props.title) titleEl.removeAttribute('hidden');
    else titleEl.setAttribute('hidden', '');
    ctx.content(actions, props.actions);
    if (props.actions === undefined) actions.setAttribute('hidden', '');
    else actions.removeAttribute('hidden');

    if (!layout) {
      layout = create({ kind: 'layout', orientation: props.orientation, children: childrenOf(props) });
      ctx.content(body, layout);
    }
    layout.set({ orientation: props.orientation, children: childrenOf(props) });
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {any} la instancia de layout del cuerpo */
      get layout() {
        return layout;
      },
      /** @returns {'horizontal'|'vertical'} */
      get orientation() {
        return layout ? layout.orientation : 'vertical';
      },
    },
  };
});

// --- posicionamiento -------------------------------------------------

/**
 * Valor de longitud: los numeros se interpretan como pixeles y los strings se
 * respetan tal cual (`%`, `rem`, `auto`). Devuelve `null` si no hay valor.
 * @param {unknown} value
 * @returns {string|null}
 */
function lengthValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? `${value}px` : null;
  const text = String(value).trim();
  if (text === '') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return `${text}px`;
  return text;
}

/**
 * Pista de grilla: `*` es una fraccion, `2*` dos fracciones y un numero son
 * pixeles. `auto`, `1fr` o `20%` pasan sin cambios.
 * @param {unknown} value
 * @returns {string|null}
 */
function trackValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? `${value}px` : null;
  const text = String(value).trim();
  if (text === '') return null;
  const star = text.match(/^(\d+(?:\.\d+)?)\s*\*$/);
  if (star) return `${star[1]}fr`;
  if (text === '*') return '1fr';
  if (/^\d+(?:\.\d+)?$/.test(text)) return `${text}px`;
  return text;
}

/**
 * @param {unknown} list
 * @returns {string} plantilla de pistas para `grid-template-*`
 */
function trackList(list) {
  if (list === undefined || list === null) return '';
  return (Array.isArray(list) ? list : [list]).map(trackValue).filter(Boolean).join(' ');
}

/**
 * Escribe una variable CSS en el elemento. La geometria variable (tamanos,
 * coordenadas) viaja como custom property y las reglas viven en `zorzal.css`.
 * @param {Element} el
 * @param {string} name
 * @param {string} value
 */
function setVar(el, name, value) {
  const style = el && el.style;
  if (!style) return;
  if (typeof style.setProperty === 'function') style.setProperty(name, String(value));
  else style[name] = String(value);
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
 * Crea la instancia de un hijo de posicionamiento y devuelve el nodo que
 * corresponde montar. Los textos sueltos se agregan como nodo de texto.
 * @param {any} ctx
 * @param {any} child
 * @returns {{ instance: any, node: Node|null }}
 */
function childNode(ctx, child) {
  if (child instanceof Widget) return { instance: child, node: child.el };
  if (child && typeof child === 'object' && typeof child.kind === 'string') {
    const instance = create(child);
    return { instance, node: instance.el };
  }
  if (child === undefined || child === null || child === false) return { instance: null, node: null };
  if (typeof child === 'object' && typeof child.nodeType === 'number') return { instance: null, node: child };
  return { instance: null, node: ctx.doc().createTextNode(String(child)) };
}

define('gridlayout', (ctx) => {
  const el = ctx.h('div', { class: 'z-gridlayout' });
  let cells = [];
  let source;

  const destroyCells = () => {
    for (const cell of cells) if (cell.instance) cell.instance.destroy();
    cells = [];
  };

  const build = (children) => {
    destroyCells();
    while (el.firstChild) el.removeChild(el.firstChild);
    cells = asList(children).map((child) => {
      const cell = ctx.h('div', { class: 'z-gridlayout__cell' });
      const { instance, node } = childNode(ctx, child);
      if (node) cell.appendChild(node);
      el.appendChild(cell);
      return { cell, instance };
    });
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-gridlayout', props.plain && 'z-gridlayout--plain'));
    setVar(el, '--z-grid-columns', trackList(props.columns) || '1fr');
    setVar(el, '--z-grid-rows', trackList(props.rows) || 'auto');
    if (props.children !== source) {
      source = props.children;
      build(props.children);
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: destroyCells,
    api: {
      /** @returns {number} */
      get cellCount() {
        return cells.length;
      },
      /** @returns {string} plantilla de columnas resuelta */
      get columns() {
        return trackList(ctx.props.columns) || '1fr';
      },
      /** @returns {string} plantilla de filas resuelta */
      get rows() {
        return trackList(ctx.props.rows) || 'auto';
      },
    },
  };
});

const POSITION_KEYS = ['top', 'left', 'width', 'height'];
const POSITION_VARS = {
  top: '--z-abs-top',
  left: '--z-abs-left',
  width: '--z-abs-width',
  height: '--z-abs-height',
};

/**
 * Coordenadas declaradas por un hijo de abslayout, tomadas del spec o de las
 * props de la instancia.
 * @param {any} child
 * @returns {Record<string, unknown>}
 */
function placementOf(child) {
  const props = child instanceof Widget ? child.props : child;
  const out = {};
  if (!props || typeof props !== 'object') return out;
  for (const key of POSITION_KEYS) {
    if (props[key] !== undefined && props[key] !== null) out[key] = props[key];
  }
  return out;
}

define('abslayout', (ctx) => {
  const el = ctx.h('div', { class: 'z-abslayout' });
  let items = [];
  let source;

  const destroyItems = () => {
    for (const item of items) if (item.instance) item.instance.destroy();
    items = [];
  };

  const paint = (box, place) => {
    for (const key of POSITION_KEYS) {
      const value = lengthValue(place[key]);
      if (value === null) removeVar(box, POSITION_VARS[key]);
      else setVar(box, POSITION_VARS[key], value);
    }
  };

  const build = (children) => {
    destroyItems();
    while (el.firstChild) el.removeChild(el.firstChild);
    items = asList(children).map((child) => {
      const box = ctx.h('div', { class: 'z-abslayout__item' });
      const place = placementOf(child);
      paint(box, place);
      const { instance, node } = childNode(ctx, child);
      if (node) box.appendChild(node);
      el.appendChild(box);
      return { box, instance, place };
    });
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-abslayout', props.plain && 'z-abslayout--plain'));
    if (props.children !== source) {
      source = props.children;
      build(props.children);
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: destroyItems,
    api: {
      /** @returns {number} */
      get itemCount() {
        return items.length;
      },
      /** @returns {Record<string, unknown>[]} coordenadas vigentes por hijo */
      get positions() {
        return items.map((item) => ({ ...item.place }));
      },
    },
  };
});

const ALIGN_VALUES = new Set(['start', 'center', 'end', 'stretch']);

/** @param {unknown} value @param {string} fallback */
function alignValue(value, fallback) {
  const text = value === undefined || value === null ? '' : String(value);
  return ALIGN_VALUES.has(text) ? text : fallback;
}

define('align', (ctx) => {
  const content = ctx.h('div', { class: 'z-align__content' });
  const el = ctx.h('div', { class: 'z-align' }, [content]);

  const update = (props) => {
    const horizontal = alignValue(props.align, 'center');
    const vertical = alignValue(props.valign, 'center');
    el.setAttribute(
      'class',
      cls(
        'z-align',
        `z-align--x-${horizontal}`,
        `z-align--y-${vertical}`,
        props.plain && 'z-align--plain'
      )
    );
    ctx.content(content, props.children !== undefined ? props.children : props.child);
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {{ align: string, valign: string }} */
      get alignment() {
        return {
          align: alignValue(ctx.props.align, 'center'),
          valign: alignValue(ctx.props.valign, 'center'),
        };
      },
    },
  };
});

/** Props de proxy que no se delegan al widget envuelto. */
const PROXY_KEYS = new Set(['target', 'children', 'config', 'class', 'kind']);

define('proxy', (ctx) => {
  const el = ctx.h('div', { class: 'z-proxy' });
  let inner = null;
  let source;

  const delegate = (props) => {
    const out = {};
    if (props.config && typeof props.config === 'object') Object.assign(out, props.config);
    for (const [key, value] of Object.entries(props)) {
      if (!PROXY_KEYS.has(key)) out[key] = value;
    }
    return out;
  };

  const build = (target) => {
    if (inner) {
      inner.destroy();
      inner = null;
    }
    while (el.firstChild) el.removeChild(el.firstChild);
    if (target === undefined || target === null || target === false) return;
    inner = create(target);
    const base = inner.emit.bind(inner);
    inner.emit = (type, data) => {
      const result = base(type, data);
      if (type !== 'destroy') ctx.emit(type, data);
      return result;
    };
    el.appendChild(inner.el);
  };

  const update = (props) => {
    el.setAttribute('class', 'z-proxy');
    const target = props.target !== undefined ? props.target : props.children;
    if (target !== source) {
      source = target;
      build(target);
    }
    if (inner) inner.set(delegate(props));
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy() {
      if (inner) {
        inner.destroy();
        inner = null;
      }
    },
    api: {
      /** @returns {any} instancia envuelta, o `null` */
      get widget() {
        return inner;
      },
      /** @returns {string|null} tipo del widget envuelto */
      get targetKind() {
        return inner ? inner.kind : null;
      },
    },
  };
});

define('spacer', (ctx) => {
  const el = ctx.h('div', { class: 'z-spacer', 'aria-hidden': 'true' });

  const update = (props) => {
    const axis =
      props.axis === 'horizontal' || props.axis === 'vertical' ? props.axis : 'both';
    el.setAttribute('class', cls('z-spacer', `z-spacer--${axis}`, props.flex && 'z-spacer--flex'));
    const size = lengthValue(props.size);
    if (size === null) removeVar(el, '--z-spacer-size');
    else setVar(el, '--z-spacer-size', size);
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string|null} tamano resuelto (`16px`, `50%`, ...) */
      get size() {
        return lengthValue(ctx.props.size);
      },
      /** @returns {'both'|'horizontal'|'vertical'} */
      get axis() {
        return ctx.props.axis === 'horizontal' || ctx.props.axis === 'vertical'
          ? ctx.props.axis
          : 'both';
      },
    },
  };
});

define('resizer', (ctx) => {
  const before = ctx.h('div', { class: 'z-resizer__pane' });
  const handle = ctx.h('div', {
    class: 'z-resizer__handle',
    role: 'separator',
    tabindex: '0',
  });
  const after = ctx.h('div', { class: 'z-resizer__pane' });
  const el = ctx.h('div', { class: 'z-resizer' }, [before, handle, after]);

  let current = null;
  let drag = null;

  const isVertical = () => ctx.props.orientation === 'vertical';

  const bounds = () => {
    const min = Number(ctx.props.min);
    const max = Number(ctx.props.max);
    return {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : Infinity,
    };
  };

  const clamp = (px) => {
    const value = Number(px);
    if (!Number.isFinite(value)) return null;
    const { min, max } = bounds();
    return Math.min(Math.max(value, min), max);
  };

  const apply = (size) => {
    current = size;
    if (size === null) {
      removeVar(el, '--z-resizer-size');
      el.classList.remove('z-resizer--sized');
    } else {
      setVar(el, '--z-resizer-size', `${size}px`);
      el.classList.add('z-resizer--sized');
    }
    if (size === null) handle.removeAttribute('aria-valuenow');
    else handle.setAttribute('aria-valuenow', String(size));
  };

  const resize = (px, reason = 'api') => {
    const next = clamp(px);
    if (next === null || next === current) return current;
    apply(next);
    ctx.props.size = next;
    ctx.emit('resize', { size: next, orientation: isVertical() ? 'vertical' : 'horizontal', reason });
    return next;
  };

  const axisPoint = (event) => {
    if (!event) return null;
    const value = isVertical() ? event.clientY : event.clientX;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  };

  const onMove = (event) => {
    if (!drag) return;
    const point = axisPoint(event);
    if (point === null) return;
    resize(drag.start + (point - drag.origin), 'drag');
  };

  const stopDrag = () => {
    if (!drag) return;
    drag = null;
    ctx.release(ctx.doc(), 'pointermove', onMove);
    ctx.release(ctx.doc(), 'pointerup', stopDrag);
    ctx.release(ctx.doc(), 'pointercancel', stopDrag);
    el.classList.remove('z-resizer--dragging');
    ctx.emit('resizeend', {
      size: current,
      orientation: isVertical() ? 'vertical' : 'horizontal',
    });
  };

  const update = (props) => {
    const vertical = isVertical();
    el.setAttribute(
      'class',
      cls(
        'z-resizer',
        vertical ? 'z-resizer--vertical' : 'z-resizer--horizontal',
        props.disabled && 'z-resizer--disabled'
      )
    );
    handle.setAttribute('aria-orientation', vertical ? 'horizontal' : 'vertical');
    const list = asList(props.children !== undefined ? props.children : [props.before, props.after]);
    ctx.content(before, list[0]);
    ctx.content(after, list[1]);

    if (props.size !== undefined) {
      const declared = clamp(props.size);
      if (declared !== null && declared !== current) {
        apply(declared);
        ctx.props.size = declared;
      }
    }
    if (current !== null) el.classList.add('z-resizer--sized');
  };
  update(ctx.props);

  ctx.on(handle, 'pointerdown', (event) => {
    if (ctx.props.disabled) return;
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const point = axisPoint(event);
    drag = { origin: point === null ? 0 : point, start: current === null ? 0 : current };
    el.classList.add('z-resizer--dragging');
    ctx.on(ctx.doc(), 'pointermove', onMove);
    ctx.on(ctx.doc(), 'pointerup', stopDrag);
    ctx.on(ctx.doc(), 'pointercancel', stopDrag);
  });

  ctx.on(handle, 'keydown', (event) => {
    if (!event || ctx.props.disabled) return;
    const step = Number.isFinite(Number(ctx.props.step)) ? Number(ctx.props.step) : 16;
    const vertical = isVertical();
    const grow = vertical ? 'ArrowDown' : 'ArrowRight';
    const shrink = vertical ? 'ArrowUp' : 'ArrowLeft';
    const base = current === null ? 0 : current;
    let next = null;
    if (event.key === grow) next = base + step;
    else if (event.key === shrink) next = base - step;
    else return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    resize(next, 'keyboard');
  });

  return {
    el,
    update,
    destroy() {
      drag = null;
    },
    api: {
      /**
       * Ajusta el tamano del primer panel, acotado por `min` y `max`.
       * Emite `resize` si el valor cambia.
       * @param {number} px
       * @returns {number|null} tamano aplicado
       */
      resize(px) {
        return resize(px, 'api');
      },
      /** @returns {number|null} */
      get size() {
        return current;
      },
      /** @returns {'horizontal'|'vertical'} */
      get orientation() {
        return isVertical() ? 'vertical' : 'horizontal';
      },
    },
  };
});
