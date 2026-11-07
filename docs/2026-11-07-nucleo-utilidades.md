# Nucleo restante: b64, waves, noback y session

Refactor de los cuatro modulos chicos de `sdk/sys/core/` que quedaban con la
logica original. Todos siguen siendo scripts clasicos ES5 de la ruta heredada
(`source-legacy.json`); `session.js` se sigue registrando con
`app.define('sys.core.session', ...)`.

## Resumen

| Modulo | Rol | Cambio principal |
| --- | --- | --- |
| `b64.js` | Base64 UTF-8 (`window.B64`). | UTF-8 real (emoji), validacion de entrada, sin user-agent. |
| `waves.js` | Ripple en clicks (`window.waves`). | `composedPath`/fallback, coordenadas correctas, DOM sin `innerHTML`, `destroy`. |
| `noback.js` | Bloqueo de "atras" y Backspace. | `addEventListener`, History API, sin pisar handlers, `HalconNoBack`. |
| `session.js` | Estado de sesion (`sys.core.session`). | Config lazy, un solo intervalo, storage con fallback, logout limpio. |

## b64.js

Contrato:

```js
B64.encode('hola')       -> 'aG9sYQ=='
B64.decode('aG9sYQ==')   -> 'hola'
B64.toUtf8('á')          -> [195, 161]
B64.fromUtf8('w6E=')     -> [195, 161]
```

- Codifica y decodifica UTF-8 de verdad, incluidos pares surrogados (emoji).
- Los surrogados sueltos se reemplazan por U+FFFD en lugar de generar CESU-8.
- `decode` valida longitud multiplo de 4, alfabeto y padding; lanza
  `InvalidCharacterError` si algo no cierra.
- Ya no usa `navigator.userAgent` ni ramas IE6/7; `ie` e `ieo` quedan en `false`
  por compatibilidad.
- `lookup` se construye en el primer `decode` (igual que antes).

Recomendacion: en codigo nuevo usar `TextEncoder`/`btoa`, o una dependencia
probada. `B64` queda para la ruta heredada.

## waves.js

Contrato:

```js
waves.add({ css: 'btn', effect: 'waves-dark', after: fn });
waves.clear();
waves.duration = 1000;   // ms
waves.service();         // idempotente
waves.destroy();
```

- Usa `event.composedPath()`; si no existe, `event.path`; si tampoco, recorre
  `parentNode`. Ya no depende de una API exclusiva de Chrome.
- Usa `clientX/clientY` contra `getBoundingClientRect()`. La version 1 mezclaba
  `pageX/pageY` con coordenadas de viewport y el ripple quedaba corrido al
  hacer scroll.
- Construye el DOM con `createElement` en vez de `innerHTML`.
- `service()` no duplica el listener y `destroy()` lo retira.
- Ignora selectores sin `css` y no recorre arrays con `for...in`.

Recomendacion: a futuro reemplazar el ripple por CSS (`:active` o una
animacion) y retirar el JS.

## noback.js

Expone `window.HalconNoBack`:

```js
HalconNoBack.install({ blockBack: true, blockBackspace: true, route: 'app.inicio' });
HalconNoBack.uninstall();
HalconNoBack.isInstalled();
HalconNoBack.getRoute();
```

- Normaliza el hash a `#!<ruta>` con `history.replaceState` y agrega **un**
  centinela con `pushState`. No manipula `location.href` con timers de 50 ms.
- Escucha `popstate`/`hashchange` y restaura la ruta actual.
- Se suscribe al evento `route` del helper para seguir la navegacion interna.
- Backspace solo se previene fuera de `INPUT`, `TEXTAREA`, `SELECT` o
  `contenteditable`. No llama `stopPropagation()` para el resto del teclado.
- Ya no pisa `window.onload` ni `window.onhashchange`.
- Si el documento esta cargando, espera `DOMContentLoaded`.
- `uninstall()` retira listeners y suscripcion.

Advertencia de producto: bloquear el boton "atras" es un anti-patron de
accesibilidad y de navegacion. Se conserva por compatibilidad; en la ruta nueva
no se carga. La direccion recomendada es un router real con historial.

## session.js

Contrato heredado conservado:

```js
session.on.login(server)
session.on.logout()
session.on.check()
session.on.check_interval()
session.on.afterCheck(response)
session.on.afterCheckInterval(response)
```

- `config` se relee de `usr.session` en cada operacion (`check`, `key`,
  `timeout`, `intervalKey`, `reloadOnExpire`). La version 1 la congelaba al
  definir el modulo.
- Un solo intervalo por sesion: `startInterval()` limpia el anterior y
  `logout`/fallo lo detienen.
- `logout` ahora borra el token y el intervalo.
- Storage: `__.storage.session` (helper 2.0) y, si no esta, Webix. Si ninguno
  existe, la sesion funciona en memoria del helper y avisa.
- `login`/`afterCheck` toleran `server`/`response` vacios y Webix ausente.
- `afterCheckInterval` sigue recargando la pagina al expirar, pero se puede
  apagar con `usr.session.reloadOnExpire = false`; en ese caso navega al modulo
  denegado.
- Emite `session:state` y `session:message` en `__` para observers.
- Mantiene `app.define('sys.core.session', ...)`.

Recomendacion: en la ruta nueva usar la sesion de `sdk/compat/session-shim.js` y,
a futuro, cookies `HttpOnly` + CSRF en lugar de guardar el objeto de sesion en
`sessionStorage`.

## Verificacion

- `node --test test/b64.test.js test/waves.test.js test/noback.test.js test/session.test.js`
  (33 tests).
- Suite completa: `npm test` (87 tests).
- Firefox real:
  - `core.html`: `B64.encode('á😀')`/roundtrip, ripple creado, sesion online con
    token guardado e intervalo activo.
  - `legacy.html`: `B64`, `waves` y `HalconNoBack` cargan junto a Webix;
    `noBack` queda instalado, `b64Roundtrip` correcto y `wavesSelectors` en 0
    hasta que la app registra selectores.
