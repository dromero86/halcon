(function(w){





	var waves_class = function(){

		var that = this;

		that.selectors = [];



		that.add = function(value){

			that.selectors.push(value);

		};

		that.clear = function(){

			that.selectors=[];

		};

		that.add_wave_layer = function(point, box, selected){

			var option ="";

			if(that.selectors[selected].effect !=undefined)
			{
				option = that.selectors[selected].effect;
			}

			var e = document.createElement("div");
			that.setDomAttribute(e, "class", "waves-container");
			that.setDomAttribute(e, "style", " top:"+box.y+"px; left:"+box.x+"px; width:"+box.width+"px; height:"+box.height+"px; ");

			e.innerHTML="<div style='position:relative; width:"+box.width+"px; height:"+box.height+"px; z-index:1 '> <div class='waves "+option+"' style='z-index:1; position:absolute;  width:5px; height:5px;top:"+(point.y - box.y)+"px;left:"+(point.x - box.x)+"px;'></div> </div>";

			document.getElementsByTagName("body")[0].appendChild(e);

			setTimeout(function() { e.remove();  }, 1000);


			if(that.selectors[selected].after !=undefined)
			{
				that.selectors[selected].after();
			}
		
		};

		that.setDomAttribute = function(dom, key, value)
        {
            var atribute         = document.createAttribute(key);  
            atribute.value       = value;  
            dom.setAttributeNode(atribute);  
        };


		that.mouse_event =  function( event, selected )
		{ 
			var element = event.target; 
			//var element = this;
 			var clickIn = { x:0,y:0};
 			var box     = element.getBoundingClientRect();
 

      		clickIn.x = event.pageX;
      		clickIn.y = event.pageY;
 

      		that.add_wave_layer(clickIn, box, selected);
 
            return false;
		};


		that.service = function()
		{ 
            //webix.event(node.getNode(), "onlongtouch", that.mouse_event, {capture:false} ); 

            ///node.attachEvent("mousemove",that.mouse_event);
			
			document.body.addEventListener("mouseup", function(e){
 

				for(var i in e.path)
				{
					for(var j in that.selectors)
					{ 
						if(e.path[i].classList !=undefined )
							if(e.path[i].classList.contains(that.selectors[j].css) == true)
							{
								that.mouse_event(e, j);
							}
					}
				}
			});

 
		}; 

 		
 		that.service();
	};

	w.waves = new waves_class();

})(window);