# Shim de compatibilidad Webix sobre Zorzal

`sdk/compat/webix-shim.js` es un módulo ES que carga la capa declarativa
vendorizada de Zorzal y publica `window.webix` y `window.$$`. Sirve para
ejecutar pantallas escritas con la forma de Webix (`{ view, rows, cols,
elements }`) sin cargar el SDK de Webix.

Zorzal vive en `sdk/vendor/zorzal/` (copia de `src/` del proyecto Zorzal más un
`package.json` con `type: module` y sin dependencias; incluye
`src/services/icons.js`, el set SVG que dibujan los iconos de Halcón). Halcón
se sirve solo: no hay rutas que apunten fuera del repositorio.

## Cómo se sirve el piloto

El piloto usa módulos ES, así que necesita HTTP; `file://` no resuelve imports
entre archivos. Desde la raíz del repositorio:

    python3 -m http.server 8080

Y se abre:

    http://localhost:8080/sdk/pilot.html

También sirve cualquier servidor estático que respete las rutas relativas
(nginx, `npx serve`, el propio servidor de la aplicación). El piloto no
depende de `sdk/index.html` ni del loader de Halcón.

`sdk/pilot.html` muestra un panel de estado con tres valores (`cargando`, `ok`,
`error`) y el detalle de cada paso: import del shim, montaje del layout, ids
resueltos por `$$` y valor leído del campo de texto. Los errores de carga,
las promesas rechazadas y un montaje que no termina en 10 segundos quedan
escritos en ese panel, sin necesidad de abrir la consola.

`sdk/pilot-plugins.html` monta los tres plugins portados (`mainbar`,
`formview` y `datalist`) sobre el shim, con datos de ejemplo, y usa el mismo
panel de estado para verificar el resultado: kinds registrados, widgets
resueltos por `$$`, filas de la tabla, título del formulario y botón de
guardado habilitado. También cuenta los `svg` de icono de los botones y
confirma que no queden elementos `i.fa`. Con `?probar=1` además ejercita los
flujos de escritura:

    http://localhost:8080/sdk/pilot-plugins.html?probar=1

Ese modo hace clic en el botón de guardado del `formview` (evento
`onFormSubmmited`), llama a `export_to_excel()` del `datalist` (no-op) y
alterna el logo del `mainbar`.

`sdk/pilot-dashboard.html` monta el dashboard migrado
(`compat/pages/dashboard.js`) y las dos pantallas del ABM de clientes
(`compat/pages/clientes_view.js` y `compat/pages/clientes_form.js`) sobre el
menu y la sesion del session shim (`compat/session-shim.js`). El menu demo
tiene dos secciones con hijos y dos items sin hijos; la seccion Operaciones
incluye Clientes, que navega a `app.abm.clientes_view`. El panel de estado
verifica el montaje y el recorrido completo: sidebar nativo, ítem activo,
contenido con el nombre seleccionado, popup de submenú de una sección,
navegación a un hijo y resolución de la pantalla por `app.require`. Despues
recorre el ABM: columnas de la tabla, cinco filas, orden por Cliente, doble
clic que abre el formulario precargado, edición que actualiza sin agregar
filas, alta con validación de obligatorios y sexta fila en la tabla:

    http://localhost:8080/sdk/pilot-dashboard.html

El piloto carga `compat/theme.css` desde el propio repositorio, dibuja los
iconos del menú como `svg` del set de Zorzal y agrega una tabla visible con el
mapeo de los nombres. Además del recorrido, el panel comprueba que los dos
botones con icono de la mainbar rendericen un `svg` y no dejen el nombre del
icono como texto suelto, que el sidebar tenga sus ocho iconos dibujados, que el
submenú use el template `#icon#`, que la página no cargue ninguna hoja de
iconos externa y que no queden elementos `i.fa`.

No hay modo `?probar=1`: el piloto ejercita los flujos solo, en orden, al
montar. La única acción manual es hacer clic en los ítems del sidebar.

## Responsive

Zorzal no trae un sistema de breakpoints ni media queries en su CSS: los
layouts son flex (`min-width: 0`), el sidebar expone `collapse`, `expand` y
`toggle`, y `env` informa `isMobile`/`isTouch`. La adaptación vive en la capa
de Halcón:

