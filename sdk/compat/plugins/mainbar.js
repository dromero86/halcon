/**
 * Plugin `mainbar` portado a modulo ES sobre el shim de Zorzal.
 *
 * Origen: `sdk/sys/plugins/mainbar.js` (Webix + globales de la aplicacion).
 * El port conserva la estructura del original: un `toolbar` con el logo, el
 * boton que colapsa la barra lateral, la caja de busqueda y el boton de
 * opciones. Lo que cambia es el registro (`webix.protoUI` del shim), los
 * imports (shim y stubs) y la forma de tocar el logo, porque el shim no monta
 * vistas dentro de una vista.
 *
 * Limitaciones conocidas (ver `sdk/compat/README.md`):
 *  - la plantilla del logo es de texto: no se interpreta HTML;
 *  - el colapso cambia el contenido del logo y una clase CSS, no el ancho real;
 *  - `_sidebar` no existe en el piloto: si la vista no esta montada se avisa y
 *    se omite el toggle.
 */

import { webix } from '../webix-shim.js';
import { usr, __ } from '../globals.js';

const LOGO_ID = '_mb_logo';
const SIDEBAR_ID = '_sidebar';

/**
 * Handler que puede reemplazar el toggle lateral. Lo usa el dashboard para
 * abrir el drawer en pantallas angostas; si devuelve `false` se aplica el
 * comportamiento normal (colapsar el sidebar).
 * @type {null | (() => boolean)}
 */
let sidebarToggleOverride = null;

/**
 * Registra un reemplazo para el toggle lateral. Pasar `null` lo quita.
 * @param {null | (() => boolean)} handler
 */
export function setSidebarToggle(handler) {
  sidebarToggleOverride = typeof handler === 'function' ? handler : null;
}

/**
 * Cambia el contenido del logo. El original volvia a montar un `template`
 * dentro del mismo id con otro ancho; aca se actualiza la vista y se marca la
 * clase que el CSS usa para el estado colapsado.
 *
 * @param {boolean} collapsed
 */
function paintLogo(collapsed) {
  const logo = webix.$$(LOGO_ID);
  if (!logo || typeof logo.set !== 'function') {
    console.warn('[mainbar] el logo no esta montado: se omite el cambio');
    return;
  }
  logo.set({ value: { name: collapsed ? 'GN' : usr.name.toUpperCase() } });
  if (logo.el && logo.el.classList) logo.el.classList.toggle('main_logo--collapsed', collapsed);
}

/**
 * Alterna la barra lateral. En la aplicacion `_sidebar` es otra vista; en el
 * piloto no existe, asi que se avisa una vez por clic.
 */
function toggleSidebar() {
  if (sidebarToggleOverride && sidebarToggleOverride() === true) return;
  const sidebar = webix.$$(SIDEBAR_ID);
  if (sidebar && typeof sidebar.toggle === 'function') {
    sidebar.toggle();
    return;
  }
  console.warn(`[mainbar] $$("${SIDEBAR_ID}") no esta montado: se omite el toggle lateral`);
}

webix.protoUI(
  {
    name: 'mainbar',
    defaults: {},

    /**
     * @param {Record<string, any>} config
     */
    $init(config) {
      __.current.mb = { open: true };

      config.css = 'main-toolbar';
      config.height = 70;
      config.borderless = true;
      config.elements = [
        {
          id: LOGO_ID,
          css: 'main_logo',
          template: '#name#',
          data: { name: usr.name.toUpperCase() },
          borderless: true,
          width: 250,
        },
        {
          id: '_main_btn_action',
          view: 'button',
          type: 'icon',
          icon: 'bars',
          align: 'center',
          css: 'acople',
          width: 56,
          click() {
            const state = __.current.mb;

            if (state.open === true) {
              paintLogo(true);
              state.open = false;
            } else {
              paintLogo(false);
              state.open = true;
            }

            toggleSidebar();
          },
        },
        {
          id: '_main_search',
          css: 'acople input-text',
          width: 440,
        },
        { css: 'acople' },
        {
          id: '_main_tool_option',
          view: 'button',
          type: 'icon',
          icon: 'ellipsis-v',
          align: 'right',
          css: 'acople',
          width: 56,
        },
      ];
    },
  },
  webix.ui.toolbar
);

export default 'mainbar';
