(function (global) { 

    if(typeof (global) === "undefined") {
        throw new Error("window is undefined");
    }

    var _hash = "!";
    
    var noBackPlease = function (qs) 
    {     

        global.location.href += "#";

        global.setTimeout(function () 
        { 

            global.location.href += "!";   

            global.setTimeout(function (){ __.changeUri(qs); }, 50 );   

        }, 50); 
    };

    global.onhashchange = function () 
    {
        if (global.location.hash !== _hash) 
        {
            global.location.hash = _hash;
        }
    };

    global.onload = function ()
    {    
    	var uri 	= global.location.hash;
    	var uris	= uri.split("#!");

    	if( uris.length > 0 )
    	{ 
    		noBackPlease(uris[1] == undefined ? "" : uris[1]);
    	}
    	else
    	{
    		noBackPlease("");
    	} 

        document.body.onkeydown = function (e) 
        {
            var elm = e.target.nodeName.toLowerCase();
            
            if ( e.which === 8 && (elm !== 'input' && elm  !== 'textarea') ) 
            {
                e.preventDefault();
            }
  
            e.stopPropagation();
        };          
    }

    global.onload();

})(window);