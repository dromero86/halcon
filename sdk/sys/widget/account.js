app.define("sys.widget.account",function()
{
    app.changeUri("sys.widget.account");

    app.setTitle("Mi cuenta - "+app.name);

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
                                        app.require("cms.sys.dash");
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
                                        window.post({"action": "update-cuenta"}, $$("form_cuenta").getValues(), function(o)
                                        {
                                            webix.message("Actualizado exitosamente");
                                            app.require("ui.sys.dashboard");
                                        });
                                    }
                                }
                            ]
                        },
                        {
                            id      : "form_cuenta",
                            view    : "form",
                            url     : req({"action": "request-account"}),
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
