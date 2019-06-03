webix.protoUI
({ 
    name    : 'mobilist', 

    $init: function(config) 
    { 
        __.setTitle(config.title);

        var back_default = function() { app.require("mobile.dashcenter"); };  

   
        config.css   = "data-view";
        config.rows  = 
        [
            { 
                view       : "toolbar",
                css        : "toolbar-interior",  
                borderless : true,     
                cols       : 
                [
                    {
                        view      : "button"    , 
                        type      : "icon"      , 
                        icon      : "chevron-left",
                        width     : 56          , 
                        align     : "center"    , 
                        css       : "app_button", 
                        borderless: true        ,
                        click     : ( config.back!= undefined ? config.back : back_default )                 
                    }, 
                    { view  : "label" , label : config.title, width:244, borderless: true },
                    { borderless: true }, 
                    {
                        id        : "_ml_btn_add",  
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
                view        : "list"       ,  
                css         : "android-list",
                type        : config.type  , 
                select      : true         ,
                navigation  : true         , 
                height      : window.innerHeight - 106,
                on:
                { 
                    onItemClick: function(id) 
                    {  
                        __.current[config.store] = this.getItem(id); 
                        app.require(config.form);
                    } 
                }
            },
            {}

        ]

        this.$ready.push(this.render);
    },
    render: function()
    {
        var that = this;

        __.PAYLOAD({"action":"databot"}, that.query , function(response){
            
            var result = JSON.parse(response);
 
            $$(that.config.data_id != undefined ? that.config.data_id : "_dt_"+(+new Date()) ).parse(result.data);


            that.callEvent("onAfterDataParse", [that.$view]);  
        });

        
        that.callEvent("onAfterRender", [that.$view]);  
        
    },
    title_setter    :function(value) { this.title    = value; },
    query_setter    :function(value) { this.query    = value; },
    form_setter     :function(value) { this.form     = value; },
    store_setter    :function(value) { this.store    = value; },
    columns_setter  :function(value) { this.columns  = value; }, 
    type_setter     :function(value) { this.type     = value; }

}, webix.EventSystem, webix.ui.layout);    