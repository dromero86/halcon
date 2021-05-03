app.define("app.dashcenter", function()
{  
    __.setTitle("Bienvenido");
    webix.ui
    ({
        id      : "content",  
        type    : "space", 
        borderless: true,
        rows:
        [  
            { height: 24, css:"spacer"},
            {
                css:"spacer" ,
                cols:
                [
                    { width: 20, css:"spacer" },
                    {
                        rows:
                        [
                            { template:"<div class='notify'>Like what you see? this is a preliminar version of work.</div>", css:"shadow", height:85 },
                            { height: 20, css:"spacer" },
                            {
                                height: 160,
                                cols:
                                [
                                    { id:"_vehiculos", view:"cards", height: 150, css:"card_naranja", color: "orange", icon:"ticket", value:123, label:"Eventos" },
                                    { width: 30, css:"spacer" },
                                    { id:"_personal", view:"cards", height: 150, css:"card_naranja", color: "orange", icon:"address-book", value:123, label:"Invitados"  },
                                    { width: 30, css:"spacer" },
                                    { id:"_mantenimientos", view:"cards", height: 150, css:"card_naranja", color: "orange", icon:"shopping-bag", value:123, label:"Productos" }
                                ]
                            },
                            { height: 20, css:"spacer" },
                            {
                                height: 160,
                                cols:
                                [
                                    { id:"_arribos", view:"cards", height: 150, css:"card_naranja", color: "orange", icon:"truck", value:123, label:"Distribuidoras" },
                                    { width: 30, css:"spacer" },
                                    { id:"_barcos", view:"cards", height: 150, css:"card_naranja", color: "orange", icon:"flag", value:123, label:"Paises"  },
                                    { width: 30, css:"spacer" },
                                    { id:"_servicios", view:"cards", height: 150, css:"card_naranja", color: "orange", icon:"shopping-cart", value:123, label:"Pedidos" }
                                ]
                            },
                            { css:"spacer" }
                        ]
                    }, 
                    { width: 20, css:"spacer" }
                ] 
            },
            {css:"spacer"}
        ]
    }, $$("content")); 
 
     
});