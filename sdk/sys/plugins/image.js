webix.protoUI
({ 
    name    : 'image',
    defaults:{  asRow:true },
    $init: function(config) 
    {     
        var row      = []; 
		var template = ""; 
		var di       = "";
		var that     = this;
		var uniq     = (+(new Date()));
		var cssuniq  = "btn_"+(uniq).toString();
 
		that.uniq = uniq;
  
		if(config.asRow == true)
		    template = "<div class='webix_view webix_control webix_el_button css_plugin_image' style='height:100%'> <div class='webix_el_box' > <button type='button' class='webixtype_base "+cssuniq+"'> <table style='width:100%' id='"+uniq+"'> <tr> <td><img src='#value#' style='height:70px;' /></td> <td class='label_image'>#detalle#</td> </tr> </table>                       </button> </div> </div>";
		else
    	    template = "<div class='webix_view webix_control webix_el_button css_plugin_image' style='height:100%'> <div class='webix_el_box' > <button type='button' class='webixtype_base "+cssuniq+"'> <table style='width:100%' id='"+uniq+"'> <tr> <td style='width: 20px;'><img src='#value#' style='height:20px; width:20px' /></td>  <td class='label_image' >#detalle#</td> </tr> </table> </button> </div> </div>";
		
		row.push
        ({
            view :"label", 
            label: config.label,
            width: config.labelWidth != undefined ? config.labelWidth : 80 
		});

        var object = {};

        object[cssuniq]= function(ev)
        {  

            var winid = "win_"+this.config.id;
            var preid = "pvw_"+this.config.id;
            
            if(!that.value)
            {  
                $$("up_"+that.uniq).fileDialog();

                return false;
            }

            webix.ui
            ({
                view    : "window"    ,
                id      : winid       ,
                head    : config.label,
                modal   : true        ,
                position: "center"    ,
                width   : config.asRow == true ? ( document.body.clientWidth - 40 ) : 500  ,
                body    :
                {
                    rows:
                    [
                        { 
                            id        : preid,
                            minHeight : config.asRow == true ? ( document.body.clientWidth - 60 ) : 350 , 
                            template  : "<div style='text-align:center'> <img src='#value#' style='margin:auto;height:auto; max-width:100%; display:block' /> </div>" ,
                            data      : { value: that.pathImage+that.value }
                        },
                        {
                            cols:
                            [
                                {},
                                {
                                    width: 100,
                                    view:"button",
                                    value:"CERRAR",
                                    click: function()
                                    { 
                                        $$(winid).close(); 
                                    }
                                }
                            ]
                        } 
                    ] 
                },
                on:
                {
                    onShow : function()
                    {
                        __loader.ajax_native
                        (
                            that.pathImage+that.value, 
                            function(){ $$(preid).parse({ value: that.pathImage+that.value }); }, 
                            function(){ $$(preid).parse({ value: "cms/ui/img/warning.jpg" }); }
                        );

                    }
                }
            });
            
            $$(winid).show();

            return false;  
        };
		
        if(config.asRow == true)
        { 
            row.push({
    			id      : that.uniq, 
    			name    : config.idImage, 
    			type    : "template"    , 
    			css     : {"border":"0px !important" }, 
    			template: template,
                height  : 100,
                borderless:true,
    			data    : { value: config.defaultImage,  detalle:"Sin imagen"  },
                onClick : object
    		});
        }
        else
        {
            row.push({
                id      : that.uniq, 
                name    : config.idImage, 
                type    : "template"    ,  
                template: template, 
                data    : { value: config.defaultImage,  detalle:"Sin imagen"  },
                onClick : object
            });
        }

        
		 
		row.push({ 
            id       : "up_"+that.uniq,     
            imageloc : that.uniq,
			view     : "uploader",   
			type     : "icon"    ,
			icon     : "cloud-upload",
			upload   : config.uploadLink,  
			width    : (config.asRow == true ? "auto" : 130),
			label    : "Subir "+config.label, 
			autosend : true ,
			multiple : false,
			on       : 
			{
				onBeforeFileAdd:function(item)
				{
					var type = item.type.toLowerCase(); 
					
					if (type != "jpg" && type != "png" && type != "gif")
					{ 
						webix.message({type:"error", text:"Only PNG / JPG / GIF images!"});
						return false;
					}
				}, 
				onFileUpload:function(item)
				{ 
                    that.value = item.name;
  
					$$(this.config.imageloc).parse({ value:  config.pathImage+item.name, detalle:"Nuevo archivo" });
					
                    webix.message({type:"error", text:"Archivo transferido exitosamente"});
				},
                onFileUploadError: function(file, response)
                { 
                    webix.message({type:"error", text:"Error al subir archivo ("+file.sizetext+"): "+response.message});
                } 
			}
		});
        
        if(config.asRow == true)
		    config.rows = row ;
		else
		    config.cols = row ;
		 
  
    },   

    idImage_setter:function(config)
    {  
         this.idImage = config;
    },
    pathImage_setter:function(config)
    {  
         this.pathImage = config;
    },	
    label_setter:function(config)
    {  
         this.label = config;
    },	
    labelWidth_setter:function(config)
    {  
         this.labelWidth = config;
    },	
    uploadLink_setter:function(config)
    {  
         this.uploadLink = config;
    },	
    asRow_setter:function(config)
    {  
         this.asRow = config;
    },
    defaultImage_setter: function(config)
    {
        this.defaultImage = config;
    },
    required_setter: function(config)
    {
        this.required = config;
    },
    setValue:function(config)
    {   
        var that = this; 

        var findfile = that.pathImage+that.value;

        var load_check = false;

        if(config)
        {
            that.value = config;
            findfile   = that.pathImage+that.value;
            load_check = true;
        }
        else
        {
            if(!that.value)
            {
                $$(that.uniq).parse({ value: that.defaultImage, detalle: "Sin imagen"}); 
            }
            else
                load_check = true;
        } 


        if(load_check == true)
        {
            __loader.ajax_native
            (
                findfile, 
                function(){ $$(that.uniq).parse({ value: findfile, detalle: "Archivo encontrado"}); }, 
                function(){ $$(that.uniq).parse({ value: "cms/ui/img/warning.jpg", detalle: "File not found"}); }
            ); 
        }
    },	
	getValue: function()
	{
		return this.value;
	}, 

    validate: function()
    { 
        return (this.value != "");
    },
}, webix.EventSystem, webix.ui.layout); 