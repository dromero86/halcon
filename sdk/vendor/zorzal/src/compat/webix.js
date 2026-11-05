/**
 * Capa de compatibilidad declarativa sobre Zorzal.
 *
 * Expone un objeto `webix` con la superficie que usan las pantallas
 * heredadas. Todo se resuelve con el core y los servicios de Zorzal: no hay
 * dependencias nuevas ni transporte propio.
 *
 * Uso:
 *
 *   import { compat } from './src/zorzal.js';
 *   compat.ui({ view: 'layout', rows: [{ view: 'toolbar', elements: [...] }] });
 *
 * Para exportaciones a planilla queda fuera el formateo xlsx: el servicio
 * `csv` de Zorzal cubre esa necesidad sin dependencias.
 */

import '../widgets/index.js';

import { storage } from '../services/storage.js';
import { ajax } from '../services/ajax.js';
import { rules } from '../services/rules.js';
import { env } from '../services/env.js';

import { EventSystem, event, removeEvent } from './events.js';
import { extend } from './extend.js';
import { protoUI } from './proto.js';
import { ready } from './ready.js';
import { type } from './types.js';
import { Touch } from './touch.js';
import { ProgressBar } from './progress.js';
import { compatHtml } from './html-compat.js';
import { compatDate } from './date-compat.js';
import { message } from './message.js';
import { copy } from './copy.js';
import { translate, ui } from './translate.js';

export {
  EventSystem,
  event,
  removeEvent,
  extend,
  protoUI,
  ready,
  type,
  Touch,
  ProgressBar,
  translate,
  ui,
  message,
  copy,
};

export const webix = {
  ui,
  html: compatHtml,
  message,
  storage,
  ajax,
  rules,
  env,
  copy,
  Date: compatDate,
  protoUI,
  EventSystem,
  event,
  removeEvent,
  extend,
  type,
  Touch,
  ready,
  ProgressBar,
};

export default webix;
