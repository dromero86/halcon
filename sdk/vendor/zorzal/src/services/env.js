/**
 * env: deteccion de entorno sin dependencias.
 *
 * El objeto `env` se calcula una vez al importar el modulo. `detectEnv(scope)`
 * permite obtener la misma deteccion sobre un scope propio (tests o render en
 * otro contexto) sin tocar globals.
 */

/**
 * @param {{ navigator?: any, window?: any, document?: any, process?: any }} [scope]
 * @returns {string}
 */
function userAgent(scope) {
  const value = scope?.navigator?.userAgent;
  return typeof value === 'string' ? value : '';
}

/**
 * @param {{ navigator?: any, window?: any, document?: any, process?: any }} [scope]
 * @returns {string}
 */
function platform(scope) {
  const value = scope?.process?.platform;
  return typeof value === 'string' ? value : '';
}

/**
 * @param {string} ua
 * @param {string} platformName
 * @returns {string}
 */
function detectOs(ua, platformName) {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  if (/CrOS/i.test(ua)) return 'chromeos';
  if (/Linux/i.test(ua)) return 'linux';
  if (platformName === 'win32') return 'windows';
  if (platformName === 'darwin') return 'macos';
  if (platformName === 'linux') return 'linux';
  return 'unknown';
}

/**
 * @param {string} ua
 * @param {any} navigatorRef
 * @returns {boolean}
 */
function detectMobile(ua, navigatorRef) {
  if (/Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(ua)) return true;
  const touchPoints = Number(navigatorRef?.maxTouchPoints) || 0;
  return /Macintosh/i.test(ua) && touchPoints > 1;
}

/**
 * @param {any} windowRef
 * @param {any} navigatorRef
 * @returns {boolean}
 */
function detectTouch(windowRef, navigatorRef) {
  if (windowRef && 'ontouchstart' in windowRef) return true;
  return (Number(navigatorRef?.maxTouchPoints) || 0) > 0;
}

/**
 * @param {{ navigator?: any, window?: any, document?: any, process?: any }} [scope]
 * @returns {{ browser: boolean, os: string, isMobile: boolean, isTouch: boolean, isServer: boolean }}
 */
export function detectEnv(scope = globalThis) {
  const navigatorRef = scope?.navigator || null;
  const windowRef = scope?.window || null;
  const ua = userAgent(scope);
  const browser = Boolean(windowRef && scope?.document);
  return {
    browser,
    os: detectOs(ua, platform(scope)),
    isMobile: browser ? detectMobile(ua, navigatorRef) : false,
    isTouch: browser ? detectTouch(windowRef, navigatorRef) : false,
    isServer: !browser,
  };
}

export const env = Object.freeze(detectEnv());

export default env;
