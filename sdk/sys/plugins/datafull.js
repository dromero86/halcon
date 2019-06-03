
webix.protoUI
({ 
    name    : 'datafull', 
    defaults: 
    {   
        width : '100%' ,
        height: 'auto'
    },
    $init: function(config) 
    {   
        window.current[config.keyObject]={};
        window.struct[config.keyObject]={};
        
        setTimeout(function()
        {
            window.ajax(config.urlStruct, function(o){ window.struct[config.keyObject] = o; });
            
        }, 1000);
        

        window.optView(config.keyObject+"_"+(+new Date()));
        
        
    	webix.ui
    	({   
            id: window.context.current ,
            cols:
            [
                {
                    id          : config.searchId, 
                    view        : 'search'  , 
                    placeholder : config.searchName, 
                    on          :
                    {
                        'onKeyPress': function(code, e)
                        {
                            if(code==13)
                            {
                                var search = $$(config.searchId).getValue(); 
                                $$(config.dataId).filter(config.searchFilter, search);
                            }
                        }
                    }
                },
                { 
                    view  : 'button', 
                    type  : "icon", 
                    icon  : "plus",
					width : 37, 
					align : "right", 
                    css   : 'app_button',
                    tooltip : config.buttonAdd ,  
                    click : function()
                    {
                        try{ delete window.struct[config.keyObject].id; }catch(ex){  } 
                        window.current[config.keyObject] = window.struct[config.keyObject];
                        require([config.viewEdit], function(o) { o.show(); });
                    } 
                }
            ],
            height:32,
            gravity:5
		}, $$(window.context.old));      
      
        var row = [];
        

 
        row.push
        ({
            id       : config.dataId ,
            view     : 'dataview',  
            select   : true, 
            navigation:true,
            pager    : config.pagerId,
            type     : config.dataType ,

            on:
            { 
                onItemClick: function(id)
                {  
                    window.current[config.keyObject] = this.getItem(id);  
                    require([config.viewEdit], function(o) { o.show(); });
                }
            }                  
        });
      
        row.push
        ({
            view : 'pager', 
            id   : config.pagerId,
            size : 20,
            group: 5
        }); 

        setTimeout(function(){ $$(config.dataId).load(config.dataUrl); }, 1000);

        config.rows = row ;
    },      
    searchId_setter:function(config)
    {  
         this.searchId = config;
    }, 
    searchName_setter:function(config)
    {  
         this.searchName = config;
    }, 
    searchFilter_setter:function(config)
    {  
         this.searchFilter = config;
    },
    dataId_setter:function(config)
    {  
         this.dataId = config;
    },  
    dataUrl_setter:function(config)
    {  
         this.dataUrl = config;
    }, 
    pagerId_setter:function(config)
    {  
         this.pagerId = config;
    }, 
    dataType_setter:function(config)
    {  
         this.dataType = config;
    },  
    buttonAdd_setter:function(config)
    {  
         this.buttonAdd = config;
    }, 
    buttonWidth_setter:function(config)
    {  
         this.buttonWidth = config;
    },
    keyObject_setter:function(config)
    {  
         this.keyObject = config;
    } ,
    viewEdit_setter:function(config)
    {  
         this.viewEdit = config;
    },
    urlStruct_setter:function(config)
    {  
         this.urlStruct = config;
    }        
}, webix.ui.layout); 