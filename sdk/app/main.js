app.run(function()
{  
	webix.ready(function()
	{   
		webix.ui.fullScreen();  
        
        webix.Touch.enable ();  

        if(usr.session.enable == true )
        {
            app.require("sys.core.session", function(session) 
            { 
                __.session = session; 
                __.session.on.check(); 
            });             
        }
        else
        {
            app.require("app.dashboard", function(){
                
            });
        }
 
	}); 
}); 