- `compat/pages/dashboard.js`: media query de 900 px, drawer con backdrop, y
  restauración del estado de colapso al volver a escritorio.
- `compat/theme.css`: estilos del drawer y ajustes de tabla, formularios y
  mainbar.

Comportamiento:

- **≤ 900 px**: el sidebar sale del flujo y se abre como drawer desde el botón
  de la mainbar; se cierra al elegir una hoja, con `Escape` o tocando el
  backdrop. Las ramas se expanden inline, sin popup. La tabla de Clientes hace
  scroll horizontal dentro de su panel.
- **≤ 640 px**: mainbar compacta (logo reducido, sin caja de búsqueda),
  paddings y tipografía más chicos, y botones de al menos 44 px.
- **> 900 px**: se conserva el colapso normal del sidebar y el popup de
  submenú.

El piloto detecta el viewport y verifica el comportamiento que corresponde
(drawer en mobile, colapso y popup en escritorio).

## Superficie cubierta

`webix.ui(spec, container?)` traduce el spec declarativo a Zorzal y lo monta.
Vistas soportadas:

- `layout` (`rows` / `cols`, vertical u horizontal)
- `toolbar` con `elements`, separadores (`-`, `|`, `{ view: 'separator' }`),
  botones con `click`, etiquetas y grupos
- `button` (`value`/`label`, `variant`, `disabled`, `icon`). Un `icon` de
  texto se monta como `svg` del set de Zorzal (kind `hc-icon`) dentro de
  `.z-button__icon`, no como texto.
- `text` (`value`, `label`, `placeholder`, `maxlength`, `on.change`)
- `label`
- `list` (`data` u `options` en array u objeto, `select`, `compact`)
- `list` con `template`: se monta como `unitlist` de Zorzal, que es el widget
  con plantilla por elemento dentro de una lista. Los marcadores `#clave#` se
  convierten a `{{ clave }}`. Si el template incluye `#icon#` (o
  `{{ icon }}`), el icono se renderiza como `svg` y no como texto.
- `form` (`elements`, `rules`, `disabled`)
- `template` (`template` con `#clave#` o `{{ clave }}`, `value`/`data`)
- `window` (`body`, `head`, `modal`, `width`, `height`)
- Una vista desconocida se degrada a `template` con su texto: una pantalla
  incompleta no rompe el montaje.

Además reexporta lo que ya expone la capa de Zorzal: `html`, `message`,
`storage`, `ajax`, `rules`, `env`, `copy`, `Date`, `protoUI`, `EventSystem`,
`event`, `removeEvent`, `extend`, `type`, `Touch`, `ready` y `ProgressBar`.

Extensiones propias del shim, agregadas para portar plugins:

- `webix.protoUI(config, base)` con la forma de Webix. Acepta `name`,
  `defaults`, `methods`, funciones sueltas, `$init(config)` y `<clave>_setter`.
  `$init` corre antes de construir la vista base, con `this` en la instancia;
  los setters corren antes de `$init`. Las funciones que el plugin empuja a
  `this.$ready` corren después del montaje, en una microtarea. `base` puede ser
  un nombre de kind o un marcador como `webix.ui.toolbar` / `webix.ui.layout`.
  La config Webix del plugin (`view`, `rows`, `elements`, `items`) se traduce
  con la misma capa que `ui()` y los `id` se propagan al árbol traducido.
- Las instancias creadas con `protoUI` exponen `config` (alias de `props`),
  `$view` (el elemento raíz) y `callEvent(type, params)`. `callEvent` emite
  `type`: si `params` trae un solo valor lo emite suelto y si trae varios emite
  el array.
- `webix.isDefined(kind)` consulta el registro de Zorzal.
- `normalizeSpec(spec)` aplica la misma traducción que `ui()` sin montar nada.
  Sirve para armar contenido que consume otro widget (por ejemplo el cuerpo de
  un popup), donde `ui()` no interviene.
- El kind propio `hc-icon` dibuja un `svg` de 24x24 con los paths del set de
  Zorzal a partir de un nombre de icono. Lo usan los botones y las plantillas
  con `#icon#`.
