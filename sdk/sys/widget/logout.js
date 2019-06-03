app.define("sys.widget.logout",function()  
{   
    webix.ui
    ({
        id          : "_exit",
        css         : "logout",
        view        : "window",
        head        : "¿Desea salir de "+usr.name.toLowerCase()+"?",
        headHeight  : 70,
        position    : "center",
        modal       : true,
        width       : 400, 
        borderless  : true,
        margin      : 0,
        padding     : 0,
        body        :
        {
            id          : "_Fexit",
            view        : "form"  ,
            borderless  : true    ,
            elements    :
            [
                { 
                    css        : "message"  ,
                    borderless : true       ,
                	view       : "template" , 
	                template   : "Esto cerrara su sesión con la aplicación y debera ingresar nuevamente" ,
                    height     : 80 
	            }, 
                {
                    borderless:true,
                    cols:
                    [
                        { borderless:true },
                        {
                            width : 85, 
                        	view  : "button"    , 
                        	value : "CANCELAR"  , 
                        	click : function()
                        	{  
                                $$("_exit").destructor();
                        	} 
                        }, 
                        {
                            width : 85, 
                        	view  : "button"   ,   
                        	value : "SALIR"    , 
                        	click : function()
                        	{
						        __.POST( { "action": usr.session.logout  }, {} , function(o)
						        {  
						            __.session.on.logout(); 

                                    $$("_exit").destructor();

                                    location.reload();
						        }); 
                        	}
                        }
                    ]
                } 
            ]
        }
    });

    $$("_exit").show();

    document.querySelector(".webix_modal").classList.add("logout-modal");

}); 