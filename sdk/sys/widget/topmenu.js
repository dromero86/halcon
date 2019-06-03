app.define("sys.widget.topmenu",function()
{
	var id = webix.ui
	({
		view     : "sidemenu"   ,
		id       : "tools_menu" ,
		width    : 200       	,
		position : "top"     	,
		state    : function(state){ state.top = $$("header_site").$height; },
		css      : "topbarmenu" ,
		body     :
		{
			id         : "_bd_tool",
			borderless : true,
			margin     : 5  ,
			cols       :
			[
				{
					id       : "_ls_tool",
					view     : "list",
					scroll   : false ,
					select   : true  ,
					layout   : "x"   ,
					template : "<span class='webix_icon fa-#icon#'></span> #value#",
					type     : { width: "auto", height: 40 },
					data     :
					[
						{id: 1, value: "Mi cuenta", tpl:'sys.widget.account'	   },
						{id: 4, value: "Salir"    , tpl:'sys.widget.logout' 	   }
					],
					on:
					{
						onItemClick: function( e )
						{
							app.require( this.getItem(e).tpl );
							$$("tools_menu").hide();
							$$("_main_tool_option").config.isShow=false;
						}
					}
				}
			]
		}
	});

	return id;
});
