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

- [x] Gestionar la carga secuencial de recursos js, css, json, ico, jpg, png, gif, svg.
- [x] Actuar como "Module loader" de recursos js simil [RequireJS](https://requirejs.org/) 
- [x] Generar un preloading mientras se cargan los recursos
- [x] Evitar el cache agregando el parametro extra "refresh=hash()"
- [x] Detectar el dispositivo para ajustarse a la visualizacion
- [x] Generar metodos helper de url como base_url, req, GET, POST entre otros.
- [x] Mostrar path con el stilo de java "sdk.my_dir.my_other_dir"  

### Vincular Halcon con Tero

```php
$App->get('index', function ()
{
    $this->data->set("rand",rand(111,999) );
    $this->parser->parse(BASEPATH."sdk/index.html", $this->data->get());
});
```

### Configurar los sources 

Editar el archivo sdk/config/sources.json

```js
[
    { "tag" : "json"   , "cache": true, "url": "config/app.json"          }, 
    { "tag" : "icon"   , "cache": true, "url": "ui/img/favicon.ico"       },
    { "tag" : "link"   , "cache": true, "url": "sys/core/webix/webix.css" },
    { "tag" : "link"   , "cache": true, "url": "ui/css/font_awesome/css/font-awesome.min.css"   },  
    { "tag" : "link"   , "cache": true, "url": "ui/css/sidebar.css"       }, 
    { "tag" : "link"   , "cache": true, "url": "ui/css/waves.css"         },  
    { "tag" : "link"   , "cache": true, "url": "ui/css/admin.css"         }, 
    { "tag" : "script" , "cache": true, "url": "sys/core/webix/webix.js"  }, 
    { "tag" : "script" , "cache": true, "url": "sys/core/b64.js"          },
    { "tag" : "script" , "cache": true, "url": "sys/core/helper.js"       },
    { "tag" : "script" , "cache": true, "url": "sys/core/noback.js"       },  
    { "tag" : "script" , "cache": true, "url": "sys/core/waves.js"        },   
    { "tag" : "script" , "cache": true, "url": "sys/plugins/sidebar.js"   },   
    { "tag" : "script" , "cache": true, "url": "sys/plugins/mainbar.js"   },   
    { "tag" : "script" , "cache": true, "url": "sys/plugins/datalist.js"  },   
    { "tag" : "script" , "cache": true, "url": "sys/plugins/formview.js"  },    
    { "tag" : "script" , "cache": true, "url": "sys/plugins/cards.js"     },  
    { "tag" : "script" , "cache": true, "url": "app/main.js"              }  
]
```

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


