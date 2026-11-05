/**
 * Shim de compatibilidad Webix sobre Zorzal para Halcon.
 *
 * Carga la capa declarativa vendorizada de Zorzal
 * (`sdk/vendor/zorzal/src/compat/webix.js`) y publica `window.webix` y
 * `window.$$` con la forma que esperan las pantallas heredadas:
 *
 *   webix.ui({ view: 'layout', rows: [...] })
 *   webix.$$('listaPersonas')
 *
 * No hay build ni dependencias: el shim es un modulo ES que se importa desde
 * la pagina y registra el namespace global como efecto de modulo.
 *
 * Diferencias con Webix 7 (ver sdk/compat/README.md):
 *  - `$$` devuelve la instancia de Zorzal (o una referencia al boton de la
 *    toolbar), no una vista Webix completa.
 *  - `list` con `template` se monta como `unitlist` de Zorzal.
 *  - No hay `toExcel` ni plugins propios del SDK de Webix.
 *
 * Extensiones para portar plugins propios (`sdk/compat/plugins/`):
 *  - `protoUI(config, base)`: registra un kind con la forma de Webix. Acepta
 *    `$init`, `$ready`, `defaults`, metodos sueltos y `<clave>_setter`. El base
 *    puede ser un nombre de kind o un marcador como `webix.ui.toolbar`.
 *  - Las instancias creadas asi exponen `config`, `$view` y `callEvent`.
 *  - `isDefined(kind)` consulta el registro de kinds.
 *  - `view: 'datatable'` se traduce al kind `datatable` de Zorzal.
 */

import compatWebix, { ui as compatUi } from '../vendor/zorzal/src/compat/webix.js';
import { define, getFactory, has } from '../vendor/zorzal/src/core/registry.js';
import { STROKE_WIDTH, VIEW_BOX, getIcon } from '../vendor/zorzal/src/services/icons.js';
import { paintIcon, renderIcon, resolveIconName } from './icons.js';

const CHILD_KEYS = ['rows', 'cols', 'elements', 'items', 'fields', 'children', 'group', 'body', 'footer'];

/** Namespace de los nodos SVG. */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Kind propio que dibuja el icono como `svg` donde Zorzal espera texto. */
const ICON_KIND = 'hc-icon';

/** Marcadores que un template de lista puede usar para el icono. */
const ICON_PLACEHOLDER = /#icon#|\{\{\s*icon\s*\}\}/;

/**
 * @param {unknown} value
 * @returns {string}
 */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isCell(value) {
  if (value === undefined || value === null || value === false) return false;
  const type = typeof value;
  return type === 'string' || type === 'number' || type === 'object';
}

/**
 * Convierte marcadores Webix (`#clave#`) al formato de Zorzal (`{{ clave }}`).
 * @param {string} source
 * @returns {string}
 */
