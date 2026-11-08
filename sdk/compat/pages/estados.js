/**
 * Paginas de soporte de Halcon sobre el widget set de Zorzal.
 *
 * Cuatro estados que la aplicacion muestra cuando no hay pantalla que montar
 * o cuando la peticion no salio como se esperaba:
 *
 *  - `app.estado.403`: acceso denegado;
 *  - `app.estado.404`: ruta inexistente;
 *  - `app.estado.error`: error de la aplicacion;
 *  - `app.estado.cargando`: espera mientras llega el contenido.
 *
 * Cada una queda registrada en el shim de `app` con la misma forma que el
 * resto de las pantallas (`{ mount }`), asi que se pueden montar por separado
 * desde cualquier ruta y tambien desde el dashboard como cualquier otra
 * pantalla.
 *
 * Todas comparten la misma estructura: icono del set de Zorzal, titulo,
 * mensaje y la accion `Volver al inicio`, que remonta `app.inicio`.
 *
 * Uso:
 *
 *   import { mount } from './pages/estados.js';
 *   mount(document.querySelector('#contenido'), '404');
 *
 * `mount(host, { onHome })` permite que quien navega se haga cargo del
 * regreso al inicio; sin `onHome` la pagina remonta `app.inicio` en el mismo
 * contenedor.
 */

import { create } from '../../vendor/zorzal/src/zorzal.js';
import { renderIcon } from '../icons.js';
import { mount as mountInicio, PAGE_ID as INICIO_ID } from './inicio.js';

/** Id de la pantalla de inicio, destino de la accion `Volver al inicio`. */
export const HOME_ID = INICIO_ID;

/** Texto de la accion que vuelve al inicio. */
export const ACCION_VOLVER = 'Volver al inicio';

/**
 * Los cuatro estados, en el orden en que se muestran en el piloto.
 * @type {{ codigo: string, id: string, titulo: string, mensaje: string, icono: string, tono: string }[]}
 */
export const ESTADOS = [
  {
    codigo: '403',
    id: 'app.estado.403',
    titulo: 'Acceso denegado',
    mensaje: 'Tu usuario no tiene permiso para ver esta pantalla. Pedile acceso al administrador.',
    icono: 'power-off',
    tono: '#b7791f',
  },
  {
    codigo: '404',
    id: 'app.estado.404',
    titulo: 'Pagina no encontrada',
    mensaje: 'La ruta que pediste no existe o se movio. Revisa el enlace o volve al inicio.',
    icono: 'question',
    tono: '#5b6676',
  },
  {
    codigo: 'error',
    id: 'app.estado.error',
    titulo: 'Algo salio mal',
    mensaje: 'La pantalla no pudo cargarse. Volve a intentarlo desde el inicio; si sigue igual, avisanos.',
    icono: 'flag',
    tono: '#c0392b',
  },
  {
    codigo: 'cargando',
    id: 'app.estado.cargando',
    titulo: 'Cargando',
    mensaje: 'Estamos preparando el contenido. Esto tarda unos segundos.',
    icono: 'cog',
    tono: '#1f9d55',
  },
];

/**
 * Estado por codigo. Acepta `403`, `404`, `error` y `cargando`.
 * @param {unknown} codigo
 * @returns {(typeof ESTADOS)[number]|null}
 */
export function estadoPorCodigo(codigo) {
  const clave = codigo === undefined || codigo === null ? '' : String(codigo);
  return ESTADOS.find((estado) => estado.codigo === clave) || null;
}

/**
 * Crea un elemento con clase y texto opcionales.
 * @param {Document} doc
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function nodo(doc, tag, className, text) {
  const el = doc.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * Aplica un mapa de estilos inline.
 * @param {HTMLElement} el
 * @param {Record<string, string>} estilos
 */
function estilo(el, estilos) {
  for (const [propiedad, valor] of Object.entries(estilos)) el.style[propiedad] = valor;
}

/**
 * Vacia un contenedor, para remontar otra pantalla en el mismo nodo.
 * @param {Element} host
 */
function vaciar(host) {
  while (host.firstChild) host.removeChild(host.firstChild);
}

