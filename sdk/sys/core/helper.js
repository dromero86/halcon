(function(){

    this.__ = {
        firex   : {},
        templates:{},
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
                        console.error(  that.req(request), post, text, data);
                    }

                    
                },
                error: function(text, data, XmlHttpRequest)
                {
                    console.error( that.req(request), post, text, data, XmlHttpRequest);
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
                        console.error(  that.req(request), post, text, data);
                    }

                    
                },
                error: function(text, data, XmlHttpRequest)
                {
                    console.error(  that.req(request), post, text, data, XmlHttpRequest);
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
        },

        mobileAndTabletcheck: function() 
        {
            var check = false;
            (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
            return check;
        },

        getFormPost: function(form_view)
        {
            var format = "%Y-%m-%d";
            var post   = $$(form_view).getValues(); 
            var fech   = webix.Date.dateToStr(format); 

            for(var i in post)
            {
                if( post[i] instanceof Date)
                {
                    post[i] = fech(post[i]);
                }
            }

            return post;
        },  

        sendPost: function(linkto, post, viewback)
        {
            webix.ajax().post( __.req(linkto) , post, function(text, xml, xhr)
            {    
                var json = eval('(' + text + ')');
 
                webix.message({type:"error", text: "actualizado correctamente"});  

                app.require(viewback); 
            });   
        },

        defKey: function(key, defval){
            return (__.current[key]==undefined ? defval : __.current[key] );
        },

        defAttr: function(key, dnil, attr){
            return (__.current[key]==undefined ? dnil : __.current[key][attr] );
        },  

        get_user: function()
        {
            var _session = webix.storage.session.get(usr.session.key);

            return _session == null ? false : _session;
        },

        SQLCombo: function(webix_id, query)
        {
            __.PAYLOAD
            (
                {"action":"databot"}, 
                query , 
                function(response)
                { 
                    var result = JSON.parse(response);  

                    $$(webix_id).define("options", result.data);
                    $$(webix_id).refresh();
                }
            );

        },
        SQLTable: function(webix_id, query)
        {
            __.PAYLOAD
            (
                {"action":"databot"}, 
                query , 
                function(response)
                {   
                    var result = JSON.parse(response); 
                      
                    $$(webix_id).clearAll();
                    $$(webix_id).parse(result.data);
                    
                }
            );

        },

        query: function(query, callback)
        {
            __.PAYLOAD
            (
                {"action":"databot"}, 
                query , 
                function(response)
                { 
                    var result = JSON.parse(response);  

                    callback(result.data); 
                }
            );
        },      

        query_combo: function(view, query)
        {
            __.PAYLOAD({"action":"databot"}, query , function(response)
            {    
                var result = JSON.parse(response); 
 
                $$(view).define("options",result.data); 
                $$(view).refresh();
            });
        },

        query_list: function(view, query)
        {
            __.PAYLOAD({"action":"databot"}, query , function(response)
            {    
                var result = JSON.parse(response); 
 
                $$(view).clearAll(); 
                $$(view).parse(result.data);
            });
        },
 
        setCookie: function(name,value,days) {
            var expires = "";
            if (days) {
                var date = new Date();
                date.setTime(date.getTime() + (days*24*60*60*1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "")  + expires + "; path=/";
        },

        remCookie: function(name) {
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        },

        firebase:
        {
            add: function(key, item)
            {
                __.current.FIREBASE.ref(key).push(item); 
            },

            on_write: function(key, callback)
            {
                __.current.FIREBASE.ref(key).on('child_added', function(data){

                    __.current.FIREBASE.ref(key).remove();

                    callback(data.val());   

                });
            } 
        },

        storage: 
        {
            set: function(key, value){ webix.storage.local.put(key, value); },
            get: function(key       ){ return webix.storage.local.get(key); }
        } 
    };

})();