function toZorzalTemplate(source) {
  return String(source).replace(/#([\w.$-]+)#/g, (_, key) => `{{ ${key} }}`);
}

/**
 * Convierte una plantilla con `#icon#` en una funcion de plantilla que Zorzal
 * monta elemento por elemento. El resto de los marcadores se interpola como
 * texto y el icono se renderiza como `svg`, no como texto.
 *
 * @param {string} source
 * @returns {(scope: Record<string, unknown>) => (string|Node)[]}
 */
function iconUnitTemplate(source) {
  const chunks = String(source).split(/#icon#|\{\{\s*icon\s*\}\}/);
  return (scope) => {
    const out = [];
    const doc = typeof globalThis === 'undefined' ? null : globalThis.document;
    chunks.forEach((chunk, index) => {
      if (index > 0) {
        if (doc) out.push(renderIcon(scope.icon, { doc }));
        else out.push(resolveIconName(scope.icon));
      }
      const text = chunk
        .replace(/#([\w.$-]+)#/g, (_, key) => asText(scope[key]))
        .replace(/\{\{\s*([\w.$-]+)\s*\}\}/g, (_, key) => asText(scope[key]));
      if (text !== '') out.push(text);
    });
    return out;
  };
}

/**
 * Dibuja los iconos como `svg` en los spans de texto que generan los widgets
 * de Zorzal (`z-toolbar__icon`, `z-sidebar__icon`). El widget guarda el nombre
 * original en `data-hc-icon` para poder repintar sin perderlo.
 *
 * @param {Element|null} root
 */
function paintIconSpans(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const spans = root.querySelectorAll('.z-toolbar__icon, .z-sidebar__icon');
  for (const span of spans) {
    if (span.querySelector('svg')) continue;
    const source = span.getAttribute('data-hc-icon') || span.textContent.trim();
    if (source === '' || source.startsWith('[object')) continue;
    span.setAttribute('data-hc-icon', source);
    paintIcon(span, source);
  }
}

/**
 * Normaliza la fuente de datos de una lista a un array.
 * @param {unknown} source
 * @returns {unknown[]}
 */
function toDataArray(source) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === 'object') {
    return Object.entries(source).map(([key, value]) =>
      value && typeof value === 'object' ? { id: key, ...value } : { id: key, value }
    );
  }
  return [];
}

/**
 * Convierte `{ view: 'list', template }` en un `unitlist` de Zorzal, que es el
 * widget que acepta plantilla por elemento dentro de una lista.
 * @param {Record<string, any>} spec
 * @returns {Record<string, any>}
 */
function listWithTemplate(spec) {
  const source = spec.data !== undefined ? spec.data : spec.options !== undefined ? spec.options : spec.items;
  const result = { ...spec, kind: 'unitlist', plain: Boolean(spec.plain), data: toDataArray(source) };
  delete result.view;
  delete result.items;
  delete result.options;
  delete result.select;
  if (spec.selected !== undefined) result.selected = spec.selected;
  else if (spec.select !== undefined && spec.select !== true) result.selected = spec.select;
  if (typeof spec.template === 'string') {
    result.template = ICON_PLACEHOLDER.test(spec.template)
      ? iconUnitTemplate(spec.template)
      : toZorzalTemplate(spec.template);
  }
  return result;
}

/**
 * Columnas de una tabla Webix en la forma que lee el `datatable` de Zorzal:
 * `{ id, header, width, align }`. Una `header` en array se une con espacios.
 * @param {unknown} columns
 * @returns {Record<string, unknown>[]}
 */
function toTableColumns(columns) {
  if (!Array.isArray(columns)) return [];
  const out = [];
  for (const column of columns) {
    if (!column || typeof column !== 'object' || column.id === undefined) continue;
    const entry = { id: String(column.id) };
    if (Array.isArray(column.header)) {
      entry.header = column.header
        .map((item) => (item && typeof item === 'object' ? item.text || item.content || '' : item === undefined ? '' : String(item)))
        .join(' ')
        .trim();
    } else if (column.header !== undefined && column.header !== null) {
      entry.header = String(column.header);
    }
    if (column.width !== undefined && column.width !== null) entry.width = column.width;
    if (typeof column.align === 'string') entry.align = column.align;
    out.push(entry);
  }
  return out;
}

/**
 * Convierte `{ view: 'datatable', columns, data }` en el `datatable` de Zorzal.
 * Las plantillas por columna y el `footer` no se emulan: la celda muestra el
 * valor crudo de la clave de la columna.
 * @param {Record<string, any>} spec
 * @returns {Record<string, any>}
 */
function datatableView(spec) {
  const source = spec.data !== undefined ? spec.data : spec.json;
  const result = {
    kind: 'datatable',
    columns: toTableColumns(spec.columns),
    data: toDataArray(source),
  };
  if (spec.id !== undefined && spec.id !== null && spec.id !== '') result.id = spec.id;
  if (spec.on && typeof spec.on === 'object') result.on = spec.on;
  if (spec.plain) result.plain = true;
  if (spec.compact) result.compact = true;
  if (spec.selected !== undefined) result.selected = spec.selected;
  else if (spec.select !== undefined && spec.select !== true) result.selected = spec.select;
  return result;
}

/** Vistas que traduce la capa de Zorzal; el resto puede ser un kind propio. */
const TRANSLATED_VIEWS = new Set(['layout', 'toolbar', 'button', 'text', 'label', 'list', 'form', 'template', 'window', 'datatable']);

/**
 * Copia el arbol declarativo aplicando los ajustes que necesita el shim.
 * No muta el spec original: las funciones de los handlers se conservan.
 *
 * @param {any} node
 * @param {boolean} [inToolbar] el nodo cuelga de una toolbar, que renderiza el
 *   icono como texto y no como widget.
 * @returns {any}
 */
function normalize(node, inToolbar = false) {
  if (Array.isArray(node)) return node.map((item) => normalize(item, inToolbar));
  if (!node || typeof node !== 'object') return node;
  if (typeof node.kind === 'string') return node;

  const out = { ...node };
  const childInToolbar = inToolbar || node.view === 'toolbar';
  for (const key of CHILD_KEYS) {
    if (Array.isArray(node[key]) || (node[key] && typeof node[key] === 'object')) {
      out[key] = normalize(node[key], childInToolbar);
    }
  }
  // Los botones con icono de texto se montan con el kind `hc-icon`, que dibuja
  // el `svg` del set de Zorzal. Los items de una toolbar quedan afuera: ese
  // widget pinta el icono como texto y el shim lo convierte a `svg` al montar
  // (ver `paintIconSpans`).
  if (!inToolbar && out.view === 'button' && typeof out.icon === 'string' && out.icon.trim() !== '') {
    out.icon = { kind: ICON_KIND, icon: resolveIconName(out.icon) };
  }
  if (node.view === 'list' && node.template !== undefined) return listWithTemplate(out);
  if (node.view === 'datatable') return datatableView(out);
  if (typeof node.view === 'string' && !TRANSLATED_VIEWS.has(node.view) && has(node.view)) {
    const plugin = { ...out, kind: node.view };
    delete plugin.view;
    return plugin;
  }
  return out;
}

/**
 * Lista de hijos declarada en `raw`, en el orden en que la traduce Zorzal.
 * @param {Record<string, any>} raw
 * @param {string[]} keys
 * @returns {any[]|null}
 */
function childList(raw, keys) {
  for (const key of keys) {
    if (Array.isArray(raw[key])) return raw[key].filter(isCell);
  }
  return null;
}

/**
 * @param {any[]|null} rawList
 * @param {any[]|null} targetList
 */
function pairIds(rawList, targetList) {
  if (!Array.isArray(rawList) || !Array.isArray(targetList)) return;
  const count = Math.min(rawList.length, targetList.length);
  for (let index = 0; index < count; index += 1) applyId(rawList[index], targetList[index]);
}

/**
 * Propaga los `id` declarados al arbol traducido, para que cada widget los
 * conserve en `props.id` y el registro de `$$` pueda encontrarlo.
 *
 * @param {any} raw
 * @param {any} target
 */
function applyId(raw, target) {
  if (!raw || typeof raw !== 'object' || !target || typeof target !== 'object') return;
  if (raw.id !== undefined && raw.id !== null && raw.id !== '') target.id = raw.id;
  if (raw.on && typeof raw.on === 'object' && target.on === undefined) target.on = raw.on;

  if (Array.isArray(target.children)) {
    pairIds(childList(raw, ['rows', 'cols', 'children']), target.children);
    return;
  }
  if (Array.isArray(target.fields)) {
    pairIds(childList(raw, ['elements', 'rows', 'fields']), target.fields);
    return;
  }
  if (Array.isArray(target.items)) {
    const entries = childList(raw, ['elements', 'items', 'cols']);
    pairIds(entries, target.items);
    if (entries) {
      entries.forEach((entry, index) => {
        const translated = target.items[index];
        if (!translated || !Array.isArray(translated.group)) return;
        const nested = entry && (Array.isArray(entry.group) ? entry.group : entry.items);
        if (Array.isArray(nested)) pairIds(nested.filter(isCell), translated.group);
      });
    }
  }
}

// --- iconos ----------------------------------------------------------

/**
 * Kind propio `hc-icon`: dibuja el icono como `svg` de 24x24 con los paths del
 * servicio de iconos de Zorzal.
 *
 * Existe porque el widget `button` de Zorzal envuelve el icono en un host y
 * arma el `svg` con este kind cuando recibe un spec, y porque el shim necesita
 * un nodo que se pueda repintar cuando cambia `icon`. La forma del `svg` es la
 * misma que la del widget `icon` de Zorzal para que los pilotos y la app se vean
 * igual.
 */
define(ICON_KIND, (ctx) => {
  const doc = ctx.doc();
  const el =
    doc && typeof doc.createElementNS === 'function'
      ? doc.createElementNS(SVG_NS, 'svg')
      : ctx.h('svg', { class: 'hc-icon' });

  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', String(STROKE_WIDTH));
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('focusable', 'false');

  /**
   * @param {Record<string, any>} props
   */
  const update = (props) => {
    const iconName = resolveIconName(props.icon);
    el.setAttribute('class', `hc-icon hc-icon--${iconName}`);
    el.setAttribute('viewBox', VIEW_BOX);
    el.setAttribute('width', '1em');
    el.setAttribute('height', '1em');
    el.setAttribute('role', 'presentation');
    el.setAttribute('aria-hidden', 'true');
    const title = asText(props.title);
    if (title !== '') el.setAttribute('title', title);
    else el.removeAttribute('title');

    while (el.firstChild) el.removeChild(el.firstChild);
    for (const shape of getIcon(iconName)) {
      const path =
        doc && typeof doc.createElementNS === 'function' ? doc.createElementNS(SVG_NS, 'path') : ctx.h('path', {});
      path.setAttribute('d', shape.d);
      el.appendChild(path);
    }
  };

  update(ctx.props);
  return { el, update };
});

// --- plugins propios: protoUI con la forma de Webix -------------------

/** Claves que solo existen en la config Webix y no son props de Zorzal. */
const WEBVIEW_KEYS = ['view', 'rows', 'cols', 'elements', 'fields', 'children', 'items', 'options', 'body', 'footer', 'group'];

/** Kinds de Zorzal que se pueden usar como base de un `protoUI` propio. */
const BASE_MARKERS = [
  'toolbar',
  'layout',
  'list',
  'unitlist',
  'datatable',
  'form',
  'button',
  'text',
  'label',
  'template',
  'window',
  'contextmenu',
];

/**
 * Nombre del kind base. Acepta un nombre o un marcador como
 * `webix.ui.toolbar`, que es la forma que usan los plugins heredados.
 * @param {unknown} base
 * @returns {string}
 */
function resolveBaseKind(base) {
  if (typeof base === 'string' && base !== '') return base;
  if (typeof base === 'function' && typeof base.__kind === 'string') return base.__kind;
  throw new TypeError('webix.protoUI: falta el kind base (nombre o webix.ui.<kind>)');
}

/**
 * Agrega a una instancia de Zorzal lo que el codigo heredado espera de una
 * vista Webix: `config`, `$view` y `callEvent`.
 *
 * `callEvent(type, params)` emite `type`; si `params` trae un solo valor lo
 * emite suelto y si trae varios emite el array.
 *
 * @param {any} instance
 */
function defineCompatAccessors(instance) {
  if (!Object.prototype.hasOwnProperty.call(instance, '$view')) {
    Object.defineProperty(instance, '$view', {
      configurable: true,
      get: () => instance.el,
    });
  }
  if (!Object.prototype.hasOwnProperty.call(instance, 'config')) {
    Object.defineProperty(instance, 'config', {
      configurable: true,
      get: () => instance.props,
    });
  }
  if (typeof instance.callEvent !== 'function') {
    Object.defineProperty(instance, 'callEvent', {
      configurable: true,
      writable: true,
      value: function callEvent(type, params) {
        const list = Array.isArray(params) ? params : params === undefined ? [] : [params];
        instance.emit(type, list.length === 1 ? list[0] : list);
        return true;
      },
    });
  }
}

/**
 * Registra un kind con la forma de Webix a partir de otro kind de Zorzal.
 *
 * Acepta `name`, `defaults`, `methods`, `$init(config)` y funciones sueltas.
 * `$init` corre antes de construir la vista base, igual que en Webix, con
 * `this` apuntando a la instancia. Los `<clave>_setter` se ejecutan antes de
 * `$init`. Las funciones que el plugin empuja a `this.$ready` corren despues
 * del montaje, en una microtarea.
 *
 * La config Webix (`view`, `rows`, `elements`, `items`, ...) se traduce con la
 * misma capa que `ui()`, y los `id` declarados se propagan al arbol traducido.
 *
 * @param {Record<string, any>} config
 * @param {string|Function} base
 * @returns {Function} la factory registrada
 */
export function protoUI(config = {}, base) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('webix.protoUI: la config debe ser un objeto');
  }
  const { name, defaults = {}, methods: declared = {}, $init, $ready: declaredReady, ...rest } = config;
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('webix.protoUI: falta "name" en la config');
  }
  const baseKind = resolveBaseKind(base);
  const baseFactory = getFactory(baseKind);
  if (!baseFactory) {
    throw new Error(`webix.protoUI("${name}"): kind base desconocido "${baseKind}"`);
  }

  const methods = { ...(declared && typeof declared === 'object' ? declared : {}) };
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value === 'function') methods[key] = value;
  }

  return define(name, (ctx) => {
    const instance = ctx.instance;
    const props = instance.props;

    for (const [key, value] of Object.entries(defaults || {})) {
      if (props[key] === undefined) props[key] = value;
    }

    for (const [key, fn] of Object.entries(methods)) {
      Object.defineProperty(instance, key, {
        configurable: true,
        writable: true,
        value: function (...args) {
          return fn.apply(instance, args);
        },
      });
    }
    defineCompatAccessors(instance);
    instance.$ready = Array.isArray(declaredReady) ? declaredReady.slice() : [];

    for (const [key, value] of Object.entries(props)) {
      const setter = methods[`${key}_setter`];
      if (typeof setter === 'function') setter.call(instance, value);
    }

    if (typeof $init === 'function') $init.call(instance, props);

    // El kind propio ya no trae `view` (el shim lo convirtio en `kind` al
    // montarlo), asi que se traduce con la vista del kind base para que la
    // capa de Zorzal lea `items`/`children` como corresponde.
    const raw = normalize({ ...props, view: baseKind });
    const translated = compatUi.translate(raw);
    applyId(raw, translated);
    for (const key of WEBVIEW_KEYS) delete props[key];
    for (const [key, value] of Object.entries(translated)) {
      if (key !== 'kind') props[key] = value;
    }

    const baseView = baseFactory(ctx) || {};
    if (baseView.el) paintIconSpans(baseView.el);
    const pending = instance.$ready.slice();
    if (pending.length) {
      queueMicrotask(() => {
        if (instance.destroyed) return;
        for (const fn of pending) {
          try {
            fn.call(instance);
          } catch (error) {
            console.error(`webix.protoUI("${name}"): fallo en $ready`, error);
          }
        }
      });
    }
    return { ...baseView };
  });
}

