webix.protoUI
({ 
    name    : 'mainbar',
    defaults: {   },
    $init   : function(config) 
    {     
        __.current["mb"]={open:true};

        config.css     = "main-toolbar";
        config.height  = 70            ;
        config.borderless = true;
        config.elements=[  
            {
                id:"_mb_logo",
                css: "main_logo",
                template:"<center class='logospace'>#name#</center>",
                data:{ name:usr.name.toUpperCase() },
                borderless:true,
                width: 250
            }, 
            {
                id   : "_main_btn_action" , 
                view : "button"    ,
                type : "icon"      ,
                icon : "bars"      ,
                align: "center"      ,
                css  : "acople",
                width: 56,
                click: function()
                {
                    if(__.current["mb"].open == true)
                    {
                        webix.ui({
                            id:"_mb_logo",
                            css: "main_logo",
                            template:"<center>#name#</center>",
                            data:{ name:"GN" },
                            borderless:true,
                            width: 90
                        }, $$("_mb_logo"));
 
                        __.current["mb"].open =false;
                    }
                    else
                    {
                        webix.ui({
                            id:"_mb_logo",
                            css: "main_logo",
                            template:"<center>#name#</center>",
                            data:{ name:usr.name.toUpperCase() },
                            borderless:true,
                            width: 250
                        }, $$("_mb_logo"));
 
                        __.current["mb"].open =true;
                    }
                    $$("_sidebar").toggle();
                }           
            },
            { 
                id         : "_main_search"      ,
                css        : "acople input-text" , 
                width      : 440
            },
            { css:"acople"}, 
            {
                id    : "_main_tool_option",
                view  : "button"           ,
                type  : "icon"             ,
                icon  : "ellipsis-v"       ,
                align : "right"            ,
                css   : "acople"           , 
                width : 56                 ,
                popup:"my_pop"
            } 
        ];   
    }
},  
webix.ui.toolbar);  