app.define("app.settings.main", function()
{ 
    webix.ui
    ({ 
        id         : "content"   , 
        width      : '100%'      ,
        height     : 'auto'      , 
        type       : "space"     , 
        css        : "form-view" ,
        borderless : true        ,
        rows       :
        [  
            {
                view    : "toolbar",
                css     : "toolbar-interior",  
                type    : "space", 
                margin  :  0,
                padding :  0,
                height  : 70,
                cols    :
                [ 
                    {
                        view      : "button", 
                        type      : "icon", 
                        icon      : "chevron-left",
                        width     : 45, 
                        align     : "center", 
                        css       : "app_button", 
                        borderless: true,
                        click     : function()
                        { 
                            app.require("app.dashcenter");
                        }                    
                    },
                    { 
                        view    : "label" ,
                        label   : "SETTINGS"
                    } 
                ]
            }, 
            { 
                cols:
                [
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    },
                    { width: 25   },
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    },
                    { width: 25  },
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    },
                    { width: 25  },
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    } 
                ]
            },
            { height:25 },
            { 
                cols:
                [
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    },
                    { width: 25   },
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    },
                    { width: 25  },
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    },
                    { width: 25  },
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    } 
                ]
            },
            { height:25 },
            { 
                cols:
                [
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    },
                    { width: 25   },
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    },
                    { width: 25  },
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    },
                    { width: 25  },
                    {
                        view   : "dashcard", 
                        color  : "red",
                        icon   : "dashboard",
                        value  : "$ 2345",
                        label  : "New Projects",
                        height : 180  
                    } 
                ]
            },
            {}  
        ]
    }, $$("content")); 

});