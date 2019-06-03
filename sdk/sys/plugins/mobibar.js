webix.protoUI
({ 
    name    : 'mobibar',
    defaults: {   },
    $init   : function(config) 
    {      

        config.css     = "main-toolbar";
        config.height  = 60            ;
        config.borderless = true;
        config.elements=[  
            {
                id   : "_main_btn_action" , 
                view : "button"    ,
                type : "icon"      ,
                icon : "bars"      ,
                align: "center"      , 
                borderless :true,
                width: 56,
                click: function()
                { 

                    if( $$("_sidebar").isVisible() ) $$("_sidebar").hide(); else $$("_sidebar").show();
                }           
            },
            {
                id         :"_mb_logo",
                css        : "main_logo",
                template   :"<center class='logospace'>#name#</center>",
                data       :{ name:usr.name.toUpperCase() },
                borderless :true 
            },  
            {
                id    : "_main_tool_option",
                view  : "button"           ,
                type  : "icon"             ,
                icon  : "ellipsis-v"       ,
                align : "right"            ,
                borderless :true, 
                width : 37                 ,
                popup:"my_pop"
            } 
        ];   
    }
},  
webix.ui.toolbar);  