/**
 * Indica si un kind esta registrado en Zorzal (equivalente a
 * `webix.isDefined` de Webix).
 * @param {unknown} name
 * @returns {boolean}
 */
export function isDefined(name) {
  return typeof name === 'string' && has(name);
}

// --- registro de vistas montadas --------------------------------------

/** @type {{ views: Map<string, any> }[]} */
const mounts = [];

/**
 * Referencia minima para un boton de toolbar, que en Zorzal es un nodo del
 * toolbar y no un widget propio.
 *
 * @param {string} id
 * @param {Element} el
 * @returns {Record<string, any>}
 */
function toolbarView(id, el) {
  const textNode = () => el.querySelector('.z-toolbar__text');
  const entry = () => {
    const rootEl = typeof el.closest === 'function' ? el.closest('.z-toolbar') : null;
    const toolbar = rootEl && rootEl.zorzal;
    const items = toolbar && toolbar.props && Array.isArray(toolbar.props.items) ? toolbar.props.items : null;
    if (!items) return null;
    return items.find((item) => item && item.id !== undefined && String(item.id) === String(id)) || null;
  };
  const paintDisabled = (disabled) => {
    const item = entry();
    if (item) item.disabled = disabled;
    if (disabled) el.setAttribute('disabled', '');
    else el.removeAttribute('disabled');
  };
  return {
    id,
    el,
    getValue() {
      const node = textNode();
      return node ? node.textContent : '';
    },
    setValue(value) {
      const node = textNode();
      const next = value === undefined || value === null ? '' : String(value);
      if (node) node.textContent = next;
      return next;
    },
    /**
     * Aplica `{ disabled }` o `{ text }` sobre el nodo del boton, que en Zorzal
     * es un nodo del toolbar y no un widget con `set()`.
     * @param {Record<string, unknown>} [props]
     * @returns {Record<string, any>}
     */
    set(props = {}) {
      if (!props || typeof props !== 'object') return this;
      if (props.disabled !== undefined) paintDisabled(Boolean(props.disabled));
      if (props.text !== undefined) this.setValue(props.text);
      return this;
    },
    enable() {
      paintDisabled(false);
      return this;
    },
    disable() {
      paintDisabled(true);
      return this;
    },
    click() {
      if (typeof el.click === 'function') el.click();
    },
  };
}

