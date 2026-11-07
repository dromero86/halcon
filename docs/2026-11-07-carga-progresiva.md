# Carga progresiva y manifiesto de recursos

`index.html` no nombra ningun archivo de la aplicacion: solo instancia el loader y
le pasa un manifiesto. Todo lo que la pagina carga sale de ahi, en el orden (o el
grafo) que el manifiesto declara. Este documento describe el loader 3.0, el
formato del manifiesto v2, la compatibilidad con v1 y la decision sobre
`app.require` / `app.define`.

## Como funciona el loader

`sdk/sys/core/loader.js` es un script clasico que se instancia a si mismo al
cargarse. La pagina lo invoca asi (es el contenido completo de `sdk/index.html`):

```html
<script src="{url}sdk/sys/core/loader.js?v={rand}"
        bootin="{url}sdk/config/source.json?v={rand}"
        project-path="./sdk/"
        base-url="{url}"></script>
```

- `bootin`: manifiesto a cargar.
- `project-path`: prefijo de todas las rutas del manifiesto, resuelto contra la
  URL del documento. Con `./sdk/` y la pagina en la raiz, `compat/theme.css`
  termina siendo `/sdk/compat/theme.css`.
- `base-url`: base publica de la aplicacion. En produccion la reemplaza el
  backend junto con `{url}` y `{rand}`.
- `data-version` (opcional): sello de build para el cache versionado.
- `data-nonce` (opcional): nonce de CSP para los elementos que crea el loader.
- `data-autoload="false"` (opcional): deja el loader como API, sin arrancar.

Secuencia:

1. `autoload()` lee los atributos del `<script>`, espera `DOMContentLoaded` (o
   sigue si el documento ya esta listo) y llama a `basis()`: metadatos, viewport
   seguro y fondo de carga;
2. pide el manifiesto con `XMLHttpRequest` y lo parsea con `JSON.parse` (sin
   `eval`);
3. normaliza el manifiesto (v1 o v2) y planifica los recursos: en serie por
   omision, o en paralelo con dependencias si `parallel` es `true`;
4. inserta cada recurso en el `<head>` (o lo pide por XHR, segun el tipo);
5. al terminar, `finalize()` retira la piel de carga y ejecuta los callbacks
   registrados con `app.run(fn)`. El body no se vacia salvo que el manifiesto
   declare `"clean": true`.

Un recurso que no existe no corta la cadena: se avisa por consola
(`[sys/core/loader] no se pudo cargar ...`), se anota en `__loader.fails` y se
sigue con el resto. Si `strict` es `true`, el primer fallo obligatorio corta el
arranque.

## Formato del manifiesto v2

Es un objeto con `resources`; el esquema completo esta en
`sdk/config/loader.schema.json`.

```json
{
    "version": "2",
    "cache": { "policy": "versioned" },
    "viewport": { "width": "device-width", "initialScale": 1 },
    "parallel": true,
    "concurrency": 4,
    "clean": false,
    "resources": [
        { "id": "app-config", "type": "json", "url": "config/app.json" },
        { "id": "zorzal", "type": "css", "url": "vendor/zorzal/src/zorzal.css", "cache": "immutable" },
        { "id": "theme", "type": "css", "url": "compat/theme.css", "deps": ["zorzal"] },
        { "id": "app", "type": "module", "url": "app/main-zorzal.js", "deps": ["app-config", "zorzal", "theme"] }
    ]
}
```

| Campo | Descripcion |
| --- | --- |
| `version` | Version del formato. `"2"` para este esquema. |
| `base` | Prefijo de rutas. Si falta se usa `project-path`. |
| `cache` | Politica global: `versioned`, `immutable`, `none`, `reload`, `no-store` o `dev`. |
| `viewport` | `true`, `false`, un string o un objeto con `width`, `initialScale`, `maximumScale`, `minimumScale`, `userScalable` y `fit`. |
| `parallel` | `true` carga en paralelo los recursos sin dependencias. `false` respeta el orden del array. |
| `concurrency` | Maximo de cargas simultaneas en paralelo (1 a 16). |
| `strict` | `true` corta al primer fallo obligatorio. |
| `clean` | `true` vacia el body al terminar. Por omision no toca el HTML. |
| `resources` | Array de recursos. |

Cada recurso acepta:

| Campo | Descripcion |
| --- | --- |
| `id` | Identificador para `deps`, `unload` y diagnostico. Por omision se deriva de la URL. |
| `type` | `script`, `module`, `css`, `json`, `icon`, `template`, `image`, `preload`, `prefetch` o `modulepreload`. `tag` se acepta como alias v1. |
| `url` | Ruta relativa a `base`/`project-path`, o URL absoluta. |
| `cache` | Politica por recurso; `false` agrega un sello unico del arranque. |
| `deps` | Ids que deben estar resueltos antes de cargar este recurso. |
| `media` | Atributo `media` para CSS y pistas de precarga. |
| `condition` | `mobile`, `desktop`, `touch`, `dark`, `light`, `reduced-motion` o una media query. |
| `optional` | Si es `true`, un fallo no marca el arranque como fallido. |
| `retry` / `timeout` | Reintentos y milisegundos antes de abortar. |
| `integrity`, `crossorigin`, `referrerpolicy`, `fetchpriority`, `nonce` | Atributos del elemento. |
| `fallback` | Solo `module`: script clasico si el navegador no soporta ESM. |

