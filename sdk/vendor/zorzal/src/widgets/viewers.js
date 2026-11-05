/**
 * Visores: `pdfviewer`, `excelviewer`, `google-map` y `geochart`.
 *
 * Los cuatro evitan dependencias y credenciales; cada uno declara su limite:
 *
 * - `pdfviewer`: `<iframe>` nativo sobre la URL del PDF. La calidad y la
 *   disponibilidad del visor dependen del navegador; si no puede incrustar
 *   PDF se muestra un aviso con el enlace directo al archivo.
 * - `excelviewer`: tablas de texto CSV o TSV (con o sin encabezado). No lee
 *   XLSX ni XLS: un contenido binario produce un mensaje de limitacion.
 * - `google-map`: `<iframe>` del embed publico de Google Maps a partir de
 *   `query` o `coords`, sin API key ni SDK.
 * - `geochart`: mapa coropletico sobre el SVG de regiones que aporta el
 *   usuario (`regions: [{ id, path }]`). No incluye un mapa mundial propio:
 *   los paths y su `viewBox` son responsabilidad de quien lo usa.
 *
 * La geometria de los iframes y del SVG va en atributos (`width`, `height`,
 * `viewBox`, `d`) y los colores en variables CSS con prefijo `z-`.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { csv } from '../services/csv.js';
import { n2, positive, snode, toNumber } from './chart.js';

/** Tipos que agrega este modulo al registro del core. */
export const VIEWER_WIDGETS = ['pdfviewer', 'excelviewer', 'google-map', 'geochart'];

const DEFAULT_PDF_WIDTH = '100%';
const DEFAULT_PDF_HEIGHT = 600;
const DEFAULT_PDF_TITLE = 'Documento PDF';
const PDF_NOTICE_TITLE = 'Este navegador no muestra visores PDF incrustados.';
const PDF_NOTICE_LINK = 'Abrir el PDF';
const PDF_NOTICE_HINT = 'Usa el enlace para descargarlo o abrirlo en otra pestana.';

const DEFAULT_EXCEL_MAX_ROWS = 1000;
const XLSX_SIGNATURE = 'PK\u0003\u0004';
const XLS_SIGNATURE = '\u00D0\u00CF\u0011\u00E0';
const XLSX_LIMIT_MESSAGE =
  'excelviewer no lee XLSX ni XLS: el archivo es binario. Exportalo a CSV o TSV y volve a cargarlo.';
const BINARY_LIMIT_MESSAGE =
  'excelviewer solo acepta texto CSV o TSV; el contenido recibido es binario.';

const MAP_BASE = 'https://maps.google.com/maps';
const DEFAULT_MAP_WIDTH = '100%';
const DEFAULT_MAP_HEIGHT = 400;
const DEFAULT_MAP_ZOOM = 13;
const DEFAULT_MAP_TITLE = 'Mapa';
const MIN_ZOOM = 1;
const MAX_ZOOM = 21;

const GEO_STEPS = 5;
const DEFAULT_GEO_WIDTH = 640;
const DEFAULT_GEO_HEIGHT = 360;
const GEO_EMPTY_MESSAGE =
  'geochart necesita regions: [{ id, path }]. El widget no incluye un mapa mundial propio.';

/** @param {unknown} value @returns {string} */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/** @param {unknown} value @returns {number} */
function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Texto de una celda o de un tooltip. Respeta `format` cuando es funcion.
 *
 * @param {any} props
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(props, value) {
  if (props && typeof props.format === 'function') {
    const out = props.format(value);
    if (out !== undefined && out !== null) return String(out);
  }
  const number = toNumber(value);
  return number === null ? asText(value) : String(n2(number));
}

// --- pdfviewer --------------------------------------------------------

/**
 * Detecta si el documento activo puede incrustar PDF. Un documento sin
 * `defaultView` (render en servidor, DOM de los tests) se considera sin
 * soporte. Si no hay senal explicita se asume que si, como en los navegadores
 * actuales.
 *
 * @param {unknown} doc
 * @returns {boolean}
 */
export function detectPdfSupport(doc) {
  const view = (doc && doc.defaultView) || (typeof globalThis !== 'undefined' ? globalThis.window : null);
  const navigator = view && view.navigator ? view.navigator : null;
  if (!navigator) return false;
  if (typeof navigator.pdfViewerEnabled === 'boolean') return navigator.pdfViewerEnabled;
  const types = navigator.mimeTypes;
  if (types && typeof types.length === 'number') {
    for (const entry of types) {
      if (!entry) continue;
      if (entry.type === 'application/pdf' || asText(entry.suffixes).includes('pdf')) return true;
    }
  }
  return true;
}

