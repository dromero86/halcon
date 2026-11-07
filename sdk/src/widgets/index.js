/**
 * Capa widgets de `@halcon/sdk`.
 *
 * Importa los plugins de Halcon para que queden registrados como kinds de
 * Zorzal al cargar la capa:
 *
 *  - `mainbar`: barra superior con logo, busqueda y menu;
 *  - `formview`: formulario sobre un esquema de campos;
 *  - `datalist`: listado sobre una coleccion de filas.
 *
 * El registro es efecto del import; los plugins no se reexportan. La unica
 * API que expone la capa es `register`, para que quien importa `./widgets`
 * pueda sumar sus propios kinds sin bajar al core.
 *
 * Importar este modulo no toca el DOM por si solo: los plugins definen los
 * kinds y recien pintan cuando se monta una instancia.
 *
 * Uso:
 *
 *   import { register } from '@halcon/sdk';
 *   register('mi-widget', (ctx) => ({ el: nodoRaiz() }));
 */

import '../plugins/mainbar.js';
import '../plugins/formview.js';
import '../plugins/datalist.js';

export { register } from '../core/index.js';