- Los iconos de los items de `sidebar` y de los botones de `toolbar` también se
  dibujan como `svg`: el shim reemplaza el span de texto del widget al montar
  (ver "Iconos y theme del dashboard").
- `view: '<kind propio>'` dentro de un spec se monta como ese kind, de modo
  que un layout puede declarar `{ view: 'mainbar' }`.
- `view: 'datatable'` se traduce al `datatable` de Zorzal (`columns` con
  `id`/`header`/`width`/`align`, `data` o `json`, `plain`, `compact`).
- `$$` sobre un botón de toolbar devuelve una referencia con `el`, `getValue`,
  `setValue`, `set({ disabled, text })`, `enable`, `disable` y `click`; el
  `enable`/`disable` también actualiza el item del toolbar, porque Zorzal
  descarta el clic de un item marcado como `disabled`.

`webix.$$(id)` busca por id entre lo montado por el shim. Devuelve la instancia
de Zorzal del widget (con `el`, `props`, `set`, `on` y la API propia del widget:
`getValue`/`setValue` en `text`, `label` y `template`, `setData` en `list`) o,
para los botones de toolbar, una referencia mínima con `el`, `getValue`,
`setValue` y `click`. Devuelve `null` si el id no existe.

## Qué falta

- `toExcel`: no hay exportación a planilla. El servicio `csv` de Zorzal cubre
  la necesidad sin dependencias; la conversión a xlsx queda fuera del shim.
- `$$` completo: no hay `getTopParentView`, `getChildViews`, `queryView`,
  recorrido de la jerarquía ni vistas de `datatable` por fila. Solo resuelve
  los ids declarados en los specs montados por el shim y desaparece cuando el
  nodo se desmonta.
- Plugins del SDK de Webix: sin `webix.ui.datafilter`, sin skins, sin `jet`,
  sin drag-and-drop ni editores de celda. Los plugins propios sí se pueden
  portar con el `protoUI` del shim (ver la sección siguiente).
- Vistas fuera de la lista de arriba (`tree`, `scheduler`, `gantt`,
  `spreadsheet`, `contextmenu`): se degradan a `template`, no se emulan.
- Plantillas con HTML: Zorzal interpola como texto, así que las etiquetas de
  una plantilla no se interpretan como HTML.
- `webix.ui` no rearma un contenedor ya montado: cada llamada agrega un widget
  al contenedor indicado.

## Pantalla del dashboard

`sdk/app/dashboard.js` quedó migrado a `compat/pages/dashboard.js`, un módulo ES
que exporta `mount(root, options?)` y registra la pantalla en el shim de `app`
como `app.dashboard`. El original no se toca.

### Estructura

El montaje reproduce el layout del original y conserva sus ids:

    app.page            layout vertical
    app.header            cols -> app.mainbar (kind mainbar portado)
    app.body              cols -> _sidebar (sidebar nativo) + content
    content               layout vertical
    content_title           nombre del ítem seleccionado
    content_body            detalle / pantalla resuelta por app.require
    my_pop                popup de submenú (widget popup de Zorzal)
    app.submenu_list        unitlist con los hijos de la sección

Al hacer clic en un ítem sin hijos, el sidebar emite `select`, el área de
contenido muestra el nombre y el id, y el dashboard llama a `app.require(id)`.
Si la definición expone `mount`, la pantalla se monta dentro del cuerpo del
contenido; si devuelve otra cosa, se muestra el valor; si no hay definición, el
contenido lo dice. En un ítem con hijos, además del nombre, se abre el popup con
sus hijos, anclado al botón del sidebar; elegir un hijo mueve el activo, cierra
el popup y resuelve la pantalla.

`mount` acepta `{ menu, onChange }`. Sin `menu`, lee `usr.menu` (global o el
objeto de `compat/globals.js`), igual que el original.

### Sidebar nativo en lugar del plugin

