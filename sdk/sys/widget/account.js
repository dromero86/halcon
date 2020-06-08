app.define("sys.widget.account",function()
{
    __.changeUri("sys.widget.account");

    __.setTitle("Mi cuenta");

    webix.ui
    ({
        id    : "content",
        width : '100%'   ,
        height: 'auto'   ,
        rows  :
        [

            {
                view  : "scrollview",
                scroll: "y",
                body  :
                {
                    type  : "space",
                    rows  :
                    [

                        {
                            view  : "toolbar",
                            css   : "toolbar-active",
                            height: 70,
                            cols:
                            [
                                {
                                    view      : "button"     ,
                                    type      : "icon"       ,
                                    icon      : "angle-left" ,
                                    width     : 70           ,
                                    align     : "left"       ,
                                    css       : "app_button" ,
                                    borderless: true         ,
                                    click     : function()
                                    {
                                        app.require("app.dashcenter");
                                    }
                                },
                                {
                                    view    : "label",
                                    align   : "center",
                                    label   : "MI CUENTA"
                                },
                                {
                                    view      : "button"    ,
                                    type      : "icon"      ,
                                    icon      : "floppy-o"  ,
                                    width     : 70          ,
                                    align     : "left"      ,
                                    css       : "app_button",
                                    borderless: true        ,
                                    hotkey    : "Ctrl+S",
                                    click     : function()
                                    {
                                        __.POST({"action": "update-cuenta"}, $$("form_cuenta").getValues(), function(response)
                                        {
                                            webix.message("Actualizado exitosamente");
                                            app.require("app.dashcenter");
                                        });
                                    }
                                }
                            ]
                        },
                        {
                            id      : "form_cuenta",
                            view    : "form",
                            url     : __.req({"action": "request-account"}),
                            elements:
                            [
                                { template:"<b>Informacion Basica</b>", type:"section"},
                                {
                                    cols:
                                    [
                                        { view:"text", name:"nombre", label:"Nombre", inputWidth: 300, width: 400 },
                                        { view:"text", name:"apellido", label:"Apellido" },
                                        { view:"text", name:"mail", label:"Email" },
                                    ]
                                },

                                { height: 20 },

                                {
                                    view  : "fieldset",
                                    label : "Autenticación",
                                    body  :
                                    {
                                        rows:
                                        [
                                            { height: 20 },
                                            { view:"text",                  name:"user", label:"Usuario" , labelWidth:150 },
                                            { height: 20 },
                                            { view:"text", type:"password", name:"pass", label:"Password", labelWidth:150 },
                                            { height: 20 }
                                        ]
                                    }
                                },

                                { height: 20 },

                                { template:"<b>Ubicación</b>", type:"section"},

                                { view:"text", name:"tel", label:"Teléfono" },
                                { view:"text", name:"addr", label:"Dirección" }
                            ]
                        }
                    ]
                }
            }
        ]
    }, $$("content"));

});
