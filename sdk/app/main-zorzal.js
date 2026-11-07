/**
 * Entrada ESM del arranque nuevo de `sdk/index.html`.
 *
 * El manifiesto (`sdk/config/source.json`) la carga con `"module": true` y el
 * loader la inserta como `<script type="module">`. Este modulo solo conecta el
 * loader con `bootstrap.js`:
 *
 *  - si esta el `app` clasico del loader, le registra `start` en su
 *    `afterloadfn`. El loader limpia el body al terminar de cargar el
 *    manifiesto y despues llama a ese callback, asi que montar ahi evita que la
 *    limpieza se lleve puesto el login;
 *  - si la pagina no trae loader, arranca en el acto: el script es un modulo,
 *    por lo que el documento ya esta parseado.
 *
 * `start()` es idempotente, de modo que el arranque no depende de que el loader
 * llegue a llamar al callback.
 */

import { start } from './bootstrap.js';

/** Monta la aplicacion contra el contenedor `#app`. */
function arrancar() {
  return start({ root: '#app' });
}

const clasico = globalThis.app;

if (clasico && typeof clasico.run === 'function') {
  clasico.run(arrancar);
} else {
  arrancar();
}