| Aspecto | Original (`sdk/sys/plugins/sidebar.js`) | Migrado |
| --- | --- | --- |
| Widget | `webix.protoUI` sobre `tree` | kind `sidebar` de Zorzal |
| Datos | árbol Webix con `value` y `data` | array con `id`, `name`, `icon`, `items`/`children` |
| Activo | `onAfterSelect` + CSS de Webix | `props.selected`, clase `z-sidebar__item--active` |
| Cambio | `onItemClick` | evento `select` (`{ id, item, event }`) |
| Rama con hijos | `onBeforeOpen` / `onAfterSelect` | eventos `expand` / `collapse`; el dashboard marca el activo con `select(id)` |
| Colapsado | ancho fijo y popup flotante por hover | clase `z-sidebar--collapsed`; el toggle del `mainbar` la usa |

La razón del cambio es la del contrato: el plugin depende de APIs de ciclo de
vida de Webix (`$ready`, `type`, `attachEvent`, `config.hidden`,
`getChildViews`) que el shim no emula. El sidebar nativo cubre la misma
necesidad funcional con menos superficie.

El plugin original además mostraba, con el sidebar colapsado, un popup con el
título de la rama y sus hijos al pasar el mouse. Esa variante no se porta: el
dashboard abre el submenú al seleccionar la rama, con el sidebar expandido.

### Qué queda fuera del dashboard

- `waves`: el original agrega el efecto sobre `webix_tree_item`,
  `webix_el_button` y `logospace`. Es un efecto visual sobre clases de Webix que
  Zorzal no genera, así que no se reimplementa.
- Sesión real: `usr` y `__` los completa `compat/session-shim.js` (usuario
  demo y `localStorage` de lectura, `session.enable = false`). El login y el
  chequeo contra el backend siguen fuera: ver "Que queda pendiente del
  backend".
- Loader dinámico: `app.require` no descarga `source.json` ni evalúa archivos;
  resuelve definiciones en memoria (ver abajo). El loader real de Halcón se
  conecta en otra ola.
- Popup de usuario (`my_pop` original con Settings y Logout): depende de la
  sesión y de `sys.widget.logout`, que no existen en el piloto. El id se
  reutiliza para el popup de submenú de las secciones.
- El `mainbar` del original ya está portado y se reutiliza tal cual
  (`plugins/mainbar.js`), incluido el toggle del sidebar, que ahora contrae el
  widget nativo.

### Shim de `app.define` / `app.require`

`compat/app-shim.js` publica `define(name, factory)`, `require(name, cb)` y
`require(name)` sin callback, más `isDefined`, `list`, `reset` e `install`:

- `define` solo registra; redefinir un nombre reemplaza la factory y descarta el
  resultado cacheado.
- `require` ejecuta la factory la primera vez, guarda el resultado y lo devuelve
  igual en las llamadas siguientes (una sola ejecución por definición).
- Con callback, lo llama con el resultado en el acto: no hay carga asíncrona.
- Un nombre sin definición, o una dependencia circular, lanza `Error`. El shim
  no inventa pantallas: el dashboard informa el id sin definición en el área de
  contenido.
- `install(target)` publica el shim como `target.app` para el código heredado;
  el piloto lo usa para dejar `window.app` disponible.

### Clases de presentación

El shim no traslada `css` al DOM. El dashboard agrega dos familias de clases:
las `halcon-*` que ya existían (`halcon-content`, `halcon-content__title`,
`halcon-content__body`) y las `hc-*` del theme propio (`hc-dashboard`,
`hc-mainbar`, `hc-logo`, `hc-sidebar`, `hc-content`, `hc-content__title`,
`hc-content__body`). El piloto usa el theme; en la aplicación real los estilos
de Halcón siguen mandando.

## Pantallas ABM: clientes

Las dos pantallas de `sdk/app/abm/` quedaron migradas a modulos ES que se
registran en el shim de `app`:

| Original | Migrado | Registro |
| --- | --- | --- |
| `sdk/app/abm/clientes_view.js` | `compat/pages/clientes_view.js` | `app.abm.clientes_view` |
| `sdk/app/abm/clientes_form.js` | `compat/pages/clientes_form.js` | `app.abm.clientes_form` |

