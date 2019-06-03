webix.protoUI
({ 
    name    : 'listswitch',
    defaults: {   },
    $init   : function(config) 
    {    
	   console.log("init", config); 
    },   
    setValue:function(config)
    {   
        var ui = this;

        console.log("setValue",ui, config);
       
        setTimeout(function(){

            config = JSON.parse(config); 

            for(var i in config)
            {
                var item = ui.getItem(i);

                item.valor = config[i];
 
                ui.updateItem(item.id, item ); 
            }
        }, 2000);
    },	

    tipo_setter:function(config)
    {
        this.tipo = config;

        return config;
    },

	getValue: function()
	{   

        if( this.tipo == "1")
        {
            var data = [];

            this.data.each(function( o )
            { 
            	if( o.activo  == "1")
            		data.push(o.id); 
            });

           return data.join(",");
        }

        if( this.tipo == "2")
        {
            var data = []; this.data.each(function( o ){  delete o.nombre; delete o.id_rubro; if( o.valor != undefined ) data.push(o);  }); return JSON.stringify(data);
        }
 
        return null;
	}
},  
webix.EventSystem		,  
webix.ui.list			,   
webix.ActiveContent);  