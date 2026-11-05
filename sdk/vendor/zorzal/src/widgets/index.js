/**
 * Registro de los widgets del core.
 *
 * Importar este modulo (lo hace `src/zorzal.js`) deja los 104 tipos
 * disponibles para `define`, `create` y `mount`.
 */

import './controls.js';
import './boolean-controls.js';
import './text-controls.js';
import './select-controls.js';
import './multi-controls.js';
import './date-controls.js';
import './number-controls.js';
import './color-file-controls.js';
import './layout.js';
import './layouts2.js';
import './data.js';
import './grid.js';
import './containers.js';
import './navigation.js';
import './overlays.js';
import './form-suggest-controls.js';
import './chart.js';
import './visualization.js';
import './media.js';
import './viewers.js';

import { NAVIGATION_WIDGETS } from './navigation.js';
import { OVERLAY_WIDGETS } from './overlays.js';
import { DATE_CONTROLS } from './date-controls.js';
import { NUMBER_CONTROLS } from './number-controls.js';
import { COLOR_FILE_CONTROLS } from './color-file-controls.js';
import { MEDIA_WIDGETS } from './media.js';
import { VIEWER_WIDGETS } from './viewers.js';

export const CORE_WIDGETS = [
  'action',
  'field',
  'textarea',
  'checkbox',
  'toggle',
  'switch',
  'radio',
  'segmented',
  'picker',
  'panel',
  'bar',
  'sheet',
  'dialog',
  'list',
  'card',
  'dataview',
  'grouplist',
  'unitlist',
  'property',
  'timeline',
  'comments',
  'layout',
  'multiview',
  'tabview',
  'accordion',
  'accordionitem',
  'headerlayout',
  'gridlayout',
  'abslayout',
  'align',
  'proxy',
  'spacer',
  'resizer',
  'scrollview',
  'form',
  'htmlform',
  'datalayout',
  'datatable',
  'tree',
  'treetable',
  'filter',
  'text',
  'label',
  'icon',
  'search',
  'texthighlight',
  'richtext',
  'suggest',
  'checksuggest',
  'select',
  'richselect',
  'combo',
  'multicombo',
  'multiselect',
  'multitext',
  'dbllist',
  'forminput',
  'tabbar',
  'gridsuggest',
  'datasuggest',
  'mentionsuggest',
  ...NAVIGATION_WIDGETS,
  ...OVERLAY_WIDGETS,
  ...DATE_CONTROLS,
  ...NUMBER_CONTROLS,
  ...COLOR_FILE_CONTROLS,
  'chart',
  'rangechart',
  'bullet',
  'gage',
  'treemap',
  ...MEDIA_WIDGETS,
  ...VIEWER_WIDGETS,
  'button',
  'carousel',
  'portlet',
  'dashboard',
];