El store compartido vive en `compat/store/clientes.js` y no en el shim de
Webix: es un array en memoria con la forma que devolveria la query SQL
(`id`, `apellido`, `nombre`, `cliente`, `addr`, `doc`, `tel`, `fingreso`,
`id_cobrador`, `cobrador`). Expone `list()`, `getById()`, `save()`, `reset()`,
`cobradorOptions()`, `nombreCobrador()`, `on()`/`off()` y emite `save` (una vez
por alta o modificacion) y `change` (despues de cada escritura).

### Vista

`mount(host)` monta una barra (`Clientes` + boton `Nuevo cliente`) y un
`datatable` con las seis columnas del original: Cliente, Direccion, DNI,
Telefono, Ingreso y Cobrador. Los datos salen de `store.list()`.

- **Orden por columna**: lo resuelve el `datatable` de Zorzal; el clic en el
  encabezado alterna ascendente/descendente y no requiere codigo propio.
- **Doble clic**: el `datatable` solo emite `select` con un clic, asi que la
  vista engancha un listener `dblclick` sobre el contenedor del widget y
  resuelve la fila por `data-id` contra el store. El listener vive en el
  contenedor (no en las filas), por lo que sobrevive al reordenamiento y a los
  cambios de datos.
- **Navegacion**: seleccionar una fila abre el formulario en modo edicion;
  `Nuevo cliente` lo abre vacio. Las dos pantallas se montan en el mismo
  contenedor de contenido, reemplazando el contenido anterior.

### Formulario

`mount(host, { id, onSaved, onBack })` monta una barra (`Volver`, titulo,
`Guardar`) y un `form` de Zorzal con nombre, apellido, direccion, DNI, telefono
y cobrador (un `select` con los cobradores del store). Sin `id` es un alta; con
`id` precarga la fila y el titulo pasa a `CLIENTE: <cliente>`.

- **Obligatorios**: nombre, apellido, direccion, DNI y cobrador. Se declaran
  en `rules` del formulario con `webix.rules.required()`; el telefono queda
  opcional. El shim no traslada `required` de un campo `text` (la traduccion de
  Zorzal lo descarta), por eso la validacion va en `rules` y no en el campo.
- **Guardado**: `store.save()` agrega con el proximo id o actualiza la fila en
  edicion y emite `save`; la pantalla despacha ademas
  `CustomEvent('clientes:guardado')` en su raiz, con
  `detail: { cliente, filas }`. Despues vuelve a montar la vista, que lee el
  store y muestra la tabla actualizada (seis filas despues de un alta).
- **Volver**: remonta la vista sin escribir en el store.

### Session shim

`compat/session-shim.js` completa los stubs de `compat/globals.js` en el mismo
objeto (`usr` y `__` son las mismas referencias), para que el dashboard y los
plugins vean la sesion sin cambiar sus imports:

- `usr.name`, `usr.menu` y `usr.session` (`enable`, `login`, `check`, `logout`,
  `key`, con la forma de `sdk/config/app.json`).
- `__.current`, `__.isNumber` (misma semantica que
  `sdk/sys/core/helper.js`) y `__.session` (stub de `sys.core.session`).
- Lee `localStorage["halcon.app.session"]` (`{ name, menu, session }`) y, si no
  hay datos o el JSON es invalido, usa el usuario demo (`demo`, menu de dos
  secciones con hijos y dos items sueltos, `session.enable = false`).
- `installSession(target)` publica `usr` y `__`; el piloto lo usa para dejar
  `window.usr` y `window.__`.
- No escribe en `localStorage`. En la aplicacion real la sesion la crea el
  backend, no el navegador.

## Que queda pendiente del backend

El ABM valida la UI y los flujos, pero no hay backend conectado. Los puntos de
conexion estan marcados y quedan pendientes:

