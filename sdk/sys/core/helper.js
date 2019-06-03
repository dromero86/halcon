(function(){

    this.__ = {

        current : {},
        struct  : {},
        show    : { current:'content'   , old: '' },
        context : { current:'option'    , old: '' },

        base_url : function()
        {
            return __loader.base;
        },


        ext_url : function()
        {
            return __loader.domain;
        },

        IsJsonString : function(str) 
        {
            try 
            {
                JSON.parse(str);
            } 
            catch (e) 
            {
                return false;
            }
            return true;
        },

        addslashes : function(str) {

          return (str + '')
            .replace(/[\\"']/g, '\\$&')
            .replace(/\u0000/g, '\\0');
        },

        req : function(object)
        {
            var item = [];
            var dt = (+new Date());

            for (var i in object)
            {
                var value = object[i];
                var key   = i;

                item.push(key+"="+value);
            }

            item.push("rid="+dt);

            return __loader.base_url()+"?"+item.join("&");
        },


        GET : function(request, callback)
        {
            var that = this;

            webix.ajax().get( that.req(request), {}, function(text, xml, xhr)
            {

                if( that.IsJsonString(text)  ) 
                {
                    callback(JSON.parse(text));
                }
                else
                    callback({ error:"Content non json format", url: that.req(request), ajax: xhr });
            });
        },
         
        POST : function(request, post,  callback)
        {  
            var that = this;

            webix.ajax().post( that.req(request), post, {

                success: function(text, data, XmlHttpRequest)
                { 

                    if( that.IsJsonString(text) )
                    {
                        var AllwaysJSON = JSON.parse(text);

                        callback(AllwaysJSON);    
                    }
                    else
                    {
                        console.log("Error", that.req(request), post, text, data);
                    }

                    
                },
                error: function(text, data, XmlHttpRequest)
                {
                    console.log("Error", that.req(request), post, text, data, XmlHttpRequest);
                }
            });
        },

        PUT: function (request, post,  callback)
        {
            var that = this; 

            webix.ajax().put( that.req(request), post, {

                success: function(text, data, XmlHttpRequest)
                { 

                    if( that.IsJsonString(text) )
                    {
                        var AllwaysJSON = JSON.parse(text);

                        callback(AllwaysJSON);    
                    }
                    else
                    {
                        console.log("Error", that.req(request), post, text, data);
                    }

                    
                },
                error: function(text, data, XmlHttpRequest)
                {
                    console.log("Error", that.req(request), post, text, data, XmlHttpRequest);
                }
            });
        },

        PAYLOAD: function(request, post,  callback)
        {
            var that = this; 

            webix.ajax().headers({"Content-type":"application/json" }).post(that.req(request), JSON.stringify(post), callback);
        },

        dataFill : function( view, url)
        {
            $$(view).clearAll();
            $$(view).load( this.req(url) );    
        },

        comboFill: function(view, json)
        {
            $$(view).define("options",json); 
            $$(view).refresh();
        },

        setView : function(name)
        {
            if( name != this.show.current)
            {
                this.show.old     = this.show.current;
                this.show.current = name ;
            }
            else
                throw "Error, la pagina se invoco 2 veces";
        },

        changeUri : function(module)
        {
            history.pushState(null, null, '#!'+module);
        },

        setTitle : function(title)
        {
            document.title = title+" - "+usr.name;
        },

        isNumber: function(n) {
          return !isNaN(parseFloat(n)) && isFinite(n);
        }

    };

})();
