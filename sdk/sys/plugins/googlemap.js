webix.protoUI({
	name:"google-map",
	$init:function(config){
		this.$view.innerHTML = "<div class='webix_map_content' style='width:100%;height:100%'></div>";
		this._contentobj = this.$view.firstChild;

		this.map = null;
		this.$ready.push(this.render);
	},
	render:function(){
        this._initMap();
	},
    _initMap:function(define){


		var _controlSearch = function(controlDiv, map, component) 
		{ 

			// Set CSS for the control border.
			var controlUI            = document.createElement('div');
			controlUI.style.cssText  = ''; 
			controlUI.innerHTML      = '<form> <div class="webix_view webix_control webix_el_text" style="display: inline-block;"> <div class="webix_el_box" ><input type="text" value="" id="_search_map_text" placeholder="BUSCAR DIRECCION" style="width: 250px; height: 40px;" ></div> </div>    <div class="webix_view webix_control webix_el_button" style="display: inline-block;"><div class="webix_el_box" ><button type="button" id="_search_map_btn" class="webixtype_base" style="width: 150px; height: 40px;" >BUSCAR</button> </div></div> </form>'; 
 
			controlDiv.appendChild(controlUI);
  


			// Setup the click event listeners: simply set the map to Chicago.
			//controlUI.addEventListener('click', function() { var chicago = {lat: 41.85, lng: -87.65}; map.setCenter(chicago); });
		};





        var c = this.config;

        this.map = new google.maps.Map(this._contentobj, {
            zoom: c.zoom,
            center: new google.maps.LatLng(c.center[0], c.center[1]),
            mapTypeId: "OSM"
        });

		this.map.mapTypes.set("OSM", new google.maps.ImageMapType({
			getTileUrl 	: function(coord, zoom) { return "http://tile.openstreetmap.org/" + zoom + "/" + coord.x + "/" + coord.y + ".png"; },
			tileSize 	: new google.maps.Size(256, 256),
			name 		: "OpenStreetMap",
			maxZoom		: 20
		}));

		this.map.marcador = null;

		var _div = document.createElement('div');
		var centerControl = new _controlSearch(_div, this.map, this); 

		_div.index = 1;
		this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(_div);


		var _search = function(text, map, component){

            var geocoder = new google.maps.Geocoder();

            geocoder.geocode( { 'address': text}, function(results, status) 
            {
                if (status == google.maps.GeocoderStatus.OK) 
                { 
                    var lat = results[0].geometry.location.lat();
                    var lon = results[0].geometry.location.lng();  

                    component.callEvent("mapSearchLocation", [map, component, text, lat, lon]); 
                } 
                else
                {
                  webix.message('Geocode was not successful for the following reason: ' + status);
                }
            });

		};




        webix._ldGMap = null;

        var that = this;


        setTimeout(function()
        {  
        	that.callEvent("mapLoadFinish", [that.$view,that.map]);  

        	setTimeout(function()
        	{ 

				(function($) {
				 
	        		console.log("load", $("#_search_map_btn"), $("#_search_map_text"));
					
					$("#_search_map_btn").click( function()
					{  
						_search($("#_search_map_text").val(), that.map, that);
					});
					
					$("#_search_map_text").keydown(function (e) 
					{
						if (e.keyCode == 13)  _search($("#_search_map_text").val(), that.map, that); 
					});

				})(jQuery);


			},
			3000);


        }, 1000); 
        
    },
	center_setter:function(config){
		if(this.map)
            this.map.setCenter(new google.maps.LatLng(config[0], config[1]));

		return config;
	},
	mapType_setter:function(config){
        if(this.map)
        	this.map.setMapTypeId(google.maps.MapTypeId[config]);

		return config;
	},
	zoom_setter:function(config){
		if(this.map)
			 this.map.setZoom(config);

		return config;
	},
	defaults:{
		zoom 	: 5,
		center 	:[ 39.5, -98.5 ],
		mapType : "ROADMAP"
	},
	$setSize:function(){

		webix.ui.view.prototype.$setSize.apply(this, arguments);
		if(this.map)
            google.maps.event.trigger(this.map, "resize");
	}
}, webix.EventSystem, webix.ui.view);