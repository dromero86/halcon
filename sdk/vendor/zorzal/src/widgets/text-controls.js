/**
 * Widgets de texto: text, label, icon, search, texthighlight y richtext.
 *
 * Son controles de presentacion y entrada. `text` es un campo de una linea y
 * convive con `field`, que sigue siendo el campo generico del core. `richtext`
 * es un area editable basica: la unica via de entrada de HTML es `setValue()`,
 * que sanea el marcado con una lista de etiquetas permitidas y descarta todos
 * los atributos (incluidos los `on*`).
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { getIcon, resolveIcon } from '../services/icons.js';

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

/** @param {unknown} value @returns {string} */
function asSize(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
  return asText(value);
}

// --- saneado de HTML --------------------------------------------------

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'p', 'br', 'ul', 'ol', 'li', 'div']);
const VOID_TAGS = new Set(['br']);
const BLOCK_TAGS = new Set(['p', 'div', 'ul', 'ol', 'li']);
const BLOCKED_TAGS = /<\s*(script|style|iframe|object|embed|svg|math|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const BLOCKED_SINGLE = /<\s*(script|style|iframe|object|embed|svg|math|template)\b[^>]*\/?>/gi;
const TAG_TOKEN = /<\s*(\/?)\s*([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)\s*(\/?)>/g;

/**
 * Escapa texto suelto sin romper las entidades que ya vienen en el marcado.
 * @param {string} value
 * @returns {string}
 */
function escapeText(value) {
  return String(value)
    .replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]*;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Deja solo las etiquetas permitidas, sin atributos, y escapa el texto.
 * Los bloques ejecutables se descartan con su contenido.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeHtml(value) {
  let html = asText(value);
  if (html === '') return '';
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(BLOCKED_TAGS, '');
  html = html.replace(BLOCKED_SINGLE, '');

  let out = '';
  let last = 0;
  const stack = [];
  TAG_TOKEN.lastIndex = 0;
  let match;
  while ((match = TAG_TOKEN.exec(html))) {
    out += escapeText(html.slice(last, match.index));
    last = TAG_TOKEN.lastIndex;
    const closing = match[1] === '/';
    const name = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue;
    if (closing) {
      const index = stack.lastIndexOf(name);
      if (index < 0) continue;
      while (stack.length > index) out += `</${stack.pop()}>`;
      continue;
    }
    if (VOID_TAGS.has(name)) {
      out += `<${name}>`;
      continue;
    }
    if (match[4] === '/') continue;
    if (BLOCK_TAGS.has(name)) {
      const open = Math.max(stack.lastIndexOf(name), stack.lastIndexOf('p'));
      if (open >= 0) {
        while (stack.length > open) out += `</${stack.pop()}>`;
      }
    }
    stack.push(name);
    out += `<${name}>`;
  }
  out += escapeText(html.slice(last));
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

/**
 * Devuelve el HTML con cada coincidencia de `query` envuelta en `<mark>`.
 * El texto restante se escapa y la busqueda ignora mayusculas.
 *
 * @param {unknown} value
 * @param {unknown} query
 * @returns {string}
 */
export function highlightHtml(value, query) {
  const text = asText(value);
  const needle = asText(query);
  if (needle === '') return escapeText(text);
  const haystack = text.toLowerCase();
  const target = needle.toLowerCase();
  let out = '';
  let index = 0;
  let found = haystack.indexOf(target);
  while (found !== -1) {
    out += escapeText(text.slice(index, found));
    out += `<mark class="z-highlight__mark">${escapeText(text.slice(found, found + needle.length))}</mark>`;
    index = found + needle.length;
    found = haystack.indexOf(target, index);
  }
  out += escapeText(text.slice(index));
  return out;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** @param {string} text @returns {string} */
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, code) => {
    if (code[0] === '#') {
      const num = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : whole;
    }
    return ENTITIES[code] !== undefined ? ENTITIES[code] : whole;
  });
}

/**
 * Reemplaza el contenido de un nodo con el HTML ya saneado. Usa `innerHTML`
 * cuando el entorno lo permite y, si no, interpreta el marcado permitido.
 *
 * @param {Element} host
 * @param {string} html
 * @returns {string}
 */
function writeHtml(host, html) {
  const clean = sanitizeHtml(html);
  try {
    host.innerHTML = clean;
    return clean;
  } catch (error) {
    // El DOM minimo de los tests no permite asignar innerHTML.
  }

  const doc = host.ownerDocument || (typeof host.createElement === 'function' ? host : null);
  while (host.firstChild) host.removeChild(host.firstChild);
  if (!doc) return clean;
  const stack = [{ name: null, node: host }];
  const re = /<\s*(\/?)\s*([a-zA-Z][\w:-]*)[^>]*>/g;
  let last = 0;
  let match;
  while ((match = re.exec(clean))) {
    const current = stack[stack.length - 1].node;
    if (match.index > last) {
      current.appendChild(doc.createTextNode(decodeEntities(clean.slice(last, match.index))));
    }
    last = re.lastIndex;
    const name = match[2].toLowerCase();
    if (match[1] === '/') {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) continue;
    if (VOID_TAGS.has(name)) {
      current.appendChild(doc.createElement(name));
      continue;
    }
    const child = doc.createElement(name);
    current.appendChild(child);
    stack.push({ name, node: child });
  }
  const current = stack[stack.length - 1].node;
  if (last < clean.length) current.appendChild(doc.createTextNode(decodeEntities(clean.slice(last))));
  return clean;
}

// --- text -------------------------------------------------------------

define('text', (ctx) => {
  const label = ctx.h('span', { class: 'z-text__label' });
  const input = ctx.h('input', { class: 'z-text__input', type: 'text' });
  const el = ctx.h('label', { class: 'z-text' }, [label, input]);

  const update = (props) => {
    const labelText = asText(props.label);
    label.textContent = labelText;
    label.setAttribute('class', cls('z-text__label', labelText === '' && 'z-hidden'));
    el.setAttribute(
      'class',
      cls('z-text', props.disabled && 'z-text--disabled', props.readonly && 'z-text--readonly')
    );
    input.setAttribute('placeholder', asText(props.placeholder));
    if (props.name) input.setAttribute('name', asText(props.name));
    else input.removeAttribute('name');
    const maxlength = props.maxlength !== undefined ? props.maxlength : props.maxLength;
    if (maxlength !== undefined && maxlength !== null && maxlength !== '') {
      input.setAttribute('maxlength', asText(maxlength));
    } else {
      input.removeAttribute('maxlength');
    }
    if (props.readonly) input.setAttribute('readonly', '');
    else input.removeAttribute('readonly');
    if (props.disabled) input.setAttribute('disabled', '');
    else input.removeAttribute('disabled');
    input.setAttribute('aria-readonly', props.readonly ? 'true' : 'false');
    const value = asText(props.value);
    if (input.value !== value) input.value = value;
  };
  update(ctx.props);

  ctx.on(input, 'input', () => {
    ctx.props.value = input.value;
  });
  ctx.on(input, 'change', (event) => {
    ctx.props.value = input.value;
    ctx.emit('change', { value: input.value, event });
  });

  return {
    el,
    update,
    api: {
      /** @returns {HTMLInputElement} */
      get input() {
        return input;
      },
      /** @returns {string} */
      getValue() {
        return input.value;
      },
      /**
       * @param {unknown} value
       * @returns {string}
       */
      setValue(value) {
        const next = asText(value);
        ctx.props.value = next;
        if (input.value !== next) input.value = next;
        return input.value;
      },
    },
  };
});

// --- label ------------------------------------------------------------

define('label', (ctx) => {
  const el = ctx.h('label', { class: 'z-label' });

  const update = (props) => {
    el.setAttribute('class', cls('z-label', props.muted && 'z-label--muted'));
    el.textContent = asText(props.text !== undefined ? props.text : props.value);
    if (props.for) el.setAttribute('for', asText(props.for));
    else el.removeAttribute('for');
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      getValue() {
        return el.textContent;
      },
      /**
       * @param {unknown} value
       * @returns {string}
       */
      setValue(value) {
        const next = asText(value);
        ctx.props.text = next;
        if (el.textContent !== next) el.textContent = next;
        return next;
      },
    },
  };
});