| Pieza | Estado en el piloto | Para conectar el backend |
| --- | --- | --- |
| Query SQL de la vista | `store.list()` con cinco filas de ejemplo | reemplazar por la query del original (`clientes` + join `cobradores`, `CONCAT` de nombre y cobrador, `DATE_FORMAT` de ingreso) ejecutada por el backend PHP |
| Query del combo de cobradores | `store.cobradorOptions()` fijo | pedir `cobradores` (`id`, `CONCAT(apellido,' ',nombre)`) al backend |
| Store | array en memoria, sin persistencia | `save()` debe publicar el alta/edicion (`clientes-update`) y refrescar desde la respuesta; el piloto pierde los cambios al recargar |
| Sesion real | `usr` demo + `localStorage` de lectura | el login, `auth-online`, el chequeo periodico y el logout son de `sdk/sys/core/session.js`; `usr.session.enable` debe venir del backend |
| Formato de Ingreso | ISO (`YYYY-MM-DD`) | el original mostraba `dd/mm/yyyy` con `format` de columna; el shim no emula `format`, asi que el formateo queda para la capa de datos o para el widget |
| Fecha de ingreso y egreso | el formulario no las edita; el alta recibe la fecha del store | devolver `fingreso`/`fegreso` del backend y agregar los `datepicker` del original |

## Iconos y theme del dashboard

Los iconos son trazos SVG del servicio de iconos de Zorzal
(`sdk/vendor/zorzal/src/services/icons.js`): grilla de 24x24, `fill: none`,
`stroke: currentColor` y `stroke-width` 2. No hay fuente de iconos ni hoja
externa: los archivos de `sdk/ui/css/font_awesome/` siguen en el repositorio
pero ya no se cargan en ninguna página.

### `compat/icons.js`

`resolveIconName(icon)` es la única puerta de entrada de los nombres de icono:
devuelve el nombre del set de Zorzal. Reglas:

| Entrada | Salida | Regla |
| --- | --- | --- |
| `bars` | `menu` | la tabla de Halcón traduce el nombre |
| `dashboard` | `dashboard` | el nombre ya existe en el set |
| `fa fa-save` | `save` | se quita el prefijo heredado |
| `fa-truck` | `truck` | idem |
| `floppy-o` | `save` | nombre heredado con equivalente en la tabla |
| `OP` | `dot` y aviso | no existe: icono por defecto del set |

Tabla de nombres (nombre en Halcón → nombre en el set de Zorzal):

| Halcón | Zorzal | Halcón | Zorzal |
| --- | --- | --- | --- |
| `dashboard` | `dashboard` | `ticket` | `ticket` |
| `bars` | `menu` | `address-book` | `address-book` |
| `ellipsis-v` | `ellipsis-v` | `shopping-bag` | `shopping-bag` |
| `cog` | `cog` | `truck` | `truck` |
| `power-off` | `power-off` | `flag` | `flag` |
| `shopping-cart` | `shopping-cart` | `chevron-left` | `chevron-left` |
| `question` | `question` | `cloud-upload` | `cloud-upload` |
| `save` | `save` | `plus` | `plus` |

El set completo está en `HALCON_ICON_NAMES`; los nombres heredados con
equivalente (`floppy-o`, `angle-down`, `plus-circle`, `wxi-menu-down`, ...)
están en `LEGACY_ICON_NAMES`. Un nombre que no resuelve cae al icono por
defecto del set (`dot`) y deja un aviso `[compat/icons]` una sola vez por
nombre. La tabla es la misma que muestra el piloto en la tabla "Iconos SVG del
set de Zorzal".

Funciones del módulo:

- `resolveIconName(name)`: nombre del set de Zorzal que corresponde al nombre
  de Halcón.
- `renderIcon(name, { doc, className, label, title })`: `svg` de 24x24 con los
  paths del set. `width` y `height` salen en `1em` como tamaño por defecto; la
  clase `hc-icon` permite ajustarlo desde el CSS.
- `paintIcon(host, name, options)`: reemplaza el contenido de un nodo por el
  `svg` y deja el nombre original en `data-hc-icon`.
- `hasIconName(name)`: indica si el nombre resuelve a un icono del set.

No toca el DOM al importarse, así que se puede cargar desde Node:

    node --check sdk/compat/icons.js

### Dónde se aplica

- Widgets `button` con `icon` de texto: el shim lo cambia por
  `{ kind: 'hc-icon', icon: <nombre resuelto> }` y el botón monta el `svg`
  dentro de `.z-button__icon`.
- `list`/`unitlist` con `#icon#` en el template: el shim arma una función de
  plantilla que devuelve el `svg` y el resto del texto interpolado. El popup de
  submenú del dashboard la usa (`#icon# #name#`).
