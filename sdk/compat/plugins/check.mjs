/**
 * Verificacion de registro de los plugins portados y del shim de `app`.
 *
 * Importa los tres plugins (que registran sus kinds como efecto de modulo),
 * el shim de `app.define`/`app.require`, la pantalla del dashboard, las dos
 * pantallas del ABM de clientes y el shim de sesion. Comprueba:
 *
 *  - que `mainbar`, `formview` y `datalist` existen en el registro de Zorzal;
 *  - que `toExcel` sigue siendo un no-op fuera de alcance;
 *  - que `app.define` y `app.require` existen;
 *  - que el dashboard, `app.abm.clientes_view` y `app.abm.clientes_form`
 *    quedaron registrados y exponen `mount`;
 *  - que una definicion se evalua una sola vez y que un nombre desconocido
 *    falla en lugar de devolver `undefined`;
 *  - que el shim de sesion expone `usr.name`, `usr.menu`, `usr.session.enable`
 *    y `__.current`, `__.isNumber` y `__.session`;
 *  - que el store en memoria de clientes arranca con cinco filas, suma una en
 *    el alta y emite `save`.
 *
 * Sale 0 si todo esta y 1 si falta algo.
 *
 * Uso: node sdk/compat/plugins/check.mjs
 */

import { webix } from '../webix-shim.js';
import './mainbar.js';
import './formview.js';
import './datalist.js';
import { toExcel } from './datalist.js';

import { app } from '../app-shim.js';
import { mount as mountDashboard } from '../pages/dashboard.js';
import { mount as mountClientesView } from '../pages/clientes_view.js';
import { mount as mountClientesForm } from '../pages/clientes_form.js';
import { usr, __ as sessionUtils } from '../session-shim.js';
import * as clientesStore from '../store/clientes.js';

const esperados = ['mainbar', 'formview', 'datalist'];
const faltantes = esperados.filter((kind) => !webix.isDefined(kind));

if (faltantes.length > 0) {
  console.error(`faltan kinds en el registro: ${faltantes.join(', ')}`);
  process.exit(1);
}

for (const kind of esperados) {
  console.log(`ok ${kind}: registrado`);
}

const exportNoop = toExcel({}, { filename: 'check' });
if (exportNoop !== false) {
  console.error('toExcel deberia devolver false (no-op fuera de alcance)');
  process.exit(1);
}
console.log('ok toExcel: no-op devuelve false');

// --- shim de app.define / app.require --------------------------------

if (typeof app.define !== 'function' || typeof app.require !== 'function') {
  console.error('el shim de app no expone define y require');
  process.exit(1);
}
console.log('ok app.define/app.require: presentes');

if (!app.isDefined('app.dashboard')) {
  console.error('app.dashboard no quedo registrado al importar la pagina');
  process.exit(1);
}
console.log('ok app.dashboard: registrado');

const dashboard = app.require('app.dashboard');
if (!dashboard || typeof dashboard.mount !== 'function') {
  console.error('app.require("app.dashboard") no devolvio un objeto con mount');
  process.exit(1);
}
console.log('ok app.dashboard: se puede requerir y expone mount');

const otraVez = app.require('app.dashboard', () => {});
if (otraVez !== dashboard) {
  console.error('app.require volvio a evaluar la definicion del dashboard');
  process.exit(1);
}
console.log('ok app.require: devuelve el mismo resultado y acepta callback');

let ejecuciones = 0;
app.define('check.unica', () => {
  ejecuciones += 1;
  return { ejecuciones };
});
app.require('check.unica');
app.require('check.unica');
if (ejecuciones !== 1) {
  console.error(`la definicion se evaluo ${ejecuciones} veces, deberia ser 1`);
  process.exit(1);
}
console.log('ok app.define: la definicion se evalua una sola vez');

let fallo = false;
try {
  app.require('check.inexistente');
} catch (error) {
  fallo = true;
}
if (!fallo) {
  console.error('app.require de un nombre desconocido deberia fallar');
  process.exit(1);
}
console.log('ok app.require: un nombre desconocido falla');

