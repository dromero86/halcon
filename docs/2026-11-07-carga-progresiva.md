# Carga progresiva y manifiesto de recursos

`index.html` no nombra ningun archivo de la aplicacion: solo instancia el loader y
le pasa un manifiesto. Todo lo que la pagina carga sale de ahi, en el orden en
que el manifiesto lo declara. Este documento describe ese mecanismo, el formato
del manifiesto y las dos rutas de arranque que conviven hoy.

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

Secuencia:

1. `autoload()` espera `DOMContentLoaded` y llama a `basis()`, que agrega los
   metadatos, fija el viewport y pinta el fondo de carga;
2. pide el manifiesto con `XMLHttpRequest`;
3. `stairs()` lo recorre en orden con `shift()` y `load()` inserta cada recurso
   en el `<head>` (o lo pide por ajax, segun el tag);
4. el callback de cada recurso encadena el siguiente, de modo que un script solo
   se evalua cuando el anterior ya esta cargado;
5. al terminar el ultimo, `finalize()` limpia el fondo de carga y el body, y
   llama al callback registrado con `app.run(fn)`.

El ultimo paso es el punto de entrada de la aplicacion: el codigo que arranca la
interfaz se registra con `app.run` y corre despues de la limpieza, con el body
vacio.

Un recurso que no existe no corta la cadena. El loader avisa por consola
(`[sys/core/loader] no se pudo cargar ...`), lo anota en `__loader.fails` y sigue
con el recurso siguiente. Lo mismo vale para un manifiesto o un `json`/`template`
que responde 404: se avisa y la carga sigue.

## Formato del manifiesto

Es un array JSON de objetos. Cada objeto declara un recurso:

```json
{ "tag": "link", "cache": true, "url": "compat/theme.css" }
```

| Campo | Obligatorio | Descripcion |
| --- | --- | --- |
| `tag` | si | Que se crea: `script`, `link`, `json`, `icon`, `template` o `image`. |
| `url` | si | Ruta relativa a `project-path`. |
| `cache` | no | `false` agrega `refresh=<hash>` a la URL. Por omision se cachea. |
| `module` | no | Solo para `script`. `true` lo carga como modulo ESM. |

Comportamiento por tag:

- `script`: agrega un `<script>` con `src`. Un script clasico recibe ademas el
  atributo `module` con el nombre del archivo en forma de modulo
  (`sys.core.helper`), que es lo que usa `app.require`;
- `link`: agrega un `<link rel="stylesheet">`;
- `json`: pide el archivo por ajax y copia las claves al objeto `usr` del loader;
- `icon`: agrega el `<link rel="shortcut icon">`;
- `template`: pide el archivo por ajax y lo guarda en `__.templates` con el
  nombre del modulo;
- `image`: precarga la imagen.

El orden del array es el orden de carga. Un manifiesto no es un grafo de
dependencias: si un recurso necesita otro, va despues.

## Script clasico contra `module: true`

Un script clasico se evalua en el ambito global apenas baja y no admite `import`.
En Halcon ese script define su modulo con `app.define(...)` y el loader lo marca
con el atributo `module` para que `app.require` lo encuentre.

Un script con `"module": true` se inserta como `<script type="module">`, sin el
atributo `module` calculado, y el navegador lo evalua como modulo ES:

- los `import` son relativos al propio archivo, no a la pagina;
- no hay variables globales implicitas;
- el script se ejecuta diferido y el evento `load` llega cuando el modulo y todos
  sus imports ya se evaluaron.

Esa ultima diferencia importa para el arranque: el `load` del modulo dispara
`finalize()`, que vacia el body. Por eso `main-zorzal.js` no monta nada en el
nivel superior, sino que registra el montaje con `app.run` y corre despues de la
limpieza.

## Que carga la ruta nueva

`sdk/config/source.json` es hoy:

```json
[
    { "tag" : "json"   , "cache": true, "url": "config/app.json" },
    { "tag" : "icon"   , "cache": true, "url": "ui/img/favicon.ico" },
    { "tag" : "link"   , "cache": true, "url": "vendor/zorzal/src/zorzal.css" },
    { "tag" : "link"   , "cache": true, "url": "compat/theme.css" },
    { "tag" : "script" , "cache": true, "url": "app/main-zorzal.js", "module": true }
]
```

- `vendor/zorzal/src/zorzal.css` y `compat/theme.css` son el estilo del motor
  Zorzal y el theme de Halcon;
- `app/main-zorzal.js` es un modulo ESM que importa `sdk/app/bootstrap.js` y
  arranca la aplicacion contra `#app`;
- `bootstrap.js` instala el shim de `app`, el shim de sesion, registra las
  pantallas y monta `app.login` mientras la sesion es anonima, o el shell del
  dashboard cuando esta autenticada. Es la misma puesta en marcha del piloto,
  con las mismas piezas (`sesionDelPiloto`, `dashboard.mount`, `app.require`) y
  sin copiar su logica.

No hay ninguna referencia a Webix, Font Awesome, waves, mainbar, datalist,
formview ni cards: esos recursos ya no forman parte del arranque por defecto.

En desarrollo, `sdk/index.html` necesita que alguien reemplace `{url}` y `{rand}`
(lo hace el backend en produccion). `make serve` sirve la pagina en `/` con esos
placeholders resueltos, que es la entrada de la ruta nueva; servida tal cual por
un servidor de archivos estaticos, la pagina no arranca porque las rutas
relativas quedan colgadas de `/sdk/`.

## Volver al manifiesto heredado

El manifiesto anterior quedo guardado sin cambios en
`sdk/config/source-legacy.json`: Webix 7, Font Awesome, waves, los plugins y
`sdk/app/main.js`. Hay dos formas de volver:

1. `make legacy` levanta un servidor que sirve `sdk/index.html` con el `bootin`
   apuntando a `source-legacy.json` y resuelve `{url}` y `{rand}` al vuelo. La
   aplicacion abre en `http://<bind>:<puerto>/` con el arranque heredado.
2. Volver el manifiesto por defecto: copiar `sdk/config/source-legacy.json`
   sobre `sdk/config/source.json`. Es el mismo contenido, pero deja de ser una
   copia de respaldo y pasa a ser el manifiesto que carga `index.html`.

`make legacy` tambien redirige `/sdk/index.html` a `/`, porque
`project-path="./sdk/"` se resuelve contra la URL del documento y solo da
`./sdk/` cuando la pagina se sirve en la raiz.

Los archivos de la ruta heredada siguen en el repositorio
(`sdk/sys/core/webix/`, `sdk/sys/plugins/`, `sdk/ui/`). Retirarlos es una
decision aparte: mientras existan, la vuelta atras es un cambio de manifiesto.