### Cache

- `versioned`: agrega `v=<version>` solo si hay version (`data-version` del
  loader o `cache.version` del manifiesto). Sin version no agrega query: manda el
  cache HTTP.
- `immutable` / `none`: no toca la URL.
- `reload` / `no-store` / `dev` / `cache: false`: agrega `_h=<sello>` con un
  unico sello por arranque. No se usa `Date.now()` por recurso.
- `legacy` (solo v1): `cache: true` no agrega nada; `cache: false` recarga.

El manifiesto v1 (`source-legacy.json`) sigue siendo un array de
`{ tag, url, cache, module }`. El loader lo detecta solo y lo convierte al modelo
interno. La ruta heredada se puede levantar con `make legacy`.

## Script clasico contra `module`

Un script clasico se evalua en el ambito global apenas baja y no admite `import`.
En Halcon ese script define su modulo con `app.define(...)`.

Un recurso `module` se inserta como `<script type="module">`:

- los `import` son relativos al propio archivo, no a la pagina;
- no hay variables globales implicitas;
- el evento `load` llega cuando el modulo y todos sus imports ya se evaluaron.

Por eso `app/main-zorzal.js` no monta en el nivel superior: registra el montaje
con `app.run` y corre despues de la limpieza de la piel de carga. `app.run` es
idempotente y, si el loader ya termino, ejecuta el callback en el proximo tick.

## Decision sobre `app.require` / `app.define`

La conclusion del refactor es separar dos responsabilidades que la version 2
mezclaba:

1. **Carga de recursos** (red, cache, orden, viewport): es del loader.
2. **Resolucion de modulos** (navegacion entre pantallas): es de la aplicacion.

En la ruta nueva (ESM) no hace falta un registry de strings:

```js
// pantalla
export function mount(root) { /* ... */ }

// navegacion
const page = await import('./pages/clientes.js');
page.mount(root);
```

`app.define` / `app.require` quedan como **puente de compatibilidad**, no como
mecanismo de carga:

- `define(nombre, factory)` registra una factory. No ejecuta nada.
- `require(nombre)` devuelve el valor si ya esta definido. Si no, carga
  `nombre.replace(/\./g, '/') + '.js'` como script clasico con single-flight
  (dos llamadas simultaneas comparten la misma carga) y, si recibe callback, lo
  llama de forma asincrona.
- Ya no se redescarga el script en cada navegacion: `autorefresh` queda en
  `false` por omision. Si hace falta reevaluar, se usa `__loader.reload(nombre)`.
- `app.import(nombre)` devuelve una `Promise` y es la forma recomendada para
  codigo nuevo que todavia use ids.
- Un nombre sin definicion no inventa una pantalla: avisa y entrega `null`.

Recomendacion a futuro: retirar `define`/`require` de la API publica en la
proxima major. Cada ruta deberia resolver su pantalla con `import()` estatico o
dinamico y el loader deberia quedar reducido a manifiesto, cache, CSS, viewport y
precarga. Mientras la ruta heredada de Webix siga viva, el puente se mantiene.

## Piel de carga y avisos

`basis()` agrega la clase `halcon-booting` a `<html>` y `<body>` y una hoja de
estilos con el logo. `finalize()` retira la clase. Los errores fatales (sin
manifiesto, manifiesto invalido, red caida) se muestran con un aviso en pagina;
ya no se usa `document.write`, que borraba el documento y no funciona con
scripts diferidos.

## Viewport y entorno

- El viewport por omision es `width=device-width, initial-scale=1`. No se
  desactiva el zoom (`user-scalable=no`), que rompe la accesibilidad.
- `set_view_port(initial, maximum, minimum)` conserva la firma heredada, pero
  `basis()` no pasa maximos ni minimos.
- `__loader.environment()` devuelve `width`, `height`, `dpr`, `orientation`,
  `isTouch`, `isMobile`, `isDesktop`, `isIOS`, `reducedMotion`, `colorScheme`,
  `breakpoint` y `language`, sin `navigator.platform`.
- `__loader.watchEnvironment(fn)` observa `matchMedia` y `resize`.
- `__loader.loadStyle`, `loadScript`, `loadModule`, `loadResource`, `preload` y
  `unload` permiten cargar o retirar recursos despues del arranque.

## Volver al manifiesto heredado

El manifiesto anterior quedo guardado sin cambios en
`sdk/config/source-legacy.json`: Webix 7, Font Awesome, waves, los plugins y
`sdk/app/main.js`. Hay dos formas de volver:

1. `make legacy` levanta un servidor que sirve `sdk/index.html` con el `bootin`
   apuntando a `source-legacy.json` y resuelve `{url}` y `{rand}` al vuelo.
2. Copiar `sdk/config/source-legacy.json` sobre `sdk/config/source.json`.

Los archivos de la ruta heredada siguen en el repositorio
(`sdk/sys/core/webix/`, `sdk/sys/plugins/`, `sdk/ui/`). Retirarlos es una
decision aparte: mientras existan, la vuelta atras es un cambio de manifiesto.
