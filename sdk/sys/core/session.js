app.define("sys.core.session",function()  
{   
    var session = 
    {
        isOnline        : false,
        module          : 'sys.widget.login',
        callAfterCheck  : true,
        postCallback    : function(o){ },

        config          :
        {
            url_check    : usr.session.check  , 
            sess_key     : usr.session.key    ,
            module_denied: "sys.widget.login" , 
            module_pass  : "app.dashboard"    
        },
 
        on:
        {   
            logout    : function()
            {  
                session.isOnline = false ;  
                session.module   = session.config.module_denied;  
                webix.message({type:"error", text: "Desconectado del servidor"}); 
                if( session.callAfterCheck ) app.require(session.module, session.postCallback);  
            },

            login    : function(server)
            {  
                session.isOnline = server.status ;
                session.module = server.status ? session.config.module_pass : session.config.module_denied;  
                if( session.isOnline == false ) 
                    webix.message({type:"error", text: server.message});
                     
                if( session.callAfterCheck ) app.require(session.module, session.postCallback);  
            },

            check    : function()
            { 
                __.GET( { "action": session.config.url_check },  session.on.afterCheck ); 
            }, 

            afterCheck : function( response )
            {  
                session.isOnline = response.status !=undefined ? response.status : false ;  
                
                if( session.isOnline == false ) 
                    webix.message({ type:"error", text: "Desconectado del servidor" });  


                session.module = session.isOnline ? session.config.module_pass : session.config.module_denied;  
                webix.storage.session.remove(session.config.sess_key); 
                webix.storage.session.put(session.config.sess_key, response);   
                if( session.callAfterCheck ) app.require(session.module, session.postCallback); 
            }
        } 
    };

    return session; 
});
