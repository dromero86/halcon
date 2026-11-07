/**
 * PKCE (RFC 7636) para el flujo OAuth del SDK.
 *
 * Modulo puro, sin DOM y sin dependencias de Node: usa `crypto.getRandomValues`
 * para el verificador y `crypto.subtle.digest` para el challenge, las dos APIs
 * disponibles en el navegador y en Node desde la version 20. Se puede importar
 * en un test de Node sin tocar globales del documento.
 *
 * Alfabeto del verificador: base64url sin relleno (`A-Z`, `a-z`, `0-9`, `-`,
 * `_`), que es un subconjunto de los caracteres no reservados que exige PKCE.
 * 64 caracteres queda dentro del rango 43..128 del RFC.
 */

/** Alfabeto base64url. */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Largo por defecto del verificador. */
const LARGO_VERIFICADOR = 64;

/** Largo minimo y maximo que admite PKCE. */
const MINIMO = 43;
const MAXIMO = 128;

/**
 * Fuente de azar criptografico del entorno.
 * @returns {Crypto}
 */
function azar() {
  const fuente = globalThis.crypto;
  if (!fuente || typeof fuente.getRandomValues !== 'function') {
    throw new Error('pkce: falta crypto.getRandomValues en este entorno');
  }
  return fuente;
}

/**
 * Codifica bytes como base64url sin relleno, sin `btoa` ni `Buffer`.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function base64url(bytes) {
  let salida = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const hay1 = i + 1 < bytes.length;
    const hay2 = i + 2 < bytes.length;
    const b1 = hay1 ? bytes[i + 1] : 0;
    const b2 = hay2 ? bytes[i + 2] : 0;
    salida += ALFABETO[b0 >> 2];
    salida += ALFABETO[((b0 & 0x03) << 4) | (b1 >> 4)];
    if (hay1) salida += ALFABETO[((b1 & 0x0f) << 2) | (b2 >> 6)];
    if (hay2) salida += ALFABETO[b2 & 0x3f];
  }
  return salida;
}

/**
 * Cadena aleatoria del alfabeto base64url.
 *
 * Cada byte se reduce modulo 64: 256 es multiplo de 64, asi que el reparto es
 * uniforme y no hay sesgo.
 *
 * @param {number} n largo de la cadena
 * @returns {string}
 */
export function randomString(n = LARGO_VERIFICADOR) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError('randomString: n debe ser un entero positivo');
  }
  const bytes = new Uint8Array(n);
  azar().getRandomValues(bytes);
  let salida = '';
  for (let i = 0; i < n; i += 1) salida += ALFABETO[bytes[i] % 64];
  return salida;
}

/**
 * Verificador PKCE nuevo.
 * @param {number} [largo] entre 43 y 128; por defecto 64
 * @returns {string}
 */
export function createVerifier(largo = LARGO_VERIFICADOR) {
  if (!Number.isInteger(largo) || largo < MINIMO || largo > MAXIMO) {
    throw new RangeError(`createVerifier: el largo debe ser un entero entre ${MINIMO} y ${MAXIMO}`);
  }
  return randomString(largo);
}

/**
 * Challenge S256 del verificador: base64url(SHA-256(verificador)).
 * @param {string} verifier
 * @returns {Promise<string>}
 */
export async function challengeS256(verifier) {
  if (typeof verifier !== 'string' || verifier === '') {
    throw new TypeError('challengeS256: falta el verifier');
  }
  const bytes = new TextEncoder().encode(verifier);
  const resumen = await azar().subtle.digest('SHA-256', bytes);
  return base64url(new Uint8Array(resumen));
}
