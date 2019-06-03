webix.protoUI({
    name:"ckeditor",
    $init:function(config){
        this.$view.className += " webix_selectable";
    },
    defaults:{
        borderless:true,
        toolbar: [
            { name: 'document', items : [ 'Source','-','Save','NewPage','DocProps','Preview','Print','-','Templates' ] },
            { name: 'clipboard', items : [ 'Cut','Copy','Paste','PasteText','PasteFromWord','-','Undo','Redo' ] },
            { name: 'editing', items : [ 'Find','Replace','-','SelectAll','-','SpellChecker', 'Scayt' ] },
            { name: 'forms', items : [ 'Form', 'Checkbox', 'Radio', 'TextField', 'Textarea', 'Select', 'Button', 'ImageButton',   'HiddenField' ] }, 
            { name: 'basicstyles', items : [ 'Bold','Italic','Underline','Strike','Subscript','Superscript','-','RemoveFormat' ] },
            { name: 'paragraph', items : [ 'NumberedList','BulletedList','-','Outdent','Indent','-','Blockquote','CreateDiv', '-','JustifyLeft','JustifyCenter','JustifyRight','JustifyBlock','-','BidiLtr','BidiRtl' ] },
            { name: 'links', items : [ 'Link','Unlink','Anchor' ] },
            { name: 'insert', items : [ 'Image','Flash','Table','HorizontalRule','Smiley','SpecialChar','PageBreak','Iframe' ] },
            { name: 'styles', items : [ 'Styles','Format','Font','FontSize' ] },
            { name: 'colors', items : [ 'TextColor','BGColor' ] },
            { name: 'tools', items : [ 'Maximize', 'ShowBlocks','-','About' ] }
        ]
    },
    _init_ckeditor_once:function(){
        var tid = this.config.textAreaID = "t"+webix.uid(); 

        this.$view.innerHTML = "<textarea id='"+tid+"'>"+( this.config.value == undefined ? "": this.config.value )+"</textarea>";
 
        this._3rd_editor = CKEDITOR.replace( tid, {
            toolbar_Full: this.config.toolbar,
            toolbar: 'Full',
            width:this.$width -2,
            height:this.$height - 44
        });
    },
    _set_inner_size:function(x, y){
        if (!this._3rd_editor || !this._3rd_editor.container || !this.$width) return;
        this._3rd_editor.resize(x, y);
    },
    $setSize:function(x,y){
        if (webix.ui.view.prototype.$setSize.call(this, x, y)){
            this._init_ckeditor_once();
            this._set_inner_size(x,y);
        }
    },
    setValue:function(value){
        this.config.value = value;
        if (this._3rd_editor)
            this._3rd_editor.setData(value);
        else webix.delay(function(){
            this.setValue(value);
        },this,[],100);
    },
    getValue:function(){
        return this._3rd_editor?this._3rd_editor.getData():this.config.value;
    },
    focus:function(){
        this._focus_await = true;
        if (this._3rd_editor)
            this._3rd_editor.focus();
    },
    getEditor:function(){
        return this._3rd_editor.getData();
    }
}, webix.ui.view);