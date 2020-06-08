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

Halcon esta escrito en javascript para soportar [Webix 5.4](https://webix.com/)  

#### Tareas de Halcon

- [x] Gestionar la carga secuencial de recursos js, css, json, ico, jpg, png, gif, svg.
- [x] Actuar como "Module loader" de recursos js simil [RequireJS](https://requirejs.org/) 
- [x] Generar un preloading mientras se cargan los recursos
- [x] Evitar el cache agregando el parametro extra "refresh=hash()"
- [x] Detectar el dispositivo para ajustarse a la visualizacion
- [x] Generar metodos helper de url como base_url, req, GET, POST entre otros.
- [x] Mostrar path con el stilo de java "sdk.my_dir.my_other_dir"  

### Vincular Halcon con Halcon

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
    { "tag" : "json"   , "url": "config/app.json"          }, 
    { "tag" : "icon"   , "url": "ui/img/favicon.ico"       },
    { "tag" : "link"   , "url": "sys/core/webix/webix.css" },
    { "tag" : "link"   , "url": "ui/css/font_awesome/css/font-awesome.min.css"   },  
    { "tag" : "link"   , "url": "ui/css/sidebar.css"       }, 
    { "tag" : "link"   , "url": "ui/css/waves.css"         },  
    { "tag" : "link"   , "url": "ui/css/admin.css"         }, 
    { "tag" : "script" , "url": "sys/core/webix/webix.js"  }, 
    { "tag" : "script" , "url": "sys/core/b64.js"          },
    { "tag" : "script" , "url": "sys/core/helper.js"       },
    { "tag" : "script" , "url": "sys/core/noback.js"       },  
    { "tag" : "script" , "url": "sys/core/waves.js"        },   
    { "tag" : "script" , "url": "sys/plugins/sidebar.js"   },   
    { "tag" : "script" , "url": "sys/plugins/mainbar.js"   },   
    { "tag" : "script" , "url": "sys/plugins/datalist.js"  },   
    { "tag" : "script" , "url": "sys/plugins/formview.js"  },    
    { "tag" : "script" , "url": "sys/plugins/cards.js"     },  
    { "tag" : "script" , "url": "app/main.js"              }  
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
