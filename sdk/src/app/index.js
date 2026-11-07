/**
 * Capa app de `@halcon/sdk`.
 *
 * Importa las pantallas de la aplicacion para que queden registradas en
 * `app` (el shim de `sdk/compat/app-shim.js`), con el id que cada modulo
 * declara al definirse:
 *
 *  - `app.login`: `sdk/compat/pages/login.js`;
 *  - `app.inicio`: `sdk/compat/pages/inicio.js`;
 *  - `app.estado.403`, `app.estado.404`, `app.estado.error` y
 *    `app.estado.cargando`: `sdk/compat/pages/estados.js`;
 *  - `app.abm.clientes_view`: `sdk/compat/pages/clientes_view.js`;
 *  - `app.abm.clientes_form`: `sdk/compat/pages/clientes_form.js`.
 *
 * El registro es efecto del import: cada pantalla llama a `app.define` al
 * cargarse. La capa no monta nada ni toca el DOM por si sola, y no la importa
 * `sdk/src/halcon.js`: el entry del paquete se puede cargar en Node, mientras
 * que estas pantallas son la aplicacion de demostracion sobre el shim.
 *
 * Uso:
 *
 *   app.require('app.inicio').mount(contenedor);
 *
 * `install(destino)` publica el shim como `app` para el codigo heredado que
 * todavia lo lee del global.
 */

import '../../compat/pages/login.js';
import '../../compat/pages/inicio.js';
import '../../compat/pages/estados.js';
import '../../compat/pages/clientes_view.js';
import '../../compat/pages/clientes_form.js';

export { app, install } from '../../compat/app-shim.js';
