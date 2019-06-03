webix.protoUI
({ 
    name    : 'fileup',
    defaults:{ fileValue:'', defaultFile:'', idFile:'' },
    $init: function(config) 
    {
        var uniq     = (+(new Date()));
        var row      = [];  
		var di       = "";
		var that     = this; 
		
		that.idFile = "idtmp_"+uniq;
		that.fileValue = "";
		
		row.push({
            view:"label", 
            label: config.label,
            width: config.labelWidth != undefined ? config.labelWidth : 80,
			data : { value: that.defaultFile  }
		});
		 
        row.push({
			id      : that.idFile, 
			name    : that.idFile, 
			type    : "template"    , 
			css     : {"border":"0px !important" }, 
			template: "<table style='width:100%' id='"+uniq+"'> <tr> <td>#value#</td> </tr> </table>",
			data    : { value: that.defaultFile  }
		});
		 
		row.push({ 
			view     : "uploader",   
			type     : "icon"    ,
			icon     : "cloud-upload",
			upload   : config.uploadLink,  
			width    : 130,
			label    : "Subir "+config.fileType, 
			autosend : true ,
			multiple : false,
			on       : 
			{
				onBeforeFileAdd:function(item)
				{
					var type = item.type.toUpperCase(); 
					
					if (type != config.fileType)
					{ 
						webix.message({type:"error", text:"Only "+config.fileType+" extensions"});
						return false;
					}
				}, 
				onFileUpload:function(item)
				{ 
				    that.fileValue = item.name;
					$$(that.idFile).parse({ value:  that.path+item.name });
				} 
			}
		});
        
        if(config.asRow == true)
		    config.rows = row ;
		else
		    config.cols = row ;
		    
		setTimeout(function()
		{  
		    if(that.fileValue=="") 
		        $$(that.idFile).parse({ value: that.defaultFile});     
		      
		},1000);
    },      
    path_setter:function(config)
    {  
         this.path = config;
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
    defaultFile_setter: function(config)
    {
        this.defaultFile = config;
    },
    setValue:function(config)
    {    
         $$(this.idFile).parse({ value: this.path+config});
         
         
         try{ this.fileValue = config; }catch(ex){ console.log(ex, this); }
    },	
	getValue: function()
	{
		return this.fileValue;
	}
}, webix.ui.layout, webix.EventSystem); 