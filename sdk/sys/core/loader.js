(function(){
    var hash = function(){
        return +(+new Date);
    };
    this.usr  ={};
 
    this.__loader = 
    { 
        version      : "2.2-production"    ,
        name         : ""    ,
        loaded       : 0     , 
        stack        : []    , 
        current      : ""    , 
        view         : ""    , 
        start        : null  , 
        end          : null  , 
        source       : []    ,
        afterloadfn  : function(){}, 
        is_ready     : false ,
        fails        : []    ,
        process      : false ,
        base         : ""    ,
        stamp        : "refresh="+hash() ,
        force        : true  ,  
        modulos      : {}    ,
        counter      : {}    , 
        _project_url : ""    ,
        require_force: true  , 
        autorefresh  : true  , 
        log_internal : false  ,
        cssLoader    : "overflow: hidden; border:0; margin:0; padding:0;box-sizing: border-box; background-color: #1C2B2D; background-image: url('#url#sdk/ui/img/onseller-dark.png?id=1'); background-size:25%; background-attachment: fixed; height: 100%;width: 100%; height: 100vh;width: 100vw; background-position: center center; background-repeat: no-repeat; transition: all .5s ease; ",
        iphoneDevice : function() 
        {
            var iDevices = [
                'iPad Simulator',
                'iPhone Simulator',
                'iPod Simulator',
                'iPad',
                'iPhone',
                'iPod'
            ];
            if (!!navigator.platform) 
            {
                while (iDevices.length) 
                { 
                    if (navigator.platform === iDevices.pop()){ return true; }
                }
            }
            return false;
        },
        pcDevice: function()
        { 
            if (!!navigator.platform) 
            { 
                if (navigator.platform === "Win32"){ return true; } 
            }
            return false;
        },
        getModule    : function(url)
        {
            var urlsplit    = url.split(this.base).join(""); 
            var urlmodule   = urlsplit.split("/").join(".").split("..").join("").split(".json").join("").split(".css").join("").split(".js").join("");
            var tmp         = urlmodule.split("?");
            urlmodule       = tmp[0];
            return urlmodule;
        },
        setDomAttribute : function(dom, key, value)
        {
            var atribute         = document.createAttribute(key);  
            atribute.value       = value;  
            dom.setAttributeNode(atribute);  
        },
        before : function(e)
        {  
            e.setAttribute("load", "true"); 
        },
        after : function()
        { 
        },
        bootcallback: function (e, callback) 
        { 
            var that = this;
            that.before(e);
            return function()
            {  
                callback();    
                that.after(); 
            };
        }, 

        set_view_port: function(initial, maximum, minimum)
        {
            var that = this;

            var wp = document.querySelector("meta[name='viewport']");

            if(wp==null) 
            {
                wp = document.createElement("meta");    
                that.setDomAttribute(wp, "name"   , "viewport");  
                document.getElementsByTagName("head")[0].appendChild(wp);
            } 

            wp.setAttribute("content", "width=device-width, initial-scale="+initial+", maximum-scale="+maximum+", minimum-scale="+minimum+", user-scalable=no, shrink-to-fit=no"); 
        }, 

        basis: function()
        {
            var that = this;
 
            var e   = document.createElement("meta");  
            that.setDomAttribute(e, "charset", "UTF-8");  
            document.getElementsByTagName("head")[0].appendChild(e);
             
            var e   = document.createElement("meta");  
            that.setDomAttribute(e, "name"   , "apple-mobile-web-app-capable");  
            that.setDomAttribute(e, "content", "yes"); 
            document.getElementsByTagName("head")[0].appendChild(e);
 
            that.set_view_port("1","1","1");

            document.body.style.cssText = that.cssLoader.split("#url#").join( that.project_url() ); 
        },
        ready : function(callback)
        { 
            var that = this;
            document.addEventListener("DOMContentLoaded", function(event) 
            {
                that.is_ready = true;
                 
                callback();
            }); 
        },
        setSource : function(value)
        {
            this.source = value ;
        },
        finalize : function()
        {      
            __loader.end = Date.now(); 
      
            if( __loader.process  == false) 
            {
                document.body.style.cssText = "";
                document.body.innerHTML ="";
            }
 
            __loader.afterloadfn();
        },
        getHash : function()
        {
            var uri     = window.location.href;
            var uris    = uri.split("#!"); 
            var link    = "";
         
            for( var i in uris)
            {
                if( i ==1 ) if(uris[i])  link = uris[i]; 
            } 
            return link; 
        },
        log : function(file, message)
        {
            if(__loader.log_internal ==true)
            {
                console.log
                ( 
                    new Date().getHours()+":"+new Date().getMinutes()+":"+new Date().getSeconds()+"."+new Date().getMilliseconds()  , 
                    file, 
                    message
                );
            }
        },
        project_url : function()
        {
            return this._project_url;
        },
        base_url : function()
        {
            return this.base;
        },
        stairs : function(value)
        {
            
            var that = this;
            that.fails = [];
            that.setSource(value); 
            that.start = Date.now();   
            var runnable = function()
            {  
                var fn = function()
                {   
                    var item = that.source.shift();
                    if(item == undefined) that.finalize();
                    that.log("sys.core.loader",  "stairs ("+that.source.length+") " + that.getModule(item.url) );
 
                    that.load(item.tag,  item.url, item.cache!= undefined ? item.cache : true ,  that.source.length == 0 ? that.finalize :  fn);    
                };
                fn(); 
            };
         
            if( that.is_ready == true ) 
            { 
                runnable(); 
            }
            else
            {
                that.ready(runnable);
            } 

            return runnable;
        },
        load : function( tag, url, cache, callback)
        {  
            var that = this;
            that.loaded++;  
            that.stack.push(url);
            that.current = url;

            switch(tag)
            {
                case "template"  : 

                    that.ajax_native(that.project_url() + url + ( cache != true  ? ( url.indexOf("?")>-1 ? "&": "?" ) + "refresh="+hash():"" ), function(responseText){
 
                        var modulo = app.getModule(url);

                        __.templates[modulo]=responseText;

                        callback();
                    }); 

                break;


                case "json":
                    that.ajax_native(that.project_url() + url + ( cache != true  ? ( url.indexOf("?")>-1 ? "&": "?" ) + "refresh="+hash():"" ), function(responseText){
                        var json = eval('('+responseText+')');
                        for(var i in json)
                        { 
                            usr[i]= json[i];
                        }
                        callback();
                    });
                break;
                case "icon":
                    var e = document.createElement("link");
                    that.setDomAttribute(e, "rel", "shortcut icon"); 
                    e.href = ( url.indexOf("//")>-1 ? "" : that.project_url() ) + url + ( cache != true  ? ( url.indexOf("?")>-1 ? "&": "?" ) + "refresh="+hash() :"" );
                  
                    document.getElementsByTagName("head")[0].appendChild(e);
                    callback();
                break;

                case "image": 
                
                    var e=new Image();
                    e.src=url;
                    e.onload = callback;

                break;

                default: 
                    var e = document.createElement(tag)

                    if( tag == "script" ) that.setDomAttribute(e, "module", that.getModule(url)); 
                    that.setDomAttribute(e, "load", "false"); 
                    that.setDomAttribute(e, "charset", "UTF-8"); 
                    if( tag == "script" ) e.type = "text/javascript";
                    if( tag == "link"   ) e.type = "text/css"; 
                    e.onerror = function()
                    {  
                        that.log("sys.core.loader", "load error: " + url);
                        that.fails.push(url);  
                        e.setAttribute("load", "false"); 
                        that.bootcallback(e, callback)();  
                    }; 
                  
                    if (e.readyState)
                    {   
                        e.onreadystatechange = function()
                        {
                            if (e.readyState == "loaded" ||  e.readyState == "complete")
                            {
                                e.onreadystatechange = null;
                                that.bootcallback(e, callback)();
                            }
                            else
                            {
                                that.log("sys.core.loader", "load state change: " + url + "( "+e.readyState+" )");
                            }
                        };
                    } 
                    else 
                    {   
                        e.onload = that.bootcallback(e, callback);
                    } 
                    if( tag == "script" ) e.src   = ( url.indexOf("//")>-1 ? "" : that.project_url() ) + url + ( cache != true  ? ( url.indexOf("?")>-1 ? "&": "?" ) + "refresh="+hash() :"" );
                    if( tag == "link"   ){ e.href = ( url.indexOf("//")>-1 ? "" : that.project_url() ) + url + ( cache != true  ? ( url.indexOf("?")>-1 ? "&": "?" ) + "refresh="+hash() :"" );  e.rel = "stylesheet"; }
                    document.getElementsByTagName("head")[0].appendChild(e);
                break;
 
                
            }
 
        },  
        ajax_native : function(url, callback)
        {
            var that =  this;
            var xmlhttp = new XMLHttpRequest(); 
            xmlhttp.onreadystatechange = function()
            {
                if(that.iphoneDevice())
                {
                    if (xmlhttp.readyState == 4 )
                    {
                        callback(xmlhttp.responseText);
                    }
                    else
                    {
                        that.log("sys.core.loader", "ajax request error ( status " +xmlhttp.readyState+" / code "+xmlhttp.status+") " + url);
                    }
                }
                else
                {
                    if (xmlhttp.readyState == 4 && xmlhttp.status == 200)
                    {
                        callback(xmlhttp.responseText);
                    }
                    else
                    {
                        that.log("sys.core.loader", "ajax request error ( status " +xmlhttp.readyState+" / code "+xmlhttp.status+") " + url);
                    }
                }
            }
            xmlhttp.open("GET", url, true);
            xmlhttp.send();
        },
        autoload : function() 
        { 
            var that =  this;

            

            document.addEventListener("DOMContentLoaded", function(event) 
            {
                that.basis();

                if( navigator.onLine != undefined )
                {
                    that.log("sys.core.loader", "internet status: " + navigator.onLine);

                    if(navigator.onLine == false)
                    { 
                        
                        document.write("Esta app necesita conexion a internet para continuar<br><a href='javascript:location.reload()' style='color:white; padding-top:5px;'>Volver a Comprobar</a>");

                        return;
                    }

                }

                var bootin = ""; 
                 
                var result = document.querySelectorAll('script[bootin]'); 
                for(var i in result)
                {
                    var item = result[i]; 
                    try { bootin = item.getAttribute("bootin"); } catch(ex) { } 
                }
                var result = document.querySelectorAll('script[project-path]'); 
                for(var i in result)
                {
                    var item = result[i]; 
                    try { that._project_url = item.getAttribute("project-path"); } catch(ex) { } 
                }
                var result = document.querySelectorAll('script[base-url]'); 
                for(var i in result)
                {
                    var item = result[i]; 
                    try { that.base = item.getAttribute("base-url"); } catch(ex) { } 
                }


                if( bootin == "" ){ document.write("<h1>Bootin not found</h1><p>Please add source list</p>"); return; }
                
                that.ajax_native
                (
                    bootin, 
                    function(response)
                    {
                        var sourceList = eval('('+response+')');
              
                        that.is_ready = true; 
                        that.stairs(sourceList); 
                    } 
                );
            }); 
        }

    }; 
    this.app = {
        log: function(message)
        {  
            if(usr.log==true)
            {
                console.log(message);
            }
        },

        run : function(fn)
        {
            __loader.afterloadfn = fn;
        },

        define : function(name, _function)
        {
            var that =  __loader;
            that.modulos[name] = _function;
            if( that.counter[name]==undefined  ) that.counter[name] = 0;
        }, 
        require : function(name, _after_function)
        {  
            var that =  __loader;
            that.process = true;
            that.view = name;
            if( _after_function == undefined) _after_function =  function(o){     };
            var result = document.querySelectorAll('[module="'+name+'"]'); 
            var required = [];
            var create = false;
            if(result.length==0)
            {  
                create = true;
            }
            else
            {
                if(that.autorefresh == true)
                {
                    result[0].remove();
                    create = true;
                }
            }
            if(create == true)
            {
                var newlink = name;  
                var tmpa    = (newlink+"").split(".");
                newlink     = tmpa.join("/");
                newlink     = newlink+".js" + ( that.require_force == true  ? "?" + "refresh="+hash()  :"" ); 
 
                required.push({ tag : "script" , url: newlink });
            }
            if( required.length > 0 )
            { 
                that.stairs(required);
         
                app.run(function(){
                    if( that.fails.length > 0  )
                    {
                        for(var i in that.fails)
                        {
                            that.log("sys.core.loader", "Require fail to exec: " + that.fails[i]);
                        }
                    }
                    else
                    {
                        if( that.counter[name]==undefined  ) that.counter[name] = 1; else that.counter[name]++;
                        if( that.counter[name]==undefined  )
                            that.log("sys.core.loader", "Undefined module or non function: " + name);
                        var _before_function = ( that.modulos[name]!=undefined ?  that.modulos[name]() : null) ;
                        _after_function(_before_function);
                    }
                    
                });
            }
            else
            {
                if( that.counter[name]==undefined  )
                    that.log("sys.core.loader", "Undefined module or non function: " + name);
                if( that.counter[name]==undefined  ) that.counter[name] = 1; else that.counter[name]++;
                var _before_function = ( that.modulos[name]!=undefined ?  that.modulos[name]() : null) ;
               _after_function(_before_function);
            } 
             
        }
    };

    this.__loader.autoload(); 

})();