# Integraciones (`sdk/sys/integrations/`)

El nucleo (`sdk/sys/core/`) no conoce SDKs ni protocolos de terceros. Las
integraciones viven aparte, se cargan solo cuando la aplicacion las necesita y
se registran en el helper con una API comun.

## Frontera

| Capa | Responsabilidad | Ejemplos |
| --- | --- | --- |
| `sdk/src` | Paquete ESM nuevo, sin DOM ni globals. | `halcon.js`, plugins, Zorzal. |
| `sdk/sys/core` | Nucleo heredado: loader, helper, sesion. | HTTP, storage, cookies, routing, entorno. |
| `sdk/sys/integrations` | Adaptadores opt-in a servicios/protocolos. | `firebase`, `databot`. |
| `sdk/compat` | Shim Webix/Zorzal para pilotos y migracion. | `app-shim`, `globals`, `session-shim`. |

Regla: si para funcionar hace falta un SDK externo, un protocolo de backend o
una credencial, no va en `core`.

## Registro

`helper.js` expone:

```js
__.integrations;                       // { nombre: implementacion }
__.registerIntegration(nombre, impl);  // registra y publica __.integrations[nombre]
__.getIntegration(nombre);             // implementacion o null
```

`registerIntegration` tambien publica el alias `__[nombre]` si ese nombre esta
libre, para el codigo heredado. Emite el evento `integration`.

## Carga

Desde un manifiesto:

```json
{ "tag": "script", "cache": true, "url": "sys/integrations/firebase.js" }
```

En runtime, despues del arranque:

```js
__loader.loadScript('sys/integrations/firebase.js');
```

`source-legacy.json` carga `databot.js` porque la ruta Webix mantiene los alias
historicos. `source.json` (ruta nueva) no carga ninguna integracion: la
aplicacion decide.

## Integraciones incluidas

### `firebase.js`

- Registra `__.integrations.firebase` y `__.firebase`.
- No inicializa Firebase: usa `__.current.FIREBASE`, que publica la aplicacion.
- API: `add(key, item)`, `on_write(key, callback)`, `ref(key)`.
- Si no hay configuracion, avisa por consola y no lanza.

### `databot.js`

- Registra `__.integrations.databot`.
- Conserva los alias `SQLCombo`, `SQLTable`, `query`, `query_combo` y
  `query_list`.
- Envia `{"action":"databot"}` con SQL desde el cliente.
- **Deprecado**: el SQL y los permisos deben vivir en el backend. Se mantiene
  por compatibilidad, no para codigo nuevo.

## Reglas para una integracion nueva

1. Un archivo por integracion en `sdk/sys/integrations/`.
2. Script clasico ES5, IIFE con guard de doble carga
   (`__halcon<Nombre>Integration`).
3. Depender solo de `__` (`registerIntegration`, `current`, `PAYLOAD`, etc.).
4. Registrar sin pisar un alias existente.
5. Fallar con un mensaje claro si falta `helper.js`; degradar sin lanzar si
   falta configuracion del servicio.
6. No tocar el DOM por si sola ni arrancar conexiones al cargarse.
7. Tests en `test/` con un doble del servicio; no requiere red.
8. Documentar credenciales/configuracion y como se carga en el manifiesto.

## Verificacion

- `node --test test/helper.test.js` cubre el registro y las dos integraciones.
- Firefox real: la ruta heredada carga `helper 2.0 + databot` y deja
  `firebase` en `undefined`; un probe con los tres archivos registra
  `firebase` y `databot`, y `firebase.add` publica contra `current.FIREBASE`.