// --- icon -------------------------------------------------------------

/*
 * El set de trazos vive en el servicio `icons`; el widget solo arma el SVG
 * con los nodos del documento activo. No hay fuente de iconos ni peticiones
 * de red.
 */

/**
 * Crea un nodo SVG. En el navegador usa el namespace correcto; el DOM minimo
 * de los tests devuelve un elemento comun, suficiente para leer atributos.
 *
 * @param {Document} doc
 * @param {string} name
 * @returns {Element}
 */
function svgNode(doc, name) {
  if (typeof doc.createElementNS === 'function') {
    return doc.createElementNS('http://www.w3.org/2000/svg', name);
  }
  return doc.createElement(name);
}

define('icon', (ctx) => {
  const el = ctx.h('span', { class: 'z-icon' });

  const update = (props) => {
    const iconName = resolveIcon(props.name);
    el.setAttribute('class', cls('z-icon', `z-icon--${iconName}`, props.spin && 'z-icon--spin'));
    if (props.label) {
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', asText(props.label));
      el.setAttribute('aria-hidden', 'false');
    } else {
      el.setAttribute('role', 'presentation');
      el.removeAttribute('aria-label');
      el.setAttribute('aria-hidden', 'true');
    }
    if (props.size !== undefined && props.size !== null && props.size !== '') {
      setVar(el, '--z-icon-size', asSize(props.size));
    } else if (el.style) {
      if (typeof el.style.removeProperty === 'function') el.style.removeProperty('--z-icon-size');
      else delete el.style['--z-icon-size'];
    }
    if (props.color) setVar(el, '--z-icon-color', asText(props.color));
    else if (el.style) {
      if (typeof el.style.removeProperty === 'function') el.style.removeProperty('--z-icon-color');
      else delete el.style['--z-icon-color'];
    }

    while (el.firstChild) el.removeChild(el.firstChild);
    const doc = ctx.doc();
    const svg = svgNode(doc, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('focusable', 'false');
    for (const shape of getIcon(iconName)) {
      const path = svgNode(doc, 'path');
      path.setAttribute('d', shape.d);
      svg.appendChild(path);
    }
    el.appendChild(svg);
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      get name() {
        return resolveIcon(ctx.props.name);
      },
    },
  };
});

