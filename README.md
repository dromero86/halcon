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

### Vincular Halcon con Halcon

```php
$App->get('index', function ()
{
    $this->data->set("rand",rand(111,999) );
    $this->parser->parse(BASEPATH."sdk/index.html", $this->data->get());
});
```

### Configurar los sources 