/**
 * Indexa los widgets con `id` dentro del subarbol montado.
 * @param {Element} root
 * @returns {Map<string, any>}
 */
function indexViews(root) {
  const views = new Map();
  if (!root || typeof root.querySelectorAll !== 'function') return views;
  const nodes = [root, ...root.querySelectorAll('*')];
  for (const node of nodes) {
    const widget = node.zorzal;
    if (widget && widget.props && widget.props.id !== undefined && widget.props.id !== null && widget.props.id !== '') {
      views.set(String(widget.props.id), widget);
    }
    if (node.classList && node.classList.contains('z-toolbar__button')) {
      const id = node.getAttribute('data-id');
      if (id && !views.has(id)) views.set(id, toolbarView(id, node));
    }
  }
  return views;
}

/**
 * Busca una vista por id entre lo montado por el shim.
 * @param {string|number} id
 * @returns {any|null}
 */
export function $$(id) {
  if (id === undefined || id === null) return null;
  const key = String(id);
  for (let index = mounts.length - 1; index >= 0; index -= 1) {
    const view = mounts[index].views.get(key);
    if (!view) continue;
    if (view.el && view.el.isConnected === false) continue;
    return view;
  }
  return null;
}

/**
 * Traduce un spec con la forma de Webix a la forma que consume Zorzal, sin
 * montarlo. Lo usan las pantallas que arman contenido para otro widget (por
 * ejemplo el cuerpo de un popup), donde `ui()` no interviene.
 *
 * @param {any} spec
 * @returns {any}
 */
