webix.protoUI
({ 
    name    : 'datalist', 

    $init: function(config) 
    { 
        __.setTitle(config.title);

        this.data_id = config.data_id != undefined ? config.data_id : "_dt_"+(+new Date()) ;

        var back_default = function()
        {  
            var _session = __.get_user();
  
            if(_session != false)
            {   
                app.require(_session.dashcenter);
            }
            else
            {
                console.error("back default error");
            }

        };  
 
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
                        id        : "btn_left_"+config.store,
                        view      : "button"    , 
                        type      : "icon"      , 
                        icon      : "fa fa-chevron-left",
                        width     : 45          , 
                        align     : "center"    , 
                        css       : "app_button", 
                        borderless: true        ,
                        click     : ( config.back!= undefined ? config.back : back_default )
                    }, 
                    { view  : "label" , label : config.title },
                    { id : config.store+"_combo", width : 1       },
                    { id : config.store+"_extra", width : 1       },
                    { id : config.store+"_extra_b", width : 1       },
                    {
                        id: "btn_add_"+config.store,
                        view      : "button", 
                        type      : "icon", 
                        icon      : "fa fa-plus",
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
                id          : this.data_id ,
                view        : config.data_type != undefined ? config.data_type : "datatable"       ,
                resizeColumn: true              ,
                navigation  : true              ,
                select      : "row"             ,
                /*rowHeight   : config.rowHeight != undefined ? config.rowHeight : 53,*/
                columns     : config.columns    ,
                flag        : false             ,
                footer      : config.footer != undefined ? config.footer : false,
                box         : config,
                on:
                { 
                    onItemClick: function(id) 
                    {  
                        var item = this.getItem(id);
                        if(item.folder == true){
                            return;
                        }
                        else
                        {
                            __.current[config.store] = item; 
                            app.require(config.form);
                        }
                    },

                    onAfterRender: function()
                    {
                        var table = this; 

                        if(table.config.flag == false)
                        {
                            webix.extend($$(table.config.id), webix.ProgressBar); 

                            table.config.flag = true;

                            if (config.query != undefined)
                            {
                                $$(table.config.id).showProgress({ type:"icon" });

                                __.PAYLOAD({"action":"databot"}, config.query , function(response){
                                    
                                    var result = JSON.parse(response);
                            
                                    table.parse(result.data);
                                    $$(table.config.id).hideProgress();   

                                    $$(table.config.id).resize();
                                });
                            }
                            else {

                                if(config.url != undefined)
                                {
                                    __.GET(config.url, function(response){
                                        table.parse(response);
                                        $$(table.config.id).resize();
                                    });
                                }
                                else
                                {
                                    $$(table.config.id).parse(config.json);
                                }
                                
                            }
                        }

                        webix.ui
                        ({
                            id    : "_ctx_"+table.config.box.store,
                            view  : "contextmenu", 
                            data  : 
                            [
                                { id:1, value:"Exportar a excel"} 
                            ],
                            master: table,
                            on:{
                                onItemClick: function(id){
                                    id = parseInt(id);
                                    
                                    switch(id)
                                    {
                                        case 1:  
                                                webix.toExcel(table, {
                                                    filename: table.config.box.store, 
                                                    name: table.config.box.store,
                                                    filterHTML:true 
                                                });
                                        break; 
                                    }
                                }
                            }
                        });
                    }
                }
            }
        ];

        this.$ready.push(this.on_render);
    },

    on_render: function()
    { 
    },

    title_setter  :function(value) { this.title   = value; },
    query_setter  :function(value) { this.query   = value; },
    form_setter   :function(value) { this.form    = value; },
    store_setter  :function(value) { this.store   = value; },
    columns_setter:function(value) { this.columns = value; }

}, webix.ui.layout);    