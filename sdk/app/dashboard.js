app.define("app.dashboard",function()
{   
    webix.ui
    ({
        id  : "app.page",  
        rows:
        [
            {
                id  : "app.header", 
                cols:
                [
                    { view : "mainbar", id:"app.mainbar" }
                ]
            },
            {
                id:"app.body",
                cols:
                [
                    {
                        id          : "_sidebar",
                        view        : "sidebar", 
                        data        : usr.menu , 
                        borderless  : true,
                        on          :
                        {
                            onItemClick: function(id)
                            { 
                                if( __.isNumber(id)) return;

                                $$("content").disable();

                                app.require( this.getItem(id).id );
                            } 
                        }
                    },
                    {   id :"content"  }
                ]
            }
        ]
    }); 

    webix.ui
    ({
        view      : "popup",
        id        : "my_pop",
        css       : "toolbar-popup",
        head      : "Submenu",
        width     : 170,
        borderless: true,
        margin    : 0,
        padding   : 0,
        body      :
        {
            view      : "list", 
            borderless: true,
            margin    : 0,
            padding   : 0,
            type      : { height:48  },
            template  : "<span class='webix_icon fa-#icon#'></span> #name#", 
            select    : true,
            autoheight: true,
            data      :
            [
                { id: "app.settings.main" , name:"Settings" , icon: "cog"      }, 
                { id: "sys.widget.logout" , name:"Logout"   , icon: "power-off"} 
            ],
            on        :
            {
                onItemClick: function(id)
                { 
                    if( __.isNumber(id)) return; 

                    $$("my_pop").hide();

                    app.require( this.getItem(id).id );
                } 
            }            
        }
    });

    waves.clear();

    app.require("app.dashcenter", function(){

        waves.add({ css: "webix_tree_item" , effect: "waves-dark"});
        waves.add({ css: "webix_el_button" }); 
        waves.add({ css: "logospace" , effect: "waves-blue" });  
    });
});
