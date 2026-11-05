/**
 * Contenido propio: `template`, `iframe`, `video` y `barcode`.
 *
 * Los cuatro siguen el contrato del core: la factory devuelve `{ el, update,
 * api }`, la geometria vive en atributos (`width`, `height`, `viewBox`, `x`,
 * `sandbox`) y los colores en variables CSS con prefijo `z-`. No hay
 * dependencias ni peticiones de red.
 *
 * - `template`: contenedor con plantilla de texto o funcion. `setValue(valor)`
 *   actualiza el contenido sin reemplazar el nodo contenedor.
 * - `iframe`: marco incrustado con `sandbox` restrictivo por omision, `allow`
 *   configurable y evento `load`.
 * - `video`: reproductor HTML5 con controles nativos, sin autoplay por
 *   omision, y eventos `play`, `pause` y `ended`.
 * - `barcode`: Code 128 (juego B) dibujado en SVG con tabla de patrones
 *   propia; el valor va en `value` y la escala en `barWidth` y `height`.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { tpl } from '../services/tpl.js';
import { n2, positive, snode, toNumber } from './chart.js';

/** Tipos que agrega este modulo al registro del core. */
export const MEDIA_WIDGETS = ['template', 'iframe', 'video', 'barcode'];

/** @param {unknown} value @returns {string} */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

// --- template ---------------------------------------------------------

const TEMPLATE_TOKEN = /\{\{\s*([\w.$-]+)\s*\}\}/g;

/**
 * Datos que ve una plantilla de texto: el propio objeto si `value` es un
 * objeto, o `{ value }` en cualquier otro caso.
 *
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function templateScope(value) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value;
  return { value };
}

/**
 * Interpola `{{ clave }}` con los valores crudos. El resultado se coloca como
 * texto, no como HTML, de modo que un valor con etiquetas nunca se interpreta.
 *
 * @param {string} source
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
export function interpolate(source, data = {}) {
  return String(source).replace(TEMPLATE_TOKEN, (_, key) => asText(tpl.lookup(data, key)));
}

define('template', (ctx) => {
  const contentEl = ctx.h('div', { class: 'z-template__content' });
  const el = ctx.h('div', { class: 'z-template' }, [contentEl]);

  /**
   * Coloca el contenido. `ctx.content` reemplaza solo los hijos: el
   * contenedor (`root` y `contentEl`) se conserva entre actualizaciones.
   *
   * @param {any} props
   */
  const render = (props) => {
    const value = props.value;
    const template = props.template;

    if (typeof template === 'function') {
      const out = template(value, props);
      if (out === undefined || out === null || out === false) ctx.content(contentEl, null);
      else ctx.content(contentEl, typeof out === 'boolean' ? String(out) : out);
      return;
    }

    if (typeof template === 'string') {
      ctx.content(contentEl, interpolate(template, templateScope(value)));
      return;
    }

    ctx.content(contentEl, asText(value));
  };

  render(ctx.props);

  return {
    el,
    update: render,
    api: {
      /** @returns {unknown} */
      getValue() {
        return ctx.props.value;
      },
      /**
       * @param {unknown} value
       * @returns {unknown}
       */
      setValue(value) {
        const previous = ctx.props.value;
        ctx.props.value = value;
        render(ctx.props);
        if (!Object.is(previous, value)) ctx.emit('change', { value, previous });
        return value;
      },
      /** @returns {Element} contenedor estable del contenido */
      get content() {
        return contentEl;
      },
      /** @returns {unknown} */
      get template() {
        return ctx.props.template;
      },
    },
  };
});

// --- iframe -----------------------------------------------------------

const DEFAULT_IFRAME_TITLE = 'Contenido incrustado';
const DEFAULT_IFRAME_WIDTH = '100%';
const DEFAULT_IFRAME_HEIGHT = 320;

/**
 * Normaliza `sandbox`: un array se une con espacios y `undefined`/`null`
 * producen el sandbox vacio (sin permisos).
 *
 * @param {unknown} value
 * @returns {string}
 */
function sandboxValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' ');
  if (value === undefined || value === null) return '';
  return String(value);
}

define('iframe', (ctx) => {
  const frame = ctx.h('iframe', { class: 'z-iframe__frame' });
  const el = ctx.h('div', { class: 'z-iframe' }, [frame]);

  ctx.on(frame, 'load', () => {
    ctx.emit('load', { src: asText(ctx.props.src) });
  });

  /** @param {any} props */
  const update = (props) => {
    const src = props.src;
    if (src === undefined || src === null || src === '') frame.removeAttribute('src');
    else frame.setAttribute('src', String(src));

    if (props.sandbox === false) frame.removeAttribute('sandbox');
    else frame.setAttribute('sandbox', sandboxValue(props.sandbox));

    if (props.allow === undefined || props.allow === null || props.allow === '') {
      frame.removeAttribute('allow');
    } else {
      frame.setAttribute('allow', Array.isArray(props.allow) ? props.allow.join('; ') : String(props.allow));
    }

    const title = asText(props.title || props.ariaLabel) || DEFAULT_IFRAME_TITLE;
    frame.setAttribute('title', title);
    frame.setAttribute('loading', props.loading === undefined ? 'lazy' : String(props.loading));
    frame.setAttribute('width', props.width === undefined ? DEFAULT_IFRAME_WIDTH : String(props.width));
    frame.setAttribute('height', props.height === undefined ? DEFAULT_IFRAME_HEIGHT : String(props.height));

    if (props.allowFullscreen) frame.setAttribute('allowfullscreen', '');
    else frame.removeAttribute('allowfullscreen');

    el.setAttribute('class', cls('z-iframe', props.plain && 'z-iframe--plain'));
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      getSrc() {
        return asText(ctx.props.src);
      },
      /**
       * @param {unknown} src
       * @returns {string}
       */
      setSrc(src) {
        ctx.props.src = src;
        update(ctx.props);
        return asText(src);
      },
      /** @returns {Element} el iframe interno */
      get frame() {
        return frame;
      },
      /** @returns {string} */
      get src() {
        return asText(ctx.props.src);
      },
    },
  };
});

// --- video ------------------------------------------------------------

const DEFAULT_VIDEO_WIDTH = 480;
const DEFAULT_VIDEO_HEIGHT = 270;

define('video', (ctx) => {
  const video = ctx.h('video', { class: 'z-video__el' });
  const el = ctx.h('div', { class: 'z-video' }, [video]);
  let playing = false;

  ctx.on(video, 'play', (event) => {
    playing = true;
    ctx.emit('play', { src: asText(ctx.props.src), event });
  });
  ctx.on(video, 'pause', (event) => {
    playing = false;
    ctx.emit('pause', { src: asText(ctx.props.src), event });
  });
  ctx.on(video, 'ended', (event) => {
    playing = false;
    ctx.emit('ended', { src: asText(ctx.props.src), event });
  });

  /** @param {any} props */
  const update = (props) => {
    if (props.src === undefined || props.src === null || props.src === '') video.removeAttribute('src');
    else video.setAttribute('src', String(props.src));

    if (props.poster) video.setAttribute('poster', String(props.poster));
    else video.removeAttribute('poster');

    const controls = props.controls === undefined ? true : Boolean(props.controls);
    if (controls) video.setAttribute('controls', '');
    else video.removeAttribute('controls');

    if (props.preload === false) video.removeAttribute('preload');
    else video.setAttribute('preload', props.preload === undefined ? 'metadata' : String(props.preload));

    const flags = [
      ['playsinline', props.playsinline === undefined ? true : props.playsinline],
      ['loop', Boolean(props.loop)],
      ['muted', Boolean(props.muted)],
      ['autoplay', Boolean(props.autoplay)],
    ];
    for (const [name, on] of flags) {
      if (on) video.setAttribute(name, '');
      else video.removeAttribute(name);
    }

    video.setAttribute('width', props.width === undefined ? String(DEFAULT_VIDEO_WIDTH) : String(props.width));
    video.setAttribute('height', props.height === undefined ? String(DEFAULT_VIDEO_HEIGHT) : String(props.height));
    video.setAttribute('aria-label', asText(props.title || props.ariaLabel) || 'Reproductor de video');

    if (props.title) video.setAttribute('title', String(props.title));
    else video.removeAttribute('title');
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      getSrc() {
        return asText(ctx.props.src);
      },
      /**
       * @param {unknown} src
       * @returns {string}
       */
      setSrc(src) {
        ctx.props.src = src;
        update(ctx.props);
        return asText(src);
      },
      /**
       * Pide la reproduccion al elemento. Si el entorno no implementa
       * `play()`, emite `play` para que el widget siga siendo observable.
       *
       * @returns {unknown}
       */
      play() {
        if (typeof video.play === 'function') {
          const result = video.play();
          if (result && typeof result.catch === 'function') result.catch(() => {});
          return result;
        }
        playing = true;
        ctx.emit('play', { src: asText(ctx.props.src), manual: true });
        return undefined;
      },
      /** @returns {unknown} */
      pause() {
        if (typeof video.pause === 'function') return video.pause();
        playing = false;
        ctx.emit('pause', { src: asText(ctx.props.src), manual: true });
        return undefined;
      },
      /** @returns {boolean} */
      get playing() {
        return playing;
      },
      /** @returns {Element} el elemento video interno */
      get video() {
        return video;
      },
      /** @returns {string} */
      get src() {
        return asText(ctx.props.src);
      },
    },
  };
});