- Items del `sidebar` y botones de la `toolbar`: el widget de Zorzal solo
  acepta texto, así que el shim reemplaza el contenido de `.z-sidebar__icon` /
  `.z-toolbar__icon` por el `svg` al montar. El nombre original queda en
  `data-hc-icon`.

Limitación: el reemplazo ocurre al montar. Si la toolbar o el sidebar vuelven a
construir sus items (porque cambia el array de props), los spans se recrean con
texto y el icono no se repinta hasta el próximo montaje.

### `compat/theme.css`

Theme propio del dashboard migrado. Se carga después de `zorzal.css` y no
reemplaza `admin.css` ni `sidebar.css`: todo se aplica dentro de
`.hc-dashboard`.

| Clase | Elemento |
| --- | --- |
| `hc-dashboard` | contenedor raíz del `mount` |
| `hc-mainbar` | toolbar de la barra superior |
| `hc-logo` | plantilla del logo (incluye el estado `main_logo--collapsed`) |
| `hc-sidebar` | sidebar nativo (`aside.z-sidebar`) |
| `hc-content` | área de contenido (layout vertical) |
| `hc-content__title` | plantilla del título |
| `hc-content__body` | plantilla del cuerpo |
| `hc-table` | tabla del theme; `.hc-table__icon` centra la columna de iconos |
| `hc-icon` | `svg` de icono; tamaño base `1em`, el theme lo ajusta en mainbar, sidebar y botones |
| `hc-hidden`, `hc-sr-only` | utilidades |

Las secciones del sidebar son `.z-sidebar__item--branch` y los hijos viven en
`.z-sidebar__list--nested`; el theme los distingue (mayúsculas y peso para la
sección, sangría y texto normal para el hijo) sin cambiar el DOM del widget.

Variables principales (todas con prefijo `--hc-`):

| Variable | Uso |
| --- | --- |
| `--hc-mainbar-bg`, `--hc-mainbar-text`, `--hc-mainbar-hover` | colores de la mainbar |
| `--hc-mainbar-height` | alto mínimo de la mainbar |
| `--hc-logo-size`, `--hc-logo-spacing` | tipografía del logo |
| `--hc-sidebar-bg`, `--hc-sidebar-text`, `--hc-sidebar-muted` | sidebar |
| `--hc-sidebar-active-bg`, `--hc-sidebar-active-text` | ítem activo |
| `--hc-content-pad`, `--hc-content-gap`, `--hc-title-size` | área de contenido |
| `--hc-table-head-bg`, `--hc-table-row-hover`, `--hc-table-border` | tabla |
| `--hc-button-bg`, `--hc-button-text`, `--hc-primary`, `--hc-danger` | botones |

El theme también fija las variables `--z-*` de Zorzal dentro de
`.hc-dashboard`, para que el datatable y el sidebar nativo hereden los colores
sin reglas duplicadas.

## Plugins propios portados

Los tres plugins de `sdk/sys/plugins/` que usa la aplicación se portaron a
`sdk/compat/plugins/` como módulos ES. Cada módulo importa `{ webix }` del shim
(no hay global de Webix) y registra su kind como efecto de módulo:

| Módulo | Kind | Base en Zorzal |
| --- | --- | --- |
| `plugins/mainbar.js` | `mainbar` | `toolbar` |
| `plugins/formview.js` | `formview` | `layout` (con `form` y `toolbar` adentro) |
| `plugins/datalist.js` | `datalist` | `layout` (con `toolbar` y `datatable` adentro) |

`plugins/check.mjs` importa los tres, verifica con `webix.isDefined` que los
kinds quedaron registrados y, desde la migración del dashboard, comprueba
además que `app.define`/`app.require` existen, que `app.dashboard` queda
registrado y se puede requerir, y que una definición se evalúa una sola vez.
Con la ola del ABM comprueba tambien que `app.abm.clientes_view` y
`app.abm.clientes_form` quedan registrados y exponen `mount`, que el session
shim publica `usr.name`, `usr.menu`, `usr.session.enable` y `__.current`,
`__.isNumber`, `__.session`, y que el store arranca con cinco filas, el alta
deja seis y emite `save`. Sale 0 si todo está:

    node sdk/compat/plugins/check.mjs