/**
 * Vuelve al inicio: delega en `options.onHome` si existe y, si no, remonta
 * `app.inicio` en el mismo contenedor.
 *
 * @param {Element} host
 * @param {{ onHome?: () => unknown }} options
 * @returns {unknown}
 */
function volverAlInicio(host, options) {
  if (typeof options.onHome === 'function') return options.onHome();
  vaciar(host);
  return mountInicio(host);
}

/**
 * Monta una pagina de estado dentro de `host`.
 *
 * @param {Element|string} host contenedor o selector
 * @param {(typeof ESTADOS)[number]} estado
 * @param {{ onHome?: () => unknown }} [options]
 * @returns {{ root: Element, accion: any, irAlInicio: () => unknown, destroy: () => void }}
 */
function montar(host, estado, options = {}) {
  const target = typeof host === 'string' ? document.querySelector(host) : host;
  if (!target || typeof target.appendChild !== 'function') {
    throw new Error('estados.mount: falta el contenedor');
  }
  const doc = target.ownerDocument || document;

  const root = nodo(doc, 'div', 'hc-page hc-page--estado');
  root.setAttribute('data-estado', estado.codigo);
  root.setAttribute('data-page', estado.id);
  root.setAttribute('role', estado.codigo === 'error' ? 'alert' : 'region');
  if (estado.codigo === 'cargando') root.setAttribute('aria-busy', 'true');
  estilo(root, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '10px',
    maxWidth: '520px',
    padding: '22px 20px',
    border: '1px solid #d7dce3',
    borderLeft: `4px solid ${estado.tono}`,
    borderRadius: '8px',
    background: '#fff',
  });
  target.appendChild(root);

  const icono = nodo(doc, 'span', 'hc-page__icono');
  icono.setAttribute('aria-hidden', 'true');
  estilo(icono, { display: 'inline-flex', width: '32px', height: '32px', color: estado.tono });
  icono.appendChild(renderIcon(estado.icono, { doc }));
  root.appendChild(icono);

  const titulo = nodo(doc, 'h2', 'hc-page__titulo', estado.titulo);
  titulo.id = `estado-${estado.codigo}-titulo`;
  estilo(titulo, { margin: '0', fontSize: '18px' });
  root.appendChild(titulo);
  root.setAttribute('aria-labelledby', titulo.id);

  const mensaje = nodo(doc, 'p', 'hc-page__mensaje', estado.mensaje);
  estilo(mensaje, { margin: '0', color: '#3d4757' });
  root.appendChild(mensaje);

  const accion = create({
    kind: 'button',
    text: ACCION_VOLVER,
    icon: 'chevron-left',
    on: { click: () => volverAlInicio(target, options) },
  });
  accion.el.setAttribute('aria-label', ACCION_VOLVER);
  root.appendChild(accion.el);

  return {
    root,
    accion,
    irAlInicio: () => volverAlInicio(target, options),
    destroy() {
      accion.destroy();
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

/**
 * Monta el estado por codigo. Es el punto de entrada cuando el codigo llega
 * como dato (por ejemplo, desde la respuesta del backend).
 *
 * @param {Element|string} host
 * @param {unknown} codigo
 * @param {{ onHome?: () => unknown }} [options]
 * @returns {ReturnType<typeof montar>}
 */
export function mount(host, codigo = '404', options = {}) {
  const estado = estadoPorCodigo(codigo);
  if (!estado) throw new Error(`estados.mount: codigo de estado desconocido "${String(codigo)}"`);
  return montar(host, estado, options);
}

/**
 * Busca un estado por su id de pantalla.
 * @param {unknown} id
 * @returns {(typeof ESTADOS)[number] | null}
 */
export function estadoPorId(id) {
  return ESTADOS.find((estado) => estado.id === id) || null;
}

/**
 * Envuelve un estado con la misma forma que devolvia el registro de `app`.
 * @param {unknown} id
 * @returns {{ estado: (typeof ESTADOS)[number], mount: (host: unknown, options?: Record<string, unknown>) => unknown } | null}
 */
export function paginaEstado(id) {
  const estado = estadoPorId(id);
  if (!estado) return null;
  return { estado, mount: (host, options) => montar(host, estado, options || {}) };
}

export default { ESTADOS, mount, estadoPorCodigo };
