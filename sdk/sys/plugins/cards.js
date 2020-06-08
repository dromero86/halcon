
webix.protoUI
({ 
    name    : 'cards',  
    defaults:{
        css     : "shadow",
        height  : 180,
        template: "<table class='card_home card_#color#'><tr> <td class='icon'> <span class='webix_icon webix_sidebar_icon fa-#icon#'></span> </td> <td class='values'> <h3>#value#</h3> <p>#label#</p> </td> </tr></table>",
        data    : {
            color : "red"     ,
            icon  : "question",
            value : "0"       ,
            label : "Undefined"
        }
    },

    $init: function(config) 
    {  
        this.$ready.push(this._initCard);
    },

    _parse_data : function(){ 
        this.$view.innerHTML ="<div class='card-template webix_template'>"+this.config.template(this,this)+"</div>";
    },

    _initCard :  function(){ 
        
        this._parse_data(); 
    },

    color_setter   : function(value) { this.color = value; this._parse_data(); },
    icon_setter    : function(value) { this.icon  = value; this._parse_data(); },
    value_setter   : function(value) { this.value = value; this._parse_data(); },
    label_setter   : function(value) { this.label = value; this._parse_data(); },

    setValue : function(value){
        var that  = this; 
        
        that.value = value;

        that._parse_data();
    },
}, webix.ui.template, webix.EventSystem);  