### Qué se portó

- `mainbar`: la barra completa (logo, botón de colapso, caja de búsqueda y
  botón de opciones), el estado `__.current.mb` y el toggle de la barra lateral.
- `formview`: la estructura del formulario, la toolbar interior, los setters
  (`dataview`, `update`, `elements`, `store`, `title_set`, `title_add`,
  `source`), los eventos `formReady` y `onFormSubmmited`, la validación previa
  al guardado con `webix.message({ type: 'error' })` y `mobile_input`.
- `datalist`: la toolbar (volver, título, alta), la tabla con columnas,
  selección, carga por `query` / `url` / `json`, el guard de carga única y la
  navegación al formulario y al dashcenter por `app.require`.

### Qué se degradó

- `toExcel`: reemplazado por un no-op que devuelve `false` y avisa por consola.
  El export a planilla queda fuera de alcance. La acción sobrevive como
  `export_to_excel()` en la vista `datalist`; el menú contextual que la abría no
  se monta porque el shim no emula `master`/`popup`.
- Logo del `mainbar`: la plantilla original usa HTML (`<center class=...>`).
  Zorzal interpola texto, así que el logo usa una plantilla de texto y el
  colapso cambia el contenido (`GN`) y una clase CSS (`main_logo--collapsed`),
  no el ancho en píxeles.
- Barra lateral: `_sidebar` no existe en el piloto. Si la vista no está
  montada, el toggle avisa y sigue; no rompe la barra.
- `css`, `width`, `height`, `borderless` y `align` de la config heredada no se
  aplican al DOM. El piloto los resuelve con CSS propio; en la aplicación real
  los estilos de Halcón siguen siendo los que mandan.
- `formview`: `enable()`/`disable()` sobre el botón de guardado se resuelven
  con `set({ disabled })`, porque el botón de Zorzal no expone esos métodos.
  `validate()` de Zorzal devuelve `true` o un objeto de errores, así que se
  compara con `true`. Los handlers de botón usan cierres sobre la instancia en
  lugar de `this.config.root` / `this.config.go`.
- `formview.mobile_input`: el original recorre `.webix_el_text .webix_el_box`;
  el port recorre los `.z-field input` del subárbol de la vista y solo engancha
  el scroll externo (`.focus-scroll`) si existe.
- `datalist`: `onItemClick` (Webix) pasa a ser el evento `select` del
  datatable de Zorzal, que entrega `{ id, item }`. `parse()`, `resize()` y
  `getItem()` no existen: se usa `setData()` y `resize()` se omite con aviso.
  El `footer`, las plantillas por columna y el modo de selección de fila no se
  emulan; la celda muestra el valor crudo de la clave de la columna.
- `$$` sobre el logo devuelve el `template` de Zorzal: `set({ value })` en vez
  de volver a montar una vista con `webix.ui(spec, vista)`.

### Stubs de globales

`sdk/compat/globals.js` publica los tres globales que tocaban los plugins, sin
lógica de negocio y con avisos `[compat/globals]`:

- `usr`: objeto de ejemplo con `name: 'demo'`. `compat/session-shim.js` le
  agrega `menu` y `session` sobre el mismo objeto (ver "Session shim").
- `__`: `current`, `setTitle`, `get_user` (devuelve `false`), `getFormPost`
  (devuelve `{}`), `sendPost` (no hace red), `GET`/`PAYLOAD` (no hacen red y
  llaman al callback con datos vacíos para que el flujo del plugin termine) y
  `mobileAndTabletcheck` (devuelve `false`).
- `app.require`: solo avisa que no hay navegación.

`installGlobals(target)` los copia a `globalThis` (o al objeto indicado) para el
código que todavía los lee como globales; lo usa el piloto. Los plugins portados
los importan, no leen el global.

## Cómo se mantiene el vendor

Copiar `sdk/vendor/zorzal/` desde `/opt/sources/zorzal/src` cuando Zorzal
cambie. No se edita a mano: los ajustes de compatibilidad viven en
`sdk/compat/webix-shim.js`. El vendor no tiene build ni dependencias.