// --- barcode ----------------------------------------------------------

/** Ancho de barra por omision, en pixeles. */
const DEFAULT_BARCODE_BAR_WIDTH = 2;
/** Altura de las barras por omision, en pixeles. */
const DEFAULT_BARCODE_HEIGHT = 60;
/** Zona de silencio de cada lado, en modulos. */
const DEFAULT_BARCODE_QUIET_ZONE = 10;
/** Alto reservado para el texto legible, en pixeles. */
const BARCODE_TEXT_HEIGHT = 18;
/** Linea base del texto legible, medida desde el pie de las barras. */
const BARCODE_TEXT_BASELINE = 13;
const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Patrones del Code 128: seis anchos por simbolo (barra, espacio, barra,
 * espacio, barra, espacio) y siete en el STOP. Cada simbolo suma 11 modulos y
 * cada patron tiene cantidad par de modulos de barra, la propiedad que usa el
 * lector para validar la simetria.
 */
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

/**
 * Codifica el valor con Code 128 (juego B, ASCII imprimible 32-126).
 *
 * Devuelve los valores de los simbolos, el digito verificador y la secuencia
 * de anchos en modulos, alternando barra y espacio desde una barra.
 *
 * @param {unknown} input
 * @returns {{ text: string, values: number[], checksum: number|null, codes: number[], widths: number[], modules: number }}
 */
export function encodeCode128(input) {
  const text = asText(input);
  if (text === '') {
    return { text, values: [], checksum: null, codes: [], widths: [], modules: 0 };
  }

  const values = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code < 32 || code > 126) {
      throw new RangeError(
        `zorzal: barcode solo admite ASCII imprimible (Code 128 B); caracter no soportado: "${char}"`
      );
    }
    values.push(code - 32);
  }

  let sum = START_CODE_B;
  values.forEach((value, index) => {
    sum += value * (index + 1);
  });
  const checksum = sum % 103;
  const codes = [START_CODE_B, ...values, checksum, STOP_CODE];

  const widths = [];
  for (const code of codes) {
    for (const digit of CODE128_PATTERNS[code]) widths.push(Number(digit));
  }
  const modules = widths.reduce((total, run) => total + run, 0);

  return { text, values, checksum, codes, widths, modules };
}

/**
 * Geometria del codigo: zonas de silencio, ancho de barra, alto y rectangulos
 * de las barras en pixeles.
 *
 * @param {Record<string, unknown>} [props]
 * @returns {any}
 */
