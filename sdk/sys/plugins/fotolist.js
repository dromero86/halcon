webix.protoUI
({ 
    name    : 'fotolist',
    defaults:{ imageValue:'', defaultImage:'img/image.png' },
    $init: function(config) 
    {    
        var row      = []; 
		var template = ""; 
		var di       = "";
		var that     = this;
		var id       = (+(new Date()));
		 
		that.dataview   = "dat_vie_"+id; 
		that.btn_rem    = "btn_rem_"+id; 
		that.btn_upl    = "btn_upl_"+id; 
    
        that.pathImage  = config.pathImage;
		 
		row.push({  
            id          : that.dataview     ,
            name        : that.dataview     ,
            view        : "datatable"       ,
            select      : "row"             ,
            scroll      : "y"               ,
            drag        : 'order'           ,
            columns     : 
            [
                { id:"id"    , header:"Nro"   ,  width:50 },
                { id:"imagen", header:"Imagen", fillspace : true,  template:"<img src='#imagen#' style='height:30px' />" },
                { id:"path", header:"Link", fillspace : true,  template:"#imagen#" }  
            ]
		});
		
		row.push({ 
            margin:5,
            height:50, 
            cols:
            [
                { 
                    id     : that.btn_rem,
                    view   : "button", 
                    value  : config.textDrop!=undefined ? config.textDrop : "Eliminar seleccionado" , 
                    type   : "danger", 
                    height : 50      , 
                    click  : function()
                    { 
                        $$(that.dataview).remove($$(that.dataview).getSelectedId());
                    } 
                }, 
                {
                    id       : that.btn_upl,
                    view     : "uploader",   
                    upload   : config.uploadLink,  
                    value    : config.textUpload!=undefined ? config.textUpload : "Subir Imagenes",  
                    autosend : true ,
                    multiple : true ,
                    height   : 50   , 
                    on       : 
                    {
                        onBeforeFileAdd:function(item)
                        {
                            var type = item.type.toLowerCase(); 
                            
                            if (type != "jpg" && type != "png")
                            { 
                                webix.message({type:"error", text:"Only PNG or JPG images!"});
                                
                                return false;
                            }
                        }, 
                        onFileUpload:function(item)
                        {   
                            var idmax = 0;
                            
                            $$(that.dataview).data.each(function(obj){ idmax = parseInt(obj.id); });
                            
                            $$(that.dataview).add({ id: (idmax+1), imagen: config.pathImage+item.name, file:item.name  }, idmax+1);
                        } 
                    }
                }                               
            ]
		});
        
		config.rows = row ; 
    },   
    setValue:function(config)
    {  
        console.log("fotolist/setValue", config); 

        var item    = (!config ? [] : config.split(",") );  
        var element = []; 
        
        console.log("item", item); 

        for(var i in item)
        {  
            console.log("item", item[i]);
            if(item[i]!= undefined) 
                element.push({ id: (parseInt(i)+1), imagen: this.pathImage+item[i].trim(), file: item[i].trim() });
        }
 
        $$(this.dataview).parse(element);
    },	
	getValue: function()
	{  
        var item = [];  
        
        $$(this.dataview).data.each(function(obj){ item.push(obj.file);  }); 
        
        return item.join(","); 
	}
}, webix.ui.layout, webix.EventSystem); 