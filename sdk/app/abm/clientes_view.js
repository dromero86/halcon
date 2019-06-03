app.define("app.abm.clientes_view",function()
{  
    webix.ui
    ({
        id     : 'content'  ,
        view   : "datalist" ,
        title  : "CLIENTES" ,
        form   : "app.abm.clientes_form",
        store  : "clientes" ,
        columns: [ 
            {id:"cliente"  , header:"Cliente"       , sort: 'string' , fillspace: true }, 
            {id:"addr"     , header:"Dirección"     , sort: 'string' , fillspace: true },  
            {id:"doc"      , header:"DNI"           , sort: 'int'    , adjust   : true },
            {id:"tel"      , header:"Teléfono"      , sort: 'string' , width    : 150  },
            {id:"fingreso" , header:"Ingreso"       , sort: 'string' , adjust   : true  , format: webix.Date.dateToStr("%d/%m/%Y") },
            {id:"cobrador" , header:"Cobrador"      , sort: 'string' , width : 150  }                
        ],
        query : { 
            select:
            {
                from:"clientes", 
                field: 
                [
                    "id","addr","doc", "tel",
                    { cliente : "CONCAT(@apellido,' ',@nombre)"}, 
                    { cobrador: "CONCAT(CO.apellido,' ',CO.nombre)"}, 
                    { fingreso: "DATE_FORMAT(@fingreso,'%Y-%m-%d')"}
                ]  
            }, 
            join:true 
        } 
    },
    $$('content'));
});