export function barcodeGeometry(props = {}) {
  const encoded = encodeCode128(props.value);
  const barWidth = positive(props.barWidth, DEFAULT_BARCODE_BAR_WIDTH);
  const barHeight = positive(props.height, DEFAULT_BARCODE_HEIGHT);
  const quietZone = Math.max(0, Math.floor(toNumber(props.quietZone) ?? DEFAULT_BARCODE_QUIET_ZONE));
  const showText = Boolean(props.showText);
  const textHeight = showText ? BARCODE_TEXT_HEIGHT : 0;

  const bars = [];
  let cursor = quietZone;
  encoded.widths.forEach((run, index) => {
    if (index % 2 === 0) bars.push({ x: cursor * barWidth, width: run * barWidth });
    cursor += run;
  });

  const totalModules = encoded.modules + quietZone * 2;

  return {
    ...encoded,
    barWidth,
    barHeight,
    quietZone,
    showText,
    textHeight,
    totalModules,
    width: totalModules * barWidth,
    height: barHeight + textHeight,
    bars,
  };
}

define('barcode', (ctx) => {
  const svg = snode(ctx, 'svg', { class: 'z-barcode__svg', role: 'img', focusable: 'false' });
  const el = ctx.h('div', { class: 'z-barcode' }, [svg]);
  /** @type {any} */
  let geometry = null;

  /**
   * Redibuja el SVG en el mismo nodo: cambia atributos y barras, nunca el
   * elemento `svg` ni el contenedor.
   *
   * @param {any} props
   * @returns {any}
   */
  const paint = (props) => {
    const geo = barcodeGeometry(props);
    geometry = geo;

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    svg.setAttribute('viewBox', `0 0 ${n2(geo.width)} ${n2(geo.height)}`);
    svg.setAttribute('width', String(geo.width));
    svg.setAttribute('height', String(geo.height));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-label', asText(props.ariaLabel || geo.text) || 'Codigo de barras');

    for (const bar of geo.bars) {
      svg.appendChild(
        snode(ctx, 'rect', {
          class: 'z-barcode__bar',
          x: bar.x,
          y: 0,
          width: bar.width,
          height: geo.barHeight,
        })
      );
    }

    if (geo.showText && geo.text !== '') {
      svg.appendChild(
        snode(ctx, 'text', {
          class: 'z-barcode__text',
          x: n2(geo.width / 2),
          y: n2(geo.barHeight + BARCODE_TEXT_BASELINE),
          'text-anchor': 'middle',
          text: geo.text,
        })
      );
    }

    el.setAttribute('data-value', geo.text);
    return geo;
  };
  paint(ctx.props);

  return {
    el,
    update: paint,
    api: {
      /** @returns {string} */
      getValue() {
        return asText(ctx.props.value);
      },
      /**
       * Valida el valor antes de mutar el estado: un caracter fuera de Code
       * 128 B lanza `RangeError` y deja el codigo anterior intacto.
       *
       * @param {unknown} value
       * @returns {string}
       */
      setValue(value) {
        const next = asText(value);
        encodeCode128(next);
        const previous = asText(ctx.props.value);
        ctx.props.value = next;
        paint(ctx.props);
        if (previous !== next) ctx.emit('change', { value: next, previous });
        return next;
      },
      /** @returns {Element|null} */
      get svg() {
        return svg;
      },
      /** @returns {number} */
      get modules() {
        return geometry ? geometry.totalModules : 0;
      },
      /** @returns {{ x: number, width: number }[]} */
      get bars() {
        return geometry ? geometry.bars : [];
      },
      /** @returns {number} */
      get barWidth() {
        return geometry ? geometry.barWidth : DEFAULT_BARCODE_BAR_WIDTH;
      },
      /** @returns {number} */
      get height() {
        return geometry ? geometry.height : DEFAULT_BARCODE_HEIGHT;
      },
    },
  };
});
