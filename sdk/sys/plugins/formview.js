webix.protoUI
({ 
    name  : 'formview',
    $init : function(config) 
    { 
        var _that =  this;
 
        var default_back = function(){ app.require(config.dataview);};                    
        config.type    = "space"    ;
        config.css     = "form-view";
        config.rows    =
        [
            {
                id       : config.store+"_form" ,
                view     : 'form'               ,
                type     : "space"              , 
                margin   : 0                    ,
                padding  : 0                    ,
                elements :
                [ 
                    {
                        view    : "toolbar"          ,
                        css     : "toolbar-interior" ,  
                        type    : "space"            , 
                        margin  :  0                 ,
                        padding :  0                 ,
                        height  : 70                 ,
                        cols    :
                        [ 
                            {
                                view      : "button"       , 
                                type      : "icon"         , 
                                icon      : "fa fa-chevron-left" ,
                                css       : "app_button"   ,  
                                width     : 45             , 
                                align     : "center"       , 
                                borderless: true           ,
                                click     : config.back != undefined ? config.back : default_back
                            },
                            { id : config.store+"_title", view  : "label" },
                            { id : config.store+"_extra", width : 1       },
                            { id : config.store+"_fecha", width : 1       }, 
                            {
                                id        : config.store+"_btn",
                                go        : config             ,
                                root      : _that              ,
                                view      : "button"           , 
                                type      : "icon"             , 
                                icon      : "fa fa-save"             , 
                                align     : "center"           , 
                                css       : "app_button"       , 
                                borderless: true               ,
                                disabled  : true               ,
                                width     : 56                 ,
                                click     : function()
                                { 
                                    var that   = this.config.root; 

                                    var config = this.config.go; 

                                    if(config.validate!=undefined)
                                    {
                                        if( $$(config.store+"_form").validate() && config.validate==true )
                                        {
                                            that.callEvent("onFormSubmmited", [__.getFormPost(config.store+"_form")]);  

                                            __.sendPost({"action":config.update}, __.getFormPost(config.store+"_form") , config.dataview); 
                                        }
                                        else 
                                        {
                                            webix.message({type:"error", text: "¡Error! Complete correctamente los campos"});  
                                        } 
                                    }
                                    else
                                    {
                                        that.callEvent("onFormSubmmited", [__.getFormPost(config.store+"_form")]);  

                                        __.sendPost({"action":config.update}, __.getFormPost(config.store+"_form") , config.dataview); 
                                    }  
                                }                    
                            }
                        ]
                    }, 
                    config.elements
                ]
            }
        ];

        this.$ready.push(this.render);

    },
    render: function()
    {
        var that = this;

        setTimeout(function()
        {  
            if(__.current[that.store]!=undefined)
            {  
                $$(that.store+"_title").setValue( that.title_set);
                __.setTitle(that.title_set);
 
                __.GET(that.source, function(data){ 
                    $$(that.store+"_btn" ).enable();
                    $$(that.store+"_form").setValues(data);
                    that.mobile_input();
                    that.callEvent("formReady", [that.$view, true]);  
                });
            }
            else
            {
                if(that.store!=undefined)
                {
                    $$(that.store+"_btn" ).enable();
                    $$(that.store+"_title").setValue( that.title_add); 
                    __.setTitle(that.title_add);
                    that.mobile_input();
                    that.callEvent("formReady", [that.$view, false]);  
                }
            }

        }, 25);
    },

    mobile_input : function()
    {
        if(__.mobileAndTabletcheck())
        {
            var items = document.querySelectorAll(".form-view .webix_el_text .webix_el_box input");

            for(var i in items)
            {
                if(typeof items[i] == "object")
                { 
                    items[i].onfocus = function()
                    {
                        if( this.parentElement.parentElement.classList.contains("focus-input") == false )
                        {
                            this.parentElement.parentElement.classList.add("focus-input");
                        } 

                        if( document.querySelector(".focus-scroll").classList.contains("scroll-active") == false )
                        {
                            document.querySelector(".focus-scroll").classList.add("scroll-active");
                        }
                    }; 

                    items[i].onblur = function()
                    {
                        if( this.parentElement.parentElement.classList.contains("focus-input") == true )
                        {
                            this.parentElement.parentElement.classList.remove("focus-input");
                        }

                        if( document.querySelector(".focus-scroll").classList.contains("scroll-active") == false )
                        {
                            document.querySelector(".focus-scroll").classList.remove("scroll-active");
                        }
                    };  
                }
            }
        }
    },

    dataview_setter   :function(value) { this.dataview    = value; },
    update_setter     :function(value) { this.update      = value; },
    elements_setter   :function(value) { this.elements    = value; },  
    store_setter      :function(value) { this.store       = value; }, 
    title_set_setter  :function(value) { this.title_set   = value; }, 
    title_add_setter  :function(value) { this.title_add   = value; },  
    source_setter     :function(value) { this.source      = value; }  

}, webix.EventSystem, webix.ui.layout);    