// --- search -----------------------------------------------------------

define('search', (ctx) => {
  const input = ctx.h('input', { class: 'z-search__input', type: 'search' });
  const clearButton = ctx.h(
    'button',
    { class: 'z-search__clear', type: 'button', 'aria-label': 'Limpiar' },
    ['\u00d7']
  );
  const el = ctx.h('div', { class: 'z-search', role: 'search' }, [input, clearButton]);

  const update = (props) => {
    el.setAttribute('class', cls('z-search', props.disabled && 'z-search--disabled'));
    input.setAttribute('placeholder', asText(props.placeholder));
    if (props.name) input.setAttribute('name', asText(props.name));
    else input.removeAttribute('name');
    if (props.disabled) input.setAttribute('disabled', '');
    else input.removeAttribute('disabled');
    if (props.readonly) input.setAttribute('readonly', '');
    else input.removeAttribute('readonly');
    const value = asText(props.value);
    if (input.value !== value) input.value = value;
    clearButton.setAttribute('class', cls('z-search__clear', input.value === '' && 'z-search__clear--empty'));
    if (props.disabled) clearButton.setAttribute('disabled', '');
    else clearButton.removeAttribute('disabled');
  };
  update(ctx.props);

  ctx.on(input, 'input', () => {
    ctx.props.value = input.value;
    update(ctx.props);
  });
  ctx.on(input, 'change', (event) => {
    ctx.props.value = input.value;
    update(ctx.props);
    ctx.emit('change', { value: input.value, event });
  });

  const clear = () => {
    if (ctx.props.disabled) return ctx.instance;
    input.value = '';
    ctx.props.value = '';
    update(ctx.props);
    ctx.emit('change', { value: '' });
    return ctx.instance;
  };

  ctx.on(clearButton, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    clear();
  });

  return {
    el,
    update,
    api: {
      /** @returns {HTMLInputElement} */
      get input() {
        return input;
      },
      /** @returns {string} */
      getValue() {
        return input.value;
      },
      /**
       * @param {unknown} value
       * @returns {string}
       */
      setValue(value) {
        const next = asText(value);
        ctx.props.value = next;
        if (input.value !== next) input.value = next;
        update(ctx.props);
        return input.value;
      },
      /** @returns {import('../core/widget.js').Widget} */
      clear() {
        return clear();
      },
    },
  };
});

