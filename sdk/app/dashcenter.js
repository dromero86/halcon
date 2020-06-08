app.define("app.dashcenter", function()
{  
    __.setTitle("Bienvenido");

    webix.ui
    ({
        id      : "content", 
        width   : '100%' ,
        height  : 'auto' , 
        type    : "space", 
        borderless: true,
        rows:
        [  
            { height: 24, css:"spacer"},
            {
                css:"spacer" ,
                cols:
                [
                    { width: 10, css:"spacer" },
                    {
                        rows:
                        [
                            { template:"<div class='notify'>Like what you see? Check out our premium version for more.</div>", css:"shadow", height:85 },
                            { height: 30, css:"spacer" },
                            {
                                cols:
                                [
                                    { css:"shadow", height:180, template:"<table class='card_home card_red'> <tr>  <td class='icon'> <span class='webix_icon webix_sidebar_icon fa-desktop'></span> </td> <td class='values'> <h3>$ 2344</h3> <p>New Projects</p> </td>  </tr>  </table>" },
                                    { width: 30, css:"spacer" },
                                    { css:"shadow", height:180, template:"<table class='card_home card_green'> <tr>  <td class='icon'> <span class='webix_icon webix_sidebar_icon fa-desktop'></span> </td> <td class='values'> <h3>$ 2344</h3> <p>New Projects</p> </td>  </tr>  </table>" },
                                    { width: 30, css:"spacer" },
                                    { css:"shadow", height:180, template:"<table class='card_home card_orange'> <tr>  <td class='icon'> <span class='webix_icon webix_sidebar_icon fa-desktop'></span> </td> <td class='values'> <h3>$ 2344</h3> <p>New Projects</p> </td>  </tr>  </table>" }
                                ]
                            },
                            { height: 30, css:"spacer" },
                            {
                                cols:
                                [
                                    { css:"shadow", height:180, template:"<table class='card_home card_red'> <tr>  <td class='icon'> <span class='webix_icon webix_sidebar_icon fa-desktop'></span> </td> <td class='values'> <h3>$ 2344</h3> <p>New Projects</p> </td>  </tr>  </table>" },
                                    { width: 30, css:"spacer" },
                                    { css:"shadow", height:180, template:"<table class='card_home card_green'> <tr>  <td class='icon'> <span class='webix_icon webix_sidebar_icon fa-desktop'></span> </td> <td class='values'> <h3>$ 2344</h3> <p>New Projects</p> </td>  </tr>  </table>" },
                                    { width: 30, css:"spacer" },
                                    { css:"shadow", height:180, template:"<table class='card_home card_orange'> <tr>  <td class='icon'> <span class='webix_icon webix_sidebar_icon fa-desktop'></span> </td> <td class='values'> <h3>$ 2344</h3> <p>New Projects</p> </td>  </tr>  </table>" }
                                ]
                            },
                            { css:"spacer" }
                        ]
                    },
                    
                    { width: 10, css:"spacer" }
                ] 
            }
        ]
    }, $$("content")); 
 
     
});