define('pdfviewer', (ctx) => {
  const frame = ctx.h('iframe', { class: 'z-pdfviewer__frame' });
  const noticeText = ctx.h('p', { class: 'z-pdfviewer__notice-text', text: PDF_NOTICE_TITLE });
  const noticeHint = ctx.h('p', { class: 'z-pdfviewer__notice-hint', text: PDF_NOTICE_HINT });
  const noticeLink = ctx.h('a', {
    class: 'z-pdfviewer__link',
    href: '#',
    target: '_blank',
    rel: 'noopener noreferrer',
    text: PDF_NOTICE_LINK,
  });
  const notice = ctx.h('div', { class: 'z-pdfviewer__notice', role: 'alert', hidden: true }, [
    noticeText,
    noticeHint,
    noticeLink,
  ]);
  const el = ctx.h('div', { class: 'z-pdfviewer' }, [frame, notice]);

  ctx.on(frame, 'load', () => {
    ctx.emit('load', { src: asText(ctx.props.src) });
  });

  /** @param {any} props @returns {boolean} */
  const supported = (props) =>
    typeof props.supported === 'boolean' ? props.supported : detectPdfSupport(ctx.doc());

  /** @param {any} props */
  const update = (props) => {
    const src = asText(props.src);
    if (src === '') frame.removeAttribute('src');
    else frame.setAttribute('src', src);

    frame.setAttribute('width', props.width === undefined ? DEFAULT_PDF_WIDTH : String(props.width));
    frame.setAttribute('height', props.height === undefined ? String(DEFAULT_PDF_HEIGHT) : String(props.height));
    frame.setAttribute('title', asText(props.title || props.ariaLabel) || DEFAULT_PDF_TITLE);
    frame.setAttribute('loading', props.loading === undefined ? 'lazy' : String(props.loading));

    const canEmbed = supported(props);
    if (canEmbed) {
      frame.removeAttribute('hidden');
      notice.setAttribute('hidden', '');
    } else {
      frame.setAttribute('hidden', '');
      notice.removeAttribute('hidden');
    }
    if (src === '') noticeLink.setAttribute('href', '#');
    else noticeLink.setAttribute('href', src);

    el.setAttribute('class', cls('z-pdfviewer', !canEmbed && 'z-pdfviewer--unsupported'));
    el.setAttribute('data-supported', canEmbed ? 'true' : 'false');
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
      /** @returns {boolean} */
      get supported() {
        return supported(ctx.props);
      },
      /** @returns {Element} el iframe interno */
      get frame() {
        return frame;
      },
      /** @returns {Element} el aviso de falta de soporte */
      get notice() {
        return notice;
      },
      /** @returns {string} */
      get src() {
        return asText(ctx.props.src);
      },
    },
  };
});

// --- excelviewer ------------------------------------------------------

/**
 * Separador declarado o detectado en la primera linea. `auto` (o vacio)
 * compara tabulaciones y comas: gana el que mas aparece.
 *
 * @param {string} text
 * @param {unknown} [declared]
 * @returns {string}
 */