// --- texthighlight ----------------------------------------------------

define('texthighlight', (ctx) => {
  const el = ctx.h('span', { class: 'z-highlight' });

  const render = () => {
    while (el.firstChild) el.removeChild(el.firstChild);
    const text = asText(ctx.props.text);
    const query = asText(ctx.props.query);
    if (query === '') {
      if (text !== '') el.appendChild(ctx.doc().createTextNode(text));
      return;
    }
    const haystack = text.toLowerCase();
    const target = query.toLowerCase();
    let index = 0;
    let found = haystack.indexOf(target);
    while (found !== -1) {
      if (found > index) el.appendChild(ctx.doc().createTextNode(text.slice(index, found)));
      el.appendChild(ctx.h('mark', { class: 'z-highlight__mark' }, [text.slice(found, found + query.length)]));
      index = found + query.length;
      found = haystack.indexOf(target, index);
    }
    if (index < text.length) el.appendChild(ctx.doc().createTextNode(text.slice(index)));
  };

  const update = () => render();
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      get text() {
        return asText(ctx.props.text);
      },
      /** @returns {string} */
      get query() {
        return asText(ctx.props.query);
      },
      /** @returns {string} */
      getValue() {
        return highlightHtml(ctx.props.text, ctx.props.query);
      },
    },
  };
});

// --- richtext ---------------------------------------------------------

const FORMAT_TAGS = { bold: ['b', 'strong'], italic: ['i', 'em'] };
const EXEC_COMMANDS = { bold: 'bold', italic: 'italic', bullets: 'insertUnorderedList' };

/**
 * @param {Element} root
 * @param {Document} doc
 * @returns {boolean}
 */
