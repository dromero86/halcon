webix.protoUI
({ 
    name    : 'datalist', 

    $init: function(config) 
    { 
        __.setTitle(config.title);

        var back_default = function()
        {  
            app.require("app.dashcenter");
        };  

        config.width = "100%"     ;
        config.height= "auto"     ;
        config.type  = "space"    ;
        config.css   = "data-view";
        config.rows  = 
        [
            { 
                view  : "toolbar",
                css   : "toolbar-interior",       
                cols  : 
                [
                    {
                        view      : "button"    , 
                        type      : "icon"      , 
                        icon      : "chevron-left",
                        width     : 45          , 
                        align     : "center"    , 
                        css       : "app_button", 
                        borderless: true        ,
                        click     : ( config.back!= undefined ? config.back : back_default )                 
                    }, 
                    { view  : "label" , label : config.title },
                    {
                        view      : "button", 
                        type      : "icon", 
                        icon      : "plus",
                        width     : 45, 
                        align     : "center", 
                        css       : "app_button", 
                        borderless: true,
                        click     : function()
                        { 
                            delete __.current[config.store];
                            app.require(config.form);
                        }                    
                    }
                ]
            },
            {   
                id          : config.data_id != undefined ? config.data_id : "_dt_"+(+new Date()) ,
                view        : "datatable"       ,   
                resizeColumn: true              ,
                navigation  : true              , 
                select      : "row"             ,  
                rowHeight   : 53                ,
                columns     : config.columns    ,
                flag        : false             ,
                on:
                { 
                    onItemClick: function(id) 
                    {  
                        __.current[config.store] = this.getItem(id); 
                        app.require(config.form);
                    },

                    onAfterRender: function()
                    {
                        var table = this;

                        if(table.config.flag == false)
                        {
                            table.config.flag = true;

                            __.PAYLOAD({"action":"databot"}, config.query , function(response){
                                
                                var result = JSON.parse(response);

                                table.parse(result.data);
                            });
                        }
                    }
                }
            }
        ]
    },

    title_setter  :function(value) { this.title   = value; },
    query_setter  :function(value) { this.query   = value; },
    form_setter   :function(value) { this.form    = value; },
    store_setter  :function(value) { this.store   = value; },
    columns_setter:function(value) { this.columns = value; }

}, webix.ui.layout);    