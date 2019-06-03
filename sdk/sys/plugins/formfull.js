
webix.protoUI
({ 
    name    : 'formfull', 
    defaults: 
    {   
        width : '100%' ,
        height: 'auto'
    },
    $init: function(config) 
    {  
    	var elements = config.fields;

        var onsave = config.onsave ? config.onsave : function()
        {
            var format = webix.Date.dateToStr("%Y-%m-%d"); 
            var object = $$(config.id).getValues(); 
            
            for(var i in object)
            {
                if(object[i] instanceof Date)
                {
                 
                    object[i] = format(object[i]);
                } 
                
                object[i] = window.B64.encode(object[i]);
            }
  
            
            window.post({ 'action':config.urlUpdate}, object, function(json)
            {    
                if(json.type == 'insert' && json.id == '0')
                {
                    webix.message({type:'error', text:'Insert invalido, el registro no se agrego'});
                }
                require([config.viewList], function(o){o.show();});
            });
        };

        var ondrop = config.ondrop ? config.ondrop : function()
        {
            var object = $$(config.id).getValues();

            if( object.id != undefined )
            {  
                window.ajax({ 'action':config.urlDelete, 'id':object.id }, function(json)
                { 
                    require([config.viewList], function(o){o.show();});
                }); 
            }
        };
		 
        window.optView(config.id+"_"+(+new Date()));
    	webix.ui
    	({   
            id: window.context.current,
            height:32, 
        	cols:
        	[
        	    { 
            		view : 'button'   , 
                    type : 'icon'      ,
                    css  : 'app_button',
                    icon : 'chevron-left',  
                    width: 37, 
            		click: function()
            		{ 
            			require([config.viewList], function(o){o.show();});
            		}        
            	},
            	{ width:10 },
            	{ 
            		view : 'button'    , 
                    type : 'icon'      ,
                    css  : 'app_button',
                    icon : 'save',  
                    hotkey: "Ctrl+S",
                    width: 37, 
            		click: onsave
            	},
            	{ 
            		view : 'button'   , 
                    type : 'icon'      ,
                    css  : 'app_button',
                    icon : 'remove',  
                    hotkey: "Ctrl+Q",
                    width: 37, 
            		click: ondrop
            	}
            	
        	]
		}, $$(window.context.old));

    	config.elements = elements ;
    },
    fields_setter:function(config)
    {  
         this.fields = config;
    },
    viewList_setter:function(config)
    {  
         this.viewList = config;
    },
    urlDelete_setter:function(config)
    {  
         this.urlDelete = config;
    },
    urlUpdate_setter:function(config)
    {  
         this.urlUpdate = config;
    },
    onsave_setter:function(config)
    {  
         this.onsave = config;
    },
    ondrop_setter:function(config)
    {  
         this.ondrop = config;
    }

}, webix.ui.form);