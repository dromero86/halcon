webix.protoUI({
    name:"leaflet-map",
    $init:function(){
        this.$view.innerHTML = "<div class='webix_map_content' style='width:100%;height:100%'></div>";
        this._contentobj = this.$view.firstChild;
        
        this.map = null;
        this.$ready.push(this.render);
    },
    render:function(){
 
            this._initMap();
    },
    _initMap:function(define){
        var c = this.config; 


        var that =  this; 

        this.map = L.map(this._contentobj).on('load', function(o) { 

            that.callEvent("mapLoadFinish", [that.$view,this]); 

        }).setView(c.center, c.zoom);
        
        L.tileLayer(c.layer, {
            maxZoom: 19, attribution: c.attribution
        }).addTo(this.map); 
        
    },
    setCenter: function(lat,lon){
        if(this.map)
            this.map.panTo(new L.LatLng( lat, lon ));
    },

    toMap:function(object)
    {
        if(this.map)
            object.addTo(this.map);   
    },

    resizeMap:function()
    {
        if(this.map)
            this.map.invalidateSize();
    },

    center_setter:function(config){
        if(this.map)
            this.map.setCenter(config);
        
        return config;
    },
    mapType_setter:function(config){ 
        if(this.map)
            this.map.setType(config);

        return config;
    },
    zoom_setter:function(config){
        if(this.map)
             this.map.setZoom(config);

        return config;
    },
    defaults:{
        zoom: 5,
        center:[ 39.5, -98.5 ],
        layer:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a>'
    }
}, webix.EventSystem, webix.ui.view);