function hasSelection(root, doc) {
  if (typeof doc.getSelection !== 'function') return false;
  const selection = doc.getSelection();
  if (!selection || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  return Boolean(node) && root.contains(node);
}

/**
 * Quita el envoltorio completo del contenido, si lo tiene.
 * @param {string} html
 * @param {string[]} tags
 * @returns {string|null}
 */
function unwrapWhole(html, tags) {
  for (const tag of tags) {
    const match = html.match(new RegExp(`^<${tag}>([\\s\\S]*)<\\/${tag}>$`, 'i'));
    if (match) return match[1];
  }
  return null;
}

/**
 * Aplica el formato a todo el contenido cuando no hay seleccion disponible
 * (caso de los entornos sin `getSelection` o del DOM minimo de los tests).
 *
 * @param {string} html
 * @param {string} command
 * @returns {string}
 */
function toggleWhole(html, command) {
  if (command === 'bullets') {
    const inner = unwrapWhole(html, ['ul']);
    if (inner !== null) return unwrapWhole(inner, ['li']) !== null ? unwrapWhole(inner, ['li']) : inner;
    if (html === '') return '<ul><li></li></ul>';
    return `<ul><li>${html}</li></ul>`;
  }
  const tags = FORMAT_TAGS[command];
  if (!tags) return html;
  const block = html.match(/^<(p|div)>([\s\S]*)<\/\1>$/i);
  if (block) {
    const inner = unwrapWhole(block[2], tags);
    const next = inner !== null ? inner : `<${tags[0]}>${block[2]}</${tags[0]}>`;
    return `<${block[1].toLowerCase()}>${next}</${block[1].toLowerCase()}>`;
  }
  const inner = unwrapWhole(html, tags);
  if (inner !== null) return inner;
  if (html === '') return `<${tags[0]}></${tags[0]}>`;
  return `<${tags[0]}>${html}</${tags[0]}>`;
}

define('richtext', (ctx) => {
  const toolbar = ctx.h('div', { class: 'z-richtext__toolbar', role: 'toolbar' });
  const body = ctx.h('div', { class: 'z-richtext__body' });
  const el = ctx.h('div', { class: 'z-richtext' }, [toolbar, body]);
  body.setAttribute('contenteditable', 'true');
  body.setAttribute('role', 'textbox');
  body.setAttribute('aria-multiline', 'true');
  if (ctx.props.label) body.setAttribute('aria-label', asText(ctx.props.label));
  else body.setAttribute('aria-label', 'Editor de texto enriquecido');

  const buttons = [
    { command: 'bold', text: 'B', title: 'Negrita' },
    { command: 'italic', text: 'I', title: 'Cursiva' },
    { command: 'bullets', text: '\u2022', title: 'Lista con vinetas' },
  ].map((item) => {
    const button = ctx.h(
      'button',
      {
        class: cls('z-richtext__button', `z-richtext__button--${item.command}`),
        type: 'button',
        title: item.title,
        'aria-label': item.title,
        'data-command': item.command,
      },
      [item.text]
    );
    toolbar.appendChild(button);
    return button;
  });

  let applied = null;

  const getValue = () => sanitizeHtml(body.innerHTML);

  const setValue = (value) => {
    const clean = writeHtml(body, value);
    applied = clean;
    ctx.props.value = clean;
    return clean;
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-richtext', props.disabled && 'z-richtext--disabled'));
    body.setAttribute('contenteditable', props.disabled ? 'false' : 'true');
    for (const button of buttons) {
      if (props.disabled) button.setAttribute('disabled', '');
      else button.removeAttribute('disabled');
    }
    if (props.value === undefined || props.value === null) {
      if (applied !== '') setValue('');
      return;
    }
    const clean = sanitizeHtml(props.value);
    if (clean === applied) return;
    setValue(clean);
  };

  const sync = () => {
    const value = getValue();
    applied = value;
    ctx.props.value = value;
    ctx.emit('change', { value });
    return value;
  };

  const format = (command) => {
    const doc = ctx.doc();
    if (typeof doc.execCommand === 'function' && hasSelection(body, doc)) {
      try {
        doc.execCommand('styleWithCSS', false, false);
        doc.execCommand(EXEC_COMMANDS[command] || command, false, null);
        sync();
        return ctx.instance;
      } catch (error) {
        // Sin soporte de comandos se aplica el formato sobre todo el contenido.
      }
    }
    const next = toggleWhole(getValue(), command);
    setValue(next);
    sync();
    return ctx.instance;
  };

  ctx.on(body, 'input', () => sync());
  for (const button of buttons) {
    ctx.on(button, 'mousedown', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
    });
    ctx.on(button, 'click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (ctx.props.disabled) return;
      format(button.getAttribute('data-command'));
    });
  }

  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {Element} */
      get body() {
        return body;
      },
      /** @returns {Element} */
      get toolbar() {
        return toolbar;
      },
      /** @returns {string} */
      getValue,
      /**
       * @param {unknown} value
       * @returns {string}
       */
      setValue(value) {
        return setValue(value);
      },
      /**
       * Aplica `bold`, `italic` o `bullets` a la seleccion o, si no hay una,
       * a todo el contenido.
       * @param {string} command
       * @returns {import('../core/widget.js').Widget}
       */
      format(command) {
        return format(asText(command));
      },
    },
  };
});
