/**
 * `@halcon/sdk` — punto de entrada unico de Halcon sobre Zorzal.
 *
 * El paquete no define un motor propio: compone sus capas.
 *
 *  - `./core/index.js`: API publica de Zorzal (vendorizado en
 *    `sdk/vendor/zorzal`), `register` e `init`;
 *  - `./widgets/index.js`: registro de los plugins de Halcon (`mainbar`,
 *    `formview`, `datalist`) como kinds del mismo registro.
 *
 * Este modulo solo reexporta: no agrega logica de montaje ni de registro.
 *
 * Importar este modulo no toca el DOM: no lee ni escribe globals, no requiere
 * `window` ni `document`, y se puede cargar en Node para tests.
 *
 * Uso:
 *
 *   import { init } from '@halcon/sdk';
 *   init({ el: '#app', kind: 'mainbar', ... });
 *
 *   import { init } from '@halcon/sdk';
 *   init({ el: '#app', spec: { kind: 'action', text: 'Hola' } });
 */

import { icons } from './core/index.js';

export { ui, create, define, kinds, init, VERSION } from './core/index.js';

// El reexport evalua la capa de widgets: sus imports dejan registrados
// `mainbar`, `formview` y `datalist` como kinds de Zorzal. De la capa solo se
// publica `register`.
export { register } from './widgets/index.js';

/**
 * Servicio de iconos de Zorzal, expuesto por nombre.
 *
 * Zorzal publica el servicio en el namespace `icons` de su entrada publica; el
 * paquete lo aplana para que el consumidor no dependa de la forma interna.
 */
export const getIcon = icons.getIcon;
export const hasIcon = icons.hasIcon;
export const addIcon = icons.addIcon;
export const iconNames = icons.iconNames;
