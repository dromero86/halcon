/**
 * Capa app de `@halcon/sdk`.
 *
 * Agrega las pantallas de la aplicacion como modulos ESM. No hay registro por
 * nombre: cada consumidor importa la pantalla que monta, y `PAGES` existe solo
 * para verificar que los ids son unicos y que todas exponen `mount`.
 *
 *  - `app.login`: `sdk/compat/pages/login.js`;
 *  - `app.inicio`: `sdk/compat/pages/inicio.js`;
 *  - `app.dashboard`: `sdk/compat/pages/dashboard.js`;
 *  - `app.estado.403`, `app.estado.404`, `app.estado.error` y
 *    `app.estado.cargando`: `sdk/compat/pages/estados.js`;
 *  - `app.abm.clientes_view`: `sdk/compat/pages/clientes_view.js`;
 *  - `app.abm.clientes_form`: `sdk/compat/pages/clientes_form.js`.
 *
 * La capa no monta nada ni toca el DOM por si sola, y no la importa
 * `sdk/src/halcon.js`: el entry del paquete se puede cargar en Node, mientras
 * que estas pantallas son la aplicacion de demostracion.
 */

import * as login from '../../compat/pages/login.js';
import * as inicio from '../../compat/pages/inicio.js';
import * as dashboard from '../../compat/pages/dashboard.js';
import * as estados from '../../compat/pages/estados.js';
import * as clientesView from '../../compat/pages/clientes_view.js';
import * as clientesForm from '../../compat/pages/clientes_form.js';
import { paginaEstado } from '../../compat/pages/estados.js';

/** Pantallas de la aplicacion, en el orden del menu del shell. */
export const PAGES = [login, inicio, dashboard, clientesView, clientesForm];

export function findPage(id) {
  const page = PAGES.find((candidata) => candidata.PAGE_ID === id);
  if (page) return page;
  return paginaEstado(id);
}

export { login, inicio, dashboard, estados, clientesView, clientesForm };
