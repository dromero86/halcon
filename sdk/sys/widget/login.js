app.define("sys.widget.login",function()
{
    try{ $$("_login").hide(); }catch(ex){ }

    __.changeUri("sys.widget.login");  

    __.setTitle("Bienvenido");

    var onSubmit = function(event)
    {  

        $$("_login").disable();

        var post = $$("_Flogin").getValues();

        __.POST( { "action": usr.session.login }, post , function(o)
        {
            try{ $$("_login").close(); }catch(ex){ }

            __.session.on.login(o);

        });
    };
 
    webix.ui
    ({
        id          : "_login"    ,
        css         : "login"     ,
        view		: "window"    ,
        head		: usr.name    ,
        headHeight  : 70          ,
        position	: "center"    ,
        modal       : true        ,
        borderless  : true        ,
        margin      : 0           ,
        padding     : 0           ,
        body		:
        {
            id          : "_Flogin",
            view		: "form"   ,
            elements	:
            [
                { 
                    height      : 50       ,
                    id          : '_f1user',  
                    name        : 'user'   , 
                    view        : "text"   , 
                    placeholder : "Usuario" 
                },
                {
                    height      : 50          ,
                    id          : '_f2user'   ,
                    name        : 'pass'      ,
                    view        : "text"      ,
                    placeholder : "Contraseña",
                    type        : "password"  ,
                    labelWidth  : 100 
                },
                {height: 20},
                {
                    height:45,
                    cols:
                    [
                        {},
                        { 
                            id    : "submit"    , 
                            view  : "button"    , 
                            value : "INGRESAR"  , 
                            css   : "btn"       ,  
                            width : 100
                        }
                    ]
                }
                
            ],
            rules: {  user : webix.rules.isNotEmpty   }
        }
    });


    $$("_login").show();
    $$('_f1user').focus();
 
 
    document.querySelector('[view_id="_f2user"] div input').onkeyup  = function(key){ 

        if(key.code == "Enter") 
            onSubmit(key);  
    };

    document.querySelector(".webix_modal").classList.add("login-modal");
 

    waves.add({css:"webix_win_head"}); 
    waves.add({css:"btn", after: onSubmit}); 

    

    //waves.node($$("submit")); 
});