export function tableDelimiter(text, declared) {
  const raw = asText(declared);
  if (raw !== '' && raw !== 'auto') return raw === '\\t' ? '\t' : raw;
  const first = String(text).split(/\r\n|\r|\n/, 1)[0] || '';
  const tabs = (first.match(/\t/g) || []).length;
  const commas = (first.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

/**
 * Parsea CSV o TSV a filas de texto. El BOM inicial se descarta y las celdas
 * respetan las comillas dobles de RFC 4180.
 *
 * @param {unknown} text
 * @param {{ delimiter?: unknown }} [options]
 * @returns {{ rows: string[][], delimiter: string }}
 */
export function parseTable(text, options = {}) {
  const source = typeof text === 'string' ? text.replace(/^\uFEFF/, '') : '';
  const delimiter = tableDelimiter(source, options.delimiter);
  return { rows: csv.parse(source, { delimiter }), delimiter };
}

/**
 * Motivo por el que el contenido no es una tabla de texto, o `null` si lo es.
 *
 * @param {unknown} data
 * @returns {'xlsx'|'binario'|'no-texto'|null}
 */
export function binaryReason(data) {
  if (data === undefined || data === null || data === '') return null;
  if (typeof ArrayBuffer !== 'undefined') {
    if (data instanceof ArrayBuffer) return 'binario';
    if (typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(data)) return 'binario';
  }
  if (typeof data !== 'string') return 'no-texto';
  if (data.startsWith(XLSX_SIGNATURE) || data.startsWith(XLS_SIGNATURE)) return 'xlsx';
  if (data.includes('\u0000')) return 'binario';
  return null;
}

/** @param {string[][]} rows @returns {number} */
function tableWidth(rows) {
  let width = 0;
  for (const row of rows) if (row.length > width) width = row.length;
  return width;
}

define('excelviewer', (ctx) => {
  const titleEl = ctx.h('div', { class: 'z-excelviewer__title' });
  const table = ctx.h('table', { class: 'z-excelviewer__table' });
  const message = ctx.h('p', { class: 'z-excelviewer__message', role: 'alert', hidden: true });
  const note = ctx.h('p', { class: 'z-excelviewer__note', hidden: true });
  const el = ctx.h('div', { class: 'z-excelviewer' }, [titleEl, message, table, note]);
  /** @type {string[][]} */
  let rows = [];
  let delimiter = ',';

  /**
   * Arma la tabla completa. Solo cambia hijos: `table` es estable.
   *
   * @param {any} props
   */
  const build = (props) => {
    while (table.firstChild) table.removeChild(table.firstChild);
    const header = props.header === undefined ? true : Boolean(props.header);
    const columns = tableWidth(rows);
    const body = header ? rows.slice(1) : rows;
    const limit = Math.floor(positive(props.maxRows, DEFAULT_EXCEL_MAX_ROWS));
    const visible = body.slice(0, limit);

    if (rows.length > 0) {
      const thead = ctx.h('thead', { class: 'z-excelviewer__head' });
      if (header) {
        const headRow = ctx.h('tr', { class: 'z-excelviewer__row' });
        for (let index = 0; index < columns; index += 1) {
          headRow.appendChild(
            ctx.h('th', { class: 'z-excelviewer__cell z-excelviewer__cell--head', scope: 'col' }, [
              rows[0][index] === undefined ? '' : rows[0][index],
            ])
          );
        }
        thead.appendChild(headRow);
        table.appendChild(thead);
      }

      const tbody = ctx.h('tbody', { class: 'z-excelviewer__body' });
      for (const row of visible) {
        const tr = ctx.h('tr', { class: 'z-excelviewer__row' });
        for (let index = 0; index < columns; index += 1) {
          tr.appendChild(
            ctx.h('td', { class: 'z-excelviewer__cell' }, [row[index] === undefined ? '' : row[index]])
          );
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
    }

    if (visible.length < body.length) {
      note.textContent = `Mostrando ${visible.length} de ${body.length} filas.`;
      note.removeAttribute('hidden');
    } else {
      note.textContent = '';
      note.setAttribute('hidden', '');
    }

    table.setAttribute('data-columns', String(columns));
    table.setAttribute('data-rows', String(visible.length));
    el.setAttribute('data-delimiter', delimiter === '\t' ? 'tab' : delimiter);
  };

  /** @param {any} props @param {unknown} data */
  const load = (props, data) => {
    const reason = binaryReason(data);
    if (reason !== null) {
      rows = [];
      delimiter = ',';
      message.textContent = reason === 'xlsx' ? XLSX_LIMIT_MESSAGE : BINARY_LIMIT_MESSAGE;
      message.removeAttribute('hidden');
      table.setAttribute('hidden', '');
      note.setAttribute('hidden', '');
    } else {
      message.textContent = '';
      message.setAttribute('hidden', '');
      table.removeAttribute('hidden');
      const parsed = parseTable(data, { delimiter: props.delimiter });
      rows = parsed.rows;
      delimiter = parsed.delimiter;
    }
    build(props);
  };

  /** @param {any} props */
  const update = (props) => {
    const title = props.title === undefined || props.title === null ? '' : String(props.title);
    titleEl.textContent = title;
    if (title) titleEl.removeAttribute('hidden');
    else titleEl.setAttribute('hidden', '');
    load(props, props.data);
  };
  update(ctx.props);

  /** @returns {number} filas de datos (sin encabezado) */
  const count = () => {
    const header = ctx.props.header === undefined ? true : Boolean(ctx.props.header);
    return rows.length === 0 ? 0 : Math.max(0, rows.length - (header ? 1 : 0));
  };

  return {
    el,
    update,
    api: {
      /**
       * @param {unknown} data texto CSV o TSV
       * @returns {number} filas de datos cargadas (0 si el contenido es binario)
       */
      setData(data) {
        const previous = ctx.props.data;
        ctx.props.data = data;
        update(ctx.props);
        if (!Object.is(previous, data)) ctx.emit('change', { rows: count(), delimiter });
        return count();
      },
      /** @returns {unknown} el contenido original recibido */
      getData() {
        return ctx.props.data;
      },
      /** @returns {string[][]} filas parseadas, encabezado incluido */
      get rows() {
        return rows.map((row) => row.slice());
      },
      /** @returns {string} separador usado (`,` o tabulacion) */
      get delimiter() {
        return delimiter;
      },
      /** @returns {number} filas de datos (sin encabezado) */
      get count() {
        return count();
      },
      /** @returns {number} columnas de la tabla */
      get columns() {
        return tableWidth(rows);
      },
      /** @returns {Element} el elemento table */
      get table() {
        return table;
      },
      /** @returns {Element} el aviso de limitacion */
      get message() {
        return message;
      },
    },
  };
});

// --- google-map -------------------------------------------------------

/** @param {unknown} lat @param {unknown} lng @returns {{ lat: number, lng: number }|null} */
function coordsOf(lat, lng) {
  const a = toNumber(lat);
  const b = toNumber(lng);
  if (a === null || b === null) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  return { lat: a, lng: b };
}

/**
 * Normaliza `coords`: acepta `{ lat, lng }`, `{ latitude, longitude }` o
 * `[lat, lng]`. Devuelve `null` si falta un numero o esta fuera de rango.
 *
 * @param {unknown} value
 * @returns {{ lat: number, lng: number }|null}
 */
export function normalizeCoords(value) {
  if (Array.isArray(value)) return coordsOf(value[0], value[1]);
  if (value && typeof value === 'object') {
    const lat = value.lat !== undefined ? value.lat : value.latitude;
    const lng = value.lng !== undefined ? value.lng : value.lon !== undefined ? value.lon : value.longitude;
    return coordsOf(lat, lng);
  }
  return null;
}

/**
 * URL del embed publico de Google Maps (`output=embed`), sin API key.
 * `coords` tiene prioridad sobre `query`. Sin ninguno de los dos devuelve
 * cadena vacia.
 *
 * @param {{ query?: unknown, coords?: unknown, zoom?: unknown }} [options]
 * @returns {string}
 */
export function geoEmbedUrl(options = {}) {
  const zoom = Math.round(clamp(toNumber(options.zoom) ?? DEFAULT_MAP_ZOOM, MIN_ZOOM, MAX_ZOOM));
  const coords = normalizeCoords(options.coords);
  if (coords) {
    return `${MAP_BASE}?q=${encodeURIComponent(`${coords.lat},${coords.lng}`)}&z=${zoom}&output=embed`;
  }
  const query = asText(options.query).trim();
  if (query === '') return '';
  return `${MAP_BASE}?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;
}

define('google-map', (ctx) => {
  const frame = ctx.h('iframe', { class: 'z-google-map__frame' });
  const el = ctx.h('div', { class: 'z-google-map' }, [frame]);

  ctx.on(frame, 'load', () => {
    ctx.emit('load', { src: asText(frame.getAttribute('src')) });
  });

  /** @param {any} props */
  const update = (props) => {
    const url = geoEmbedUrl(props);
    if (url === '') frame.removeAttribute('src');
    else frame.setAttribute('src', url);

    frame.setAttribute('width', props.width === undefined ? DEFAULT_MAP_WIDTH : String(props.width));
    frame.setAttribute('height', props.height === undefined ? String(DEFAULT_MAP_HEIGHT) : String(props.height));
    frame.setAttribute('title', asText(props.title || props.ariaLabel) || DEFAULT_MAP_TITLE);
    frame.setAttribute('loading', props.loading === undefined ? 'lazy' : String(props.loading));
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    if (props.allowFullscreen === false) frame.removeAttribute('allowfullscreen');
    else frame.setAttribute('allowfullscreen', '');

    el.setAttribute('data-zoom', String(props.zoom === undefined ? DEFAULT_MAP_ZOOM : props.zoom));
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /**
       * @param {unknown} query texto libre o direccion
       * @returns {string} la URL del embed resultante
       */
      setQuery(query) {
        ctx.props.query = query;
        ctx.props.coords = null;
        update(ctx.props);
        return asText(frame.getAttribute('src'));
      },
      /**
       * @param {unknown} lat objeto `{ lat, lng }`, `[lat, lng]` o latitud
       * @param {unknown} [lng] longitud cuando `lat` es un numero
       * @returns {{ lat: number, lng: number }|null}
       */
      setCoords(lat, lng) {
        const coords = lng === undefined ? normalizeCoords(lat) : coordsOf(lat, lng);
        if (!coords) return null;
        ctx.props.coords = coords;
        ctx.props.query = '';
        update(ctx.props);
        return coords;
      },
      /** @returns {string} */
      getQuery() {
        return asText(ctx.props.query);
      },
      /** @returns {{ lat: number, lng: number }|null} */
      getCoords() {
        return normalizeCoords(ctx.props.coords);
      },
      /** @returns {string} */
      getSrc() {
        return asText(frame.getAttribute('src'));
      },
      /** @returns {Element} el iframe interno */
      get frame() {
        return frame;
      },
    },
  };
});

// --- geochart ---------------------------------------------------------

/** @param {unknown} data @returns {number[]} */
function numericValues(data) {
  if (!data || typeof data !== 'object') return [];
  const out = [];
  for (const value of Object.values(data)) {
    const number = toNumber(value);
    if (number !== null) out.push(number);
  }
  return out;
}

/**
 * Dominio de la escala. Sin `min`/`max` toma los valores numericos de `data`;
 * un dominio de un solo valor se trata como maximo en el tono mas alto.
 *
 * @param {unknown} data
 * @param {{ min?: unknown, max?: unknown }} [options]
 * @returns {{ min: number, max: number, steps: number, span: number }}
 */
export function geochartScale(data, options = {}) {
  const values = numericValues(data);
  const declaredMin = toNumber(options.min);
  const declaredMax = toNumber(options.max);
  const min = declaredMin === null ? (values.length ? Math.min(...values) : 0) : declaredMin;
  let max = declaredMax === null ? (values.length ? Math.max(...values) : min) : declaredMax;
  if (max < min) max = min;
  return { min, max, steps: GEO_STEPS, span: max - min };
}

/**
 * Tono 1..`steps` para un valor, o `null` si no hay dato numerico. El minimo
 * cae en el tono 1 y el maximo en el ultimo.
 *
 * @param {unknown} value
 * @param {{ min: number, max: number, steps: number, span: number }} scale
 * @returns {number|null}
 */
export function geochartTone(value, scale) {
  const number = toNumber(value);
  if (number === null || !scale) return null;
  const { min, max, steps } = scale;
  if (!(max > min)) return steps;
  const clamped = clamp(number, min, max);
  const fraction = (clamped - min) / (max - min);
  return Math.min(steps, 1 + Math.floor(fraction * steps));
}

/**
 * Regiones normalizadas `{ id, path, label }`; las entradas sin `id` o sin
 * `path` se descartan.
 *
 * @param {unknown} regions
 * @returns {{ id: string, path: string, label: string }[]}
 */
export function normalizeRegions(regions) {
  if (!Array.isArray(regions)) return [];
  const out = [];
  for (const region of regions) {
    if (!region || typeof region !== 'object') continue;
    const id = asText(region.id);
    const path = asText(region.path);
    if (id === '' || path === '') continue;
    out.push({ id, path, label: asText(region.label || region.name || region.id) || id });
  }
  return out;
}

define('geochart', (ctx) => {
  const titleEl = ctx.h('div', { class: 'z-geochart__title' });
  const empty = ctx.h('p', { class: 'z-geochart__empty', hidden: true, text: GEO_EMPTY_MESSAGE });
  const legendMin = ctx.h('span', { class: 'z-geochart__legend-label' });
  const legendMax = ctx.h('span', { class: 'z-geochart__legend-label' });
  const swatches = ctx.h('span', { class: 'z-geochart__swatches' });
  const legend = ctx.h('div', { class: 'z-geochart__legend' }, [legendMin, swatches, legendMax]);
  const el = ctx.h('div', { class: 'z-geochart' }, [titleEl, empty, legend]);
  /** @type {Element|null} */
  let svgEl = null;
  /** @type {{ min: number, max: number, steps: number, span: number }} */
  let scale = geochartScale({});

  /** @param {any} props @returns {any} */
  const build = (props) => {
    if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
    const regions = normalizeRegions(props.regions);
    const data = props.data && typeof props.data === 'object' && !Array.isArray(props.data) ? props.data : {};
    scale = geochartScale(data, props);
    const width = positive(props.width, DEFAULT_GEO_WIDTH);
    const height = positive(props.height, DEFAULT_GEO_HEIGHT);

    const svg = snode(ctx, 'svg', {
      class: 'z-geochart__svg',
      viewBox: props.viewBox === undefined ? `0 0 ${n2(width)} ${n2(height)}` : String(props.viewBox),
      width,
      height,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': props.ariaLabel || props.title || 'Mapa por regiones',
      focusable: 'false',
    });

    for (const region of regions) {
      const raw = data[region.id];
      const tone = geochartTone(raw, scale);
      const path = snode(ctx, 'path', {
        class:
          tone === null
            ? 'z-geochart__region z-geochart__region--empty'
            : `z-geochart__region z-geochart__region--tone-${tone}`,
        d: region.path,
        'data-id': region.id,
        'data-value': tone === null ? '' : String(formatValue(props, raw)),
        'data-tone': tone === null ? '' : String(tone),
      });
      path.appendChild(
        snode(ctx, 'title', {
          text:
            tone === null
              ? `${region.label}: sin dato`
              : `${region.label}: ${formatValue(props, raw)}`,
        })
      );
      svg.appendChild(path);
    }

    el.appendChild(svg);
    svgEl = svg;

    if (regions.length === 0) empty.removeAttribute('hidden');
    else empty.setAttribute('hidden', '');
    if (regions.length === 0) legend.setAttribute('hidden', '');
    else legend.removeAttribute('hidden');

    legendMin.textContent = formatValue(props, scale.min);
    legendMax.textContent = formatValue(props, scale.max);
    while (swatches.firstChild) swatches.removeChild(swatches.firstChild);
    for (let index = 1; index <= GEO_STEPS; index += 1) {
      swatches.appendChild(
        snode(ctx, 'span', { class: `z-geochart__swatch z-geochart__swatch--tone-${index}` })
      );
    }
    el.setAttribute('data-regions', String(regions.length));
    return scale;
  };

  /** @param {any} props */
  const update = (props) => {
    const title = props.title === undefined || props.title === null ? '' : String(props.title);
    titleEl.textContent = title;
    if (title) titleEl.removeAttribute('hidden');
    else titleEl.setAttribute('hidden', '');
    build(props);
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => {
      if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
      svgEl = null;
    },
    api: {
      /**
       * @param {unknown} data `{ id: valor }`
       * @returns {number} cantidad de regiones dibujadas
       */
      setData(data) {
        ctx.props.data = data && typeof data === 'object' ? data : {};
        update(ctx.props);
        ctx.emit('change', { data: ctx.props.data, scale });
        return normalizeRegions(ctx.props.regions).length;
      },
      /** @returns {unknown} */
      getData() {
        return ctx.props.data && typeof ctx.props.data === 'object' ? ctx.props.data : {};
      },
      /**
       * @param {unknown} regions `[{ id, path }]`
       * @returns {number}
       */
      setRegions(regions) {
        ctx.props.regions = Array.isArray(regions) ? regions : [];
        update(ctx.props);
        return normalizeRegions(ctx.props.regions).length;
      },
      /** @returns {{ id: string, path: string, label: string }[]} */
      get regions() {
        return normalizeRegions(ctx.props.regions);
      },
      /** @returns {{ min: number, max: number, steps: number, span: number }} */
      get scale() {
        return { ...scale };
      },
      /**
       * @param {unknown} id
       * @returns {number|null} tono 1..5 del dato de la region
       */
      toneFor(id) {
        const data = ctx.props.data && typeof ctx.props.data === 'object' ? ctx.props.data : {};
        return geochartTone(data[asText(id)], scale);
      },
      /** @returns {Element|null} */
      get svg() {
        return svgEl;
      },
      /** @returns {number} */
      get count() {
        return normalizeRegions(ctx.props.regions).length;
      },
    },
  };
});
