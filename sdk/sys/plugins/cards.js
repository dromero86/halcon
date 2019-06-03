
webix.protoUI
({ 
    name    : 'dashcard',  
    $init: function(config) 
    {
        // height:180
    
        var tpl= [];

        tpl.push("<table class='card_home card_#color#'>");
        tpl.push("<tr>");
        tpl.push("<td class='icon'>");
        tpl.push("<span class='webix_icon webix_sidebar_icon fa-#icon#'></span>");
        tpl.push("</td>");
        tpl.push("<td class='values'>");
        tpl.push("<h3>#value#</h3>");
        tpl.push("<p>#label#</p>");
        tpl.push("</td>");
        tpl.push("</tr>");
        tpl.push("</table>");


        config.css      = "shadow";
        config.template = tpl.join("");
        config.height   = 180;
    }  
}, webix.ui.template);  