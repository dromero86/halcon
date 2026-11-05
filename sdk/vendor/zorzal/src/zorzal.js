/**
 * zorzal — API publica.
 *
 * Uso minimo:
 *
 *   import { ui } from './src/zorzal.js';
 *   ui.mount('#app', { kind: 'action', text: 'Hola' });
 *
 * Importar este modulo registra los 104 widgets del core. Los servicios se
 * exportan por nombre y, los mas usados, dentro del namespace `ui`.
 */

import './widgets/index.js';

import { define, has, kinds, undefine } from './core/registry.js';
import { Widget, create, mount, resolveTarget } from './core/widget.js';
import { getDocument, hasDocument, h, setDocument, cls } from './core/dom.js';
import { tpl, escapeHtml } from './services/tpl.js';
import { toast } from './services/toast.js';
import { store, createStore } from './services/store.js';
import { storage, createCookieStore } from './services/storage.js';
import { i18n } from './services/i18n.js';
import { color } from './services/color.js';
import { csv } from './services/csv.js';
import { http, request, HttpError } from './services/http.js';
import { date } from './services/date.js';
import { rules } from './services/rules.js';
import { busy } from './services/busy.js';
import { ajax } from './services/ajax.js';
import { promise } from './services/promise.js';
import { env } from './services/env.js';
import { html } from './services/html.js';
import { fullscreen } from './services/fullscreen.js';
import { clipbuffer } from './services/clipbuffer.js';
import { filters } from './services/filters.js';
import { editors } from './services/editors.js';
import { mixins } from './services/mixins.js';
import { icons } from './services/icons.js';
import { webix as compatLayer } from './compat/webix.js';
import { CORE_WIDGETS } from './widgets/index.js';

export const version = '0.1.0';

/**
 * Capa de compatibilidad declarativa. Expone `ui`, `html`, `message`,
 * `storage`, `ajax`, `rules`, `env`, `copy`, `Date`, `protoUI`,
 * `EventSystem`, `event`, `removeEvent`, `extend`, `type`, `Touch`, `ready`
 * y `ProgressBar` sobre el core.
 */
export const compat = compatLayer;

/**
 * Namespace de armado: `define`, `create`, `mount`, `compat` y los servicios.
 * `ui.mount` y `ui.create` son la via recomendada para aplicaciones.
 */
export const ui = {
  define,
  create,
  mount,
  compat,
  tpl,
  toast,
  store,
  storage,
  i18n,
  color,
  csv,
  http,
  date,
  rules,
  busy,
  ajax,
  promise,
  env,
  html,
  fullscreen,
  clipbuffer,
  filters,
  editors,
  mixins,
  icons,
};

export {
  define,
  has as isDefined,
  kinds,
  undefine,
  Widget,
  create,
  mount,
  resolveTarget,
  getDocument,
  hasDocument,
  setDocument,
  h,
  cls,
  tpl,
  escapeHtml,
  toast,
  store,
  createStore,
  storage,
  createCookieStore,
  i18n,
  color,
  csv,
  http,
  request,
  HttpError,
  date,
  rules,
  busy,
  ajax,
  promise,
  env,
  html,
  fullscreen,
  clipbuffer,
  filters,
  editors,
  mixins,
  icons,
  CORE_WIDGETS,
};

export default ui;