if (typeof mountDashboard !== 'function') {
  console.error('la pagina del dashboard no exporta mount');
  process.exit(1);
}
console.log('ok dashboard: exporta mount');

// --- pantallas del ABM de clientes ------------------------------------

for (const [id, mountFn] of [
  ['app.abm.clientes_view', mountClientesView],
  ['app.abm.clientes_form', mountClientesForm],
]) {
  if (!app.isDefined(id)) {
    console.error(`${id} no quedo registrado al importar la pagina`);
    process.exit(1);
  }
  const page = app.require(id);
  if (!page || typeof page.mount !== 'function' || typeof mountFn !== 'function') {
    console.error(`app.require("${id}") no devolvio un objeto con mount`);
    process.exit(1);
  }
  console.log(`ok ${id}: registrado y expone mount`);
}

// --- shim de sesion ---------------------------------------------------

if (typeof usr.name !== 'string' || usr.name.trim() === '') {
  console.error('usr.name no es un string no vacio');
  process.exit(1);
}
if (!Array.isArray(usr.menu) || usr.menu.length === 0) {
  console.error('usr.menu no es un array con items');
  process.exit(1);
}
const usrSession = usr.session;
if (!usrSession || typeof usrSession !== 'object' || typeof usrSession.enable !== 'boolean') {
  console.error('usr.session no expone enable booleano');
  process.exit(1);
}
console.log(`ok usr: name="${usr.name}", menu=${usr.menu.length} items, session.enable=${usrSession.enable}`);

const idsMenu = [];
const indexar = (items) => {
  for (const item of items) {
    if (item && item.id) idsMenu.push(item.id);
    if (item && Array.isArray(item.items)) indexar(item.items);
    if (item && Array.isArray(item.children)) indexar(item.children);
  }
};
indexar(usr.menu);
if (!idsMenu.includes('app.abm.clientes_view')) {
  console.error('usr.menu no incluye app.abm.clientes_view (el dashboard no puede navegar a Clientes)');
  process.exit(1);
}
console.log('ok usr.menu: incluye app.abm.clientes_view');

if (!sessionUtils || typeof sessionUtils !== 'object') {
  console.error('session-shim no expone __');
  process.exit(1);
}
if (!sessionUtils.current || typeof sessionUtils.current !== 'object') {
  console.error('__.current no es un objeto');
  process.exit(1);
}
if (typeof sessionUtils.isNumber !== 'function') {
  console.error('__.isNumber no es una funcion');
  process.exit(1);
}
if (sessionUtils.isNumber('42') !== true || sessionUtils.isNumber('4x') !== false) {
  console.error('__.isNumber no respeta la semantica de sdk/sys/core/helper.js');
  process.exit(1);
}
if (sessionUtils.session === undefined) {
  console.error('__.session no esta expuesto');
  process.exit(1);
}
console.log('ok __: current, isNumber y session presentes');

// --- store en memoria de clientes -------------------------------------

const iniciales = clientesStore.list();
if (iniciales.length !== 5) {
  console.error(`el store arranca con ${iniciales.length} filas, deberia arrancar con 5`);
  process.exit(1);
}
let guardados = 0;
const desuscribir = clientesStore.on('save', () => {
  guardados += 1;
});
const guardado = clientesStore.save({
  apellido: 'Lopez',
  nombre: 'Ana',
  addr: 'Rivadavia 1',
  doc: '36000111',
  tel: '11 5555-1006',
  id_cobrador: '3',
});
desuscribir();
if (!guardado || clientesStore.list().length !== 6) {
  console.error('el alta no dejo seis filas en el store');
  process.exit(1);
}
if (guardados !== 1) {
  console.error(`el store emitio ${guardados} veces "save", deberia emitir 1`);
  process.exit(1);
}
if (guardado.cliente !== 'Lopez Ana' || guardado.cobrador !== 'Diaz Carla') {
  console.error('el store no calculo las columnas derivadas cliente/cobrador');
  process.exit(1);
}
console.log('ok store: 5 filas, el alta deja 6 y emite save');
clientesStore.reset();

process.exit(0);
