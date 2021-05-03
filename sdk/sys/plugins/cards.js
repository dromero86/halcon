webix.protoUI
({ 
    name    : 'cards',  
    defaults:{
        css     : "shadow",
        height  : 180,
        borderless: true,
        template: "<table class='card_home card_#color#'><tr> <td class='icon'> <div class='icon-wrap-#color#'><span class='webix_icon webix_sidebar_icon fa fa-#icon#'></span></div> </td> <td class='values'> <h3>#value#</h3> <p>#label#</p> </td> </tr></table>",
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
        this.$view.innerHTML ="<div class='card-template webix_template' style='padding:0'>"+this.config.template(this,this)+"</div>";
    },

    _initCard :  function(){  
        this._parse_data(); 
    },

    updateValue: function(value){
        this.value = value;
        this._parse_data();
    },

    color_setter   : function(value) { this.color = value; this._parse_data(); },
    icon_setter    : function(value) { this.icon  = value; this._parse_data(); },
    value_setter   : function(value) { this.value = value; this._parse_data(); },
    label_setter   : function(value) { this.label = value; this._parse_data(); },

    setValue : function(value){
        var that  = this;
        var oldv  = parseInt(this.value);
        var curr  = oldv;
        var newv  = parseInt(value);
        var delay = 15;

        if((newv-oldv) >= 1000) 
            delay = 5; 
        else
            if((newv-oldv) > 500)
                delay = 10;
            else
                if((newv-oldv) > 250)
                    delay = 25;
                else
                    if((newv-oldv) > 100)
                        delay = 50;
                    else
                        if((newv-oldv) > 50)
                            delay = 75;
                        else
                            if((newv-oldv) > 1)
                                delay = 100;
        

        if(newv>oldv)
            var timer = setInterval(function(){

                if(curr>=newv)
                { 
                    clearInterval(timer);
                    that.define("css", that.css+" card_end_count");
                    that.refresh();
                }
                else
                {
                    curr++;
                    that.value = curr;
                    that._parse_data();
                }
            },delay); 
    },
}, webix.ui.template, webix.EventSystem);  