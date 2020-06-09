app.define("app.abm.clientes_form",function()
{   
    webix.ui
    ({
        id       : 'content',
        view     : "formview",
        dataview : "app.abm.clientes_view",
        update   : "clientes-update",
        source   : {"action": "clientes-row","id":  __.defAttr("clientes", 0, "id" )  }, 
        store    : "clientes",
        title_set: __.defAttr("clientes", "", "cliente" ),
        title_add: "NUEVO CLIENTE",
        elements :
        {
            padding:25,
            rows:
            [ 
                {
                    cols:
                    [
                        {
                            "name": "apellido",
                            "view": "text",
                            "label": "Apellidos",
                            labelPosition:"top"
                        },
                        { width: 25 },
                        {
                            "name": "nombre",
                            "view": "text",
                            "label": "Nombres",
                            labelPosition:"top"
                        },
                        { width: 25 },
                        {
                            "id":"cbCobrador",
                            "name": "id_cobrador",
                            "view": "combo",
                            "label": "Cobrador",
                            labelPosition:"top"
                        }
                        
                    ] 
                },
                { height: 25 },
                {
                    cols:
                    [
                        
                        {
                            "name" : "doc",
                            "view" : "text",
                            "label": "DNI", 
                            labelPosition:"top"
                        }, 
                        { width: 25 },
                        {
                            "name" : "addr",
                            "view" : "text",
                            "label": "Dirección", 
                            labelPosition:"top"
                        }, 
                        { width: 25 },
                        {
                            "name" : "tel",
                            "view" : "text",
                            "label": "Telefono", 
                            labelPosition:"top"
                        }
                         
                    ]
                },
                { height: 25 },
                {
                    cols:
                    [ 
                        {
                            "name"      : "fingreso",
                            "view"      : "datepicker",
                            "label"     : "Fecha de Ingreso",
                            labelWidth  : 150, 
                            format      : "%d %M %Y",
                            labelPosition:"top"
                        },
                        { width: 25 },
                        {
                            "name"      : "fegreso",
                            "view"      : "datepicker",
                            "label"     : "Fecha de Egreso",
                            labelWidth  : 150, 
                            format      : "%d %M %Y",
                            labelPosition:"top"
                        },
                        { width: 25 },
                        {
                            "name" : "activo",
                            "view" : "segmented",
                            "label": "Activo", 
                            labelPosition:"top",
                            options:[{id:1, value:"SI"},{id:0, value:"NO"}]
                        } 
                    ]
                },
                {} 
                 
            ]
        },
        on:
        {
            formReady: function (view) {
                __.PAYLOAD({"action":"databot"}, { 
                    select:
                    {
                        from:"cobradores", 
                        field: 
                        [
                            "id", 
                            { value: "CONCAT(@apellido,' ',@nombre)"} 
                        ]  
                    } 
                } , function(response){
                    
                    var result = JSON.parse(response); 
                    console.log("sql", result.sql, $$("cbCobrador"));
                    $$("cbCobrador").define("options",result.data); 
                    $$("cbCobrador").refresh();
                });


                webix.ui({
                    id        : "clientes_extra",
                    view      : "button",  
                    width     : 75, 
                    align     : "center", 
                    css       : "app_button", 
                    borderless: true, 
                    value     : "VENTAS",
                    click     :function(){

                        app.require("app.ventas_view");
                    }
                }, $$("clientes_extra"));
            }
        }
    },
    $$('content'));

});