<p align="center">
  <a href="https://github.com/dromero86/halcon/" target="_blank" >
    <img alt="Tero" src="https://cdn.dribbble.com/users/86682/screenshots/11464472/seahawk_media_simon_2x.png" height="130" /> <br>
	  <h3 align="center">HALCON UI FRAMEWORK</h3> 
  </a>
</p>
<hr>
<p align="center">
Halcon is a ui web framework for Javascript thought for the simple writing and fast resolution of problems.
</p>

<br>
<br>
<br>
<br>

### About Halcon

Halcon esta escrito en javascript para soportar [Webix 7+](https://webix.com/)  

#### Tareas de Halcon

- [x] Gestionar la carga de recursos js, css, json, ico, jpg, png, gif, svg.
- [x] Actuar como "Module loader" de recursos js simil [RequireJS](https://requirejs.org/), con `app.define` / `app.require` como puente de compatibilidad.
- [x] Generar un preloading mientras se cargan los recursos.
- [x] Politica de cache explicita (`versioned`, `immutable`, `reload`, `no-store`) con un sello por arranque, sin `Date.now()` por recurso.
- [x] Detectar el dispositivo con `matchMedia` / `maxTouchPoints` y viewport seguro (sin `user-scalable=no`).
- [x] Generar metodos helper de url como base_url, req, GET, POST entre otros.
- [x] Mostrar path con el stilo de java "sdk.my_dir.my_other_dir"  

### Estructura del repositorio

- `sdk/sys/` — nucleo heredado del framework: loader (`sys/core/loader.js`), helper de aplicacion (`sys/core/helper.js`), sesion (`sys/core/session.js`), utilidades (`b64.js`, `waves.js`, `noback.js`), plugins y widgets. El Webix embebido que queda es la version 7.3.6 (`sys/core/webix/webix_7.js` y `webix_7.css`), que es la que carga el manifiesto heredado.
- `sdk/sys/integrations/` — integraciones opt-in (`firebase`, `databot`) que se registran en `__` pero no forman parte del nucleo ni de la ruta nueva.
- `sdk/src/` — paquete publico `@halcon/sdk`: `halcon.js` es el punto de entrada unico y `version.js` publica la version. Las capas del paquete son `core/index.js` (API del vendor, `register` e `init`), `widgets/index.js` (registro de `mainbar`, `formview` y `datalist`) y `app/index.js` (pantallas registradas en `app`).
- `test/` — tests del paquete con el runner nativo de Node (`node --test test/`), sin dependencias.
- `sdk/compat/` — capa de migracion: shim de compatibilidad Webix sobre Zorzal (`webix-shim.js`, `app-shim.js`, `session-shim.js`, `theme.css`), paginas migradas y un pequeno almacen de datos. Documentada en `sdk/compat/README.md`.
- `sdk/vendor/zorzal/` — dependencia vendorizada del motor Zorzal (JS y CSS) que consume `sdk/compat/`.
- `sdk/app/` — aplicacion heredada (dashboard, settings y el ABM de clientes en `sdk/app/abm/`) y el arranque nuevo: `bootstrap.js` (shim de `app`, shim de sesion y montaje de login o shell) y `main-zorzal.js` (modulo ESM que el manifiesto carga).
- `sdk/config/` — `source.json` (manifiesto v2 de recursos que carga el loader, hoy sobre Zorzal), `loader.schema.json` (esquema del manifiesto v2), `source-legacy.json` (el manifiesto v1 anterior, con Webix, para volver atras) y `app.json` (configuracion de la aplicacion).
- `sdk/ui/` — estilos e imagenes compartidas (admin, sidebar, waves, Font Awesome).
- `sdk/index.html` — unica entrada de la aplicacion: instancia el loader y le pasa el manifiesto; el resto de la pagina lo arma el loader.
- `package.json` — manifiesto del paquete `@halcon/sdk`: entry, exports, `files` (que se publica), script de tests y engines.
- `README.md` — este manual. `sdk/compat/README.md` — documentacion del shim. `LIMPIEZA-FASE1.md` — informe de la limpieza de duplicados de Webix.

### Uso del paquete `@halcon/sdk`

El paquete no tiene dependencias ni build en esta fase. Se importa como modulo ES
y no toca globals: no lee ni escribe `window` ni `document`, por lo que tambien
carga en Node para tests.

Instalar:

```sh
npm install @halcon/sdk
```

Mientras el paquete no este publicado se instala desde el repositorio:

```sh
npm install /ruta/a/halcon
```

Importar y montar. `init` acepta un spec completo o un `kind` con el resto de
las props:

```js
import { init } from '@halcon/sdk';

// spec completo
init({ el: '#app', spec: { kind: 'action', text: 'Hola' } });

// kind + props
init({ el: '#app', kind: 'formview', store: 'clientes', elements: [] });
```

Registrar un kind propio:

```js
import { register } from '@halcon/sdk';

register('mi-widget', (ctx) => ({ el: /* nodo raiz */ }));
```

`init` monta con Zorzal y devuelve la instancia. Si falta `el` lanza
`init: falta el contenedor (el)`; si no hay `spec` ni `kind` lanza
`init: falta spec o kind`.

Exports del paquete:

| Export | Tipo | Descripcion |
| --- | --- | --- |
| `ui` | object | Namespace de armado de Zorzal: `define`, `create`, `mount` y servicios. |
| `create` | function | Crea un widget a partir de un spec sin montarlo. |
| `define` | function | Registra un kind en el registro de Zorzal. |
| `kinds` | function | Lista ordenada de los kinds registrados. |
| `getIcon` | function | Formas `{ d }` de un icono del set. |
| `hasIcon` | function | Indica si un nombre de icono existe. |
| `addIcon` | function | Agrega un icono al set. |
| `iconNames` | function | Nombres de iconos disponibles, incluidos los alias. |
| `register` | function | Valida y registra un kind propio; delega en `define`. |
| `init` | function | Monta un widget en un contenedor y devuelve la instancia. |
| `VERSION` | string | Version del paquete (`0.1.0`). |

Al importar el paquete quedan registrados los plugins `mainbar`, `formview` y
`datalist` como kinds de Zorzal. Tests:

```sh
npm test
```

### Compatibilidad de navegadores

La matriz vive en `browserslist` dentro de `package.json`: las ultimas dos
versiones de Chrome, Edge, Firefox y Safari, con Internet Explorer excluido
(`not ie <= 11`). `scripts/compat.mjs` es el control automatico, sin
dependencias: recorre `sdk/src` y `sdk/compat` y falla si encuentra
`document.execCommand`, `window.event`, `navigator.userAgent` usado para decidir
features, `attachEvent` o `document.all`, listando archivo y linea de cada
hallazgo.

```sh
npm run compat
```

`npm run check` corre lint, compat y tests en ese orden. La matriz, las APIs que
usa el SDK, los polyfills aplicados (ninguno), el estado de la verificacion
automatica y que motores se pueden probar en este host estan en
`docs/2026-11-07-navegadores.md`.

### Demo con el emulador

`make demo` levanta juntos el emulador de la API (`mock/server.mjs`, puerto 7071)
y el servidor de desarrollo (`python3 -m http.server`, puerto 8090), espera a que
los dos respondan e imprime la URL del piloto:

```sh
make demo
# emulador: http://127.0.0.1:7071/
# piloto:   http://127.0.0.1:8090/sdk/pilot-dashboard.html?api=http://127.0.0.1:7071
```

`Ctrl+C` corta los dos procesos. Los puertos se cambian por variable, igual que
en el resto del Makefile (la URL que imprime `make demo` ya lleva el `?api=`
correspondiente):

```sh
make demo PORT=8091 MOCK_PORT=7080
```

El piloto abre en el login (`app.login`): se entra con `admin` / `admin123` (o
`lector` / `lector123`, que no puede dar de alta clientes). Al autenticar monta
el dashboard y el listado de clientes con las filas de `GET /api/clientes`; el
boton `Salir` de la mainbar cierra la sesion y vuelve al login. La URL del
emulador se puede cambiar sin editar nada, con `?api=` en la query o con
`window.HALCON_API`; el contrato y el detalle de 401 y 403 estan en
`docs/2026-11-07-api-json.md`.

Para levantar solo el emulador esta `make mock`; para solo el servidor,
`make serve` o `make start`.

### Vincular Halcon con Tero

```php
$App->get('index', function ()
{
    $this->data->set("rand",rand(111,999) );
    $this->parser->parse(BASEPATH."sdk/index.html", $this->data->get());
});
```

### Carga progresiva y manifiesto de recursos

`sdk/index.html` no nombra ningun archivo de la aplicacion: instancia el loader y
le pasa un manifiesto (`bootin=.../sdk/config/source.json`). Todo lo que carga la
pagina sale de ahi, en el orden en que el manifiesto lo declara, y el arranque
corre al final con `app.run`. El formato del manifiesto, los tags, la diferencia
entre un script clasico y uno con `"module": true` y la vuelta atras estan en
`docs/2026-11-07-carga-progresiva.md`.

`sdk/config/source.json` carga hoy la ruta nueva sobre Zorzal:

```js
[
    { "tag" : "json"   , "cache": true, "url": "config/app.json"                  },
    { "tag" : "icon"   , "cache": true, "url": "ui/img/favicon.ico"               },
    { "tag" : "link"   , "cache": true, "url": "vendor/zorzal/src/zorzal.css"     },
    { "tag" : "link"   , "cache": true, "url": "compat/theme.css"                 },
    { "tag" : "script" , "cache": true, "url": "app/main-zorzal.js", "module": true }
]
```

`app/main-zorzal.js` es un modulo ESM que importa `sdk/app/bootstrap.js`: instala
el shim de `app` y el de sesion, registra las pantallas y monta `app.login`
mientras la sesion es anonima, o el shell del dashboard cuando esta autenticada.

En desarrollo la ruta nueva se abre con `make serve`: sirve `sdk/index.html` en
`/` y resuelve `{url}` y `{rand}`, igual que el backend. El arranque heredado se
levanta aparte, con `make legacy`.

Un recurso que no existe no corta el arranque: el loader avisa por consola
(`[sys/core/loader] ...`) y sigue con el siguiente recurso del manifiesto.

### Arranque heredado

El manifiesto anterior (Webix 7, Font Awesome, waves, plugins y `sdk/app/main.js`)
quedo sin cambios en `sdk/config/source-legacy.json`. Para levantar la aplicacion
con ese arranque:

```sh
make legacy             # http://0.0.0.0:8090/
make legacy PORT=8091   # otro puerto
```

`make legacy` sirve el repositorio, resuelve `{url}` y `{rand}` de
`sdk/index.html` como lo hace el backend y apunta el `bootin` a
`source-legacy.json`; `/sdk/index.html` redirige a `/` porque `project-path`
(`./sdk/`) se resuelve contra la URL del documento. Para que la vuelta atras sea
permanente, copiar `sdk/config/source-legacy.json` sobre
`sdk/config/source.json`.

### Definir un modulo 

```js
//defino un modulo javascript en la ruta sdk/app/settings/main.js
app.define("app.settings.main", function()
{ 
	//mi codigo javascript

});
```

### Invocar un modulo 

```js

app.require("app.settings.main", function()
{ 
	//cuando sdk/app/settings/main.js este cargada se invocara esta funcion

});
```

### Definir un modulo que retorne un valor

```js
//defino un modulo javascript en la ruta sdk/app/settings/main.js
app.define("app.settings.main", function()
{ 
	var persona = {
		nombre:"John Doe",
		edad: 35
	};
	
	return persona;
});
```

### Invocar un modulo que retorna un valor

```js
 
app.require("app.settings.main", function(persona)
{ 
	//cuando sdk/app/settings/main.js este cargada se invocara esta funcion
	
	console.log(persona); // { "nombre": "John Doe", "edad":35 }

});
```

### Configurar la aplicacion

Editar el archivo sdk/config/app.json

```js
{
	"name"    : "El nombre de la aplicacion",
	"jsonp"   : false, 
	"domain"  : "el servidor donde esta alojada la aplicacion",  
	"session" :
	{
		"enable" : false, //si es true se habilita la session
		"login"  : "la url de autenticacion"  ,
		"check"  : "la url que checquea si esta con session activa" ,
		"logout" : "la url de deslogueo" ,
		"key"    : "la clave de localstorage" 
	} 
}
```

### Como configurar la session 

- [x] Debe establecer en sdk/config/app.json session.enable = true;
- [x] Para customizar el widget del login debe editar "sys.widget.login"
- [x] Para customizar el widget del logout debe editar "sys.widget.logout"
- [x] Para obtener el objeto session utlice el helper "__.userInfo();"

### Como crear abms en 2 pasos

Para utilizar esta caracteristica debe tener instalado y configurado en Tero

- [x] Database
- [x] Telepatia
- [x] Schema
- [x] Controladores de abm.php (*-update, *-row)

y tener creado el controlador "databot"


```php
if($App->session->recv() !=FALSE )
{ 
    $App->schema->load();

    $App->get("databot", function($rid="")
    {   
        $this->schema->start_server(); 
    });
}
```

### Configurar el table list

Crear el archivo sdk/app/abm/personas_view.js
Debe tener una tabla llamada personas

```js
app.define("app.abm.personas_view",function()
{  
    webix.ui
    ({
        id     : 'content'  ,
        view   : "datalist" ,
        title  : "TITULO DEL ABM" ,
        form   : "app.abm.personas_form", //vinculo para cuando seleccione un registro o cuando agregue uno nuevo
        store  : "objeto_interno_con_el_nombre_de_tabla" ,
        columns: [ 
            {id:"nombre"  , header:"Nombre" , sort: 'string' , fillspace: true }, 
            {id:"edad"    , header:"Edad"   , sort: 'string' , adjust: true }                
        ],
        query : { 
            select:
            {
                from:"clientes", 
                field: [ "id","nombre","edad" ]  
            } 
        } 
    },
    $$('content'));
});
```

### Configurar el table form

Crear el archivo sdk/app/abm/personas_form.js


```js
app.define("app.abm.personas_form",function()
{  
    webix.ui
    ({
        id       : 'content',
        view     : "formview",
        dataview : "app.abm.personas_view",
        update   : "personas-update",
        source   : {"action": "personas-row","id": __.defAttr("personas", 0, "id" ) }, 
        store    : "personas",
        title_set: __.defAttr("personas", "", "nombre" ),
        title_add: "NUEVA PERSONA",
        elements :
        {
            padding:25,
            rows:
            [ 
                {
                    cols:
                    [
                        {
                            "name": "nombre",
                            "view": "text",
                            "label": "Nombre",
                            "labelPosition": "top"
                        },
                        { width: 25 },
                        {
                            "name": "edad",
                            "view": "text",
                            "label": "Edad",
                            "labelPosition":"top"
                        }    
                    ]
                },
				{}  
            ]
        } 
    },
    $$('content'));

});
```