export function normalizeSpec(spec) {
  return normalize(spec);
}

/**
 * Monta un spec declarativo con la forma de Webix.
 *
 * @param {any} spec
 * @param {Element|string} [container]
 * @returns {any} instancia de Zorzal del widget raiz
 */
export function ui(spec, container) {
  if (!spec || typeof spec !== 'object') {
    throw new TypeError('webix.ui: el spec debe ser un objeto');
  }
  const normalized = normalize(spec);
  const translated = compatUi.translate(normalized);
  if (Array.isArray(translated)) pairIds(normalized, translated);
  else applyId(normalized, translated);

  const declared =
    container !== undefined ? container : !Array.isArray(spec) && spec.container !== undefined ? spec.container : undefined;
  const widget = compatUi(translated, declared);
  paintIconSpans(widget.el);
  mounts.push({ views: indexViews(widget.el) });
  return widget;
}

// Marcadores de base para `protoUI`: los plugins heredados pasan
// `webix.ui.toolbar` o `webix.ui.layout` como clase base.
for (const kind of BASE_MARKERS) {
  ui[kind] = Object.assign(function baseView() {}, { __kind: kind });
}
ui.translate = compatUi.translate;

/**
 * Superficie publica: todo lo que expone la capa de Zorzal, mas `ui` y `$$`
 * resueltos por este shim, `protoUI` con la forma de Webix e `isDefined`.
 */
export const webix = {
  ...compatWebix,
  ui,
  $$,
  protoUI,
  isDefined,
};

if (typeof window !== 'undefined') {
  window.webix = webix;
  window.$$ = $$;
}

export default webix;
