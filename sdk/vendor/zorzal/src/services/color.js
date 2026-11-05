/**
 * color: conversion y mezcla de colores, sin dependencias.
 *
 * Acepta `#rgb`, `#rrggbb`, `rgb(r, g, b)`, `rgba(r, g, b, a)` y arreglos
 * `[r, g, b]`. La salida de `toHex` es siempre `#rrggbb` en minusculas.
 */

const HEX_SHORT = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;
const RGB_FN = /^rgba?\(\s*([^)]+)\)$/i;

const NAMED = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  gray: '#808080',
  grey: '#808080',
  transparent: '#000000',
};

/** @param {number} value */
function clamp(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

/** @param {number} value */
function pad(value) {
  return clamp(value).toString(16).padStart(2, '0');
}

/**
 * Normaliza cualquier entrada a `{ r, g, b }`.
 *
 * @param {string|number[]|{r:number,g:number,b:number}} value
 * @returns {{ r: number, g: number, b: number }}
 */
function parse(value) {
  if (Array.isArray(value)) {
    if (value.length < 3) throw new Error('zorzal.color: se esperan tres canales');
    return { r: clamp(Number(value[0])), g: clamp(Number(value[1])), b: clamp(Number(value[2])) };
  }
  if (value && typeof value === 'object') {
    return { r: clamp(Number(value.r)), g: clamp(Number(value.g)), b: clamp(Number(value.b)) };
  }
  if (typeof value !== 'string') throw new Error('zorzal.color: color invalido');

  const text = value.trim();
  const named = NAMED[text.toLowerCase()];
  if (named) return parse(named);

  const short = text.match(HEX_SHORT);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
    };
  }

  const long = text.match(HEX_LONG);
  if (long) {
    return { r: parseInt(long[1], 16), g: parseInt(long[2], 16), b: parseInt(long[3], 16) };
  }

  const fn = text.match(RGB_FN);
  if (fn) {
    const parts = fn[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some((part) => Number.isNaN(part))) {
      throw new Error(`zorzal.color: color invalido "${value}"`);
    }
    return { r: clamp(parts[0]), g: clamp(parts[1]), b: clamp(parts[2]) };
  }

  throw new Error(`zorzal.color: color invalido "${value}"`);
}

/**
 * @param {string|number[]|{r:number,g:number,b:number}} value
 * @returns {string} `#rrggbb`
 */
export function toHex(value) {
  const { r, g, b } = parse(value);
  return `#${pad(r)}${pad(g)}${pad(b)}`;
}

/**
 * @param {string|number[]|{r:number,g:number,b:number}} value
 * @returns {{ r: number, g: number, b: number }}
 */
export function toRgb(value) {
  return parse(value);
}

/**
 * Mezcla hacia el blanco. `amount` va de 0 (sin cambio) a 1 (blanco).
 *
 * @param {string} value
 * @param {number} [amount]
 * @returns {string}
 */
export function lighten(value, amount = 0.1) {
  return mix(value, '#ffffff', amount);
}

/**
 * Mezcla hacia el negro. `amount` va de 0 (sin cambio) a 1 (negro).
 *
 * @param {string} value
 * @param {number} [amount]
 * @returns {string}
 */
export function darken(value, amount = 0.1) {
  return mix(value, '#000000', amount);
}

/**
 * Mezcla dos colores. `weight` es la proporcion del segundo color (0..1).
 *
 * @param {string} a
 * @param {string} b
 * @param {number} [weight]
 * @returns {string}
 */
export function mix(a, b, weight = 0.5) {
  const first = parse(a);
  const second = parse(b);
  const ratio = Math.min(1, Math.max(0, Number(weight)));
  const blend = (left, right) => clamp(left + (right - left) * ratio);
  return toHex([blend(first.r, second.r), blend(first.g, second.g), blend(first.b, second.b)]);
}

/**
 * Luminancia relativa segun WCAG 2.
 *
 * @param {string} value
 * @returns {number} 0..1
 */
export function luminance(value) {
  const { r, g, b } = parse(value);
  const channel = (raw) => {
    const unit = raw / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Devuelve el color de texto que mejor contrasta con el fondo.
 *
 * @param {string} background
 * @param {string} [dark] color para fondos claros
 * @param {string} [light] color para fondos oscuros
 * @returns {string}
 */
export function contrast(background, dark = '#000000', light = '#ffffff') {
  return luminance(background) > 0.5 ? toHex(dark) : toHex(light);
}

export const color = {
  toHex,
  toRgb,
  lighten,
  darken,
  mix,
  contrast,
  luminance,
};

export default color;
