(function() {

window.h2c = {
	render: render
};


function postValues() {
	window.open("http://localhost:8080/preview");
}
function assert(isTrue) {if (!isTrue){
	log("ASSERTION FAILURE - NEED TO REPORT SERIALIZED ERROR TO SERVER", arguments);
}}

function log() { if (window.console) { console.log(Array.prototype.slice.apply(arguments)); } }
function log1() { if (settings.logLevel >= 1) { log.apply(this, arguments); } }
function log2() { if (settings.logLevel >= 2) { log.apply(this, arguments); } }
function error(msg) { throw "[Web Designer] " + msg; return false; }
function shouldProcess(dom) { return (dom.nodeType == 1) && (!ignoreTags[dom.tagName.toLowerCase()]) && !$(dom).is("span.h2c"); }
function computedStyle(elem, styles) {

	// IE - Use jQuery CSS.  Others - Load the computedStyle once and read from it
	
	var ret = { };
	
	if ($.browser.msie) {
		var el = $(elem);
		for (var i = 0, len = styles.length; i < len; i++) {
			var attr = styles[i], val;
			if (attr == 'outline-width') { val = 0; }
			else { val = el.css(attr); }
			
			ret[$.camelCase(attr)] = val;
		}
	}
	else {	
		var defaultView = elem.ownerDocument.defaultView;
		var computedStyle = defaultView.getComputedStyle( elem, true );
		for (var i = 0, len = styles.length; i < len; i++) {
			ret[$.camelCase(styles[i])] = computedStyle.getPropertyValue( styles[i] );
		}
	}
	
	return ret;
}
function createCanvas() {
	var c = document.createElement("canvas");
    if (typeof FlashCanvas != "undefined") {
      FlashCanvas.initElement(c);
    }
    return c;	
}
function getDoctypeString(doc) {
	if ($.browser.msie) {
		var doctype = doc.all[0].text;
		return doctype || "";
	}
	else {
		var doctype = doc.doctype;
		if (!doctype) {
			return "";
		}
		var publicID = doctype.publicId;
		var systemID = doctype.systemId;
		var name = doctype.name;
		
		if (!publicID) {
			return "<!DOCTYPE " + name + ">"
		}
		
		return "<!DOCTYPE " + name + " PUBLIC \"" + publicID + "\" \"" + systemID + "\">";
	}
}
var getUniqueID = (function(id) { return function() { return id++; } })(0);
var ignoreTags = { 'style':1, 'br': 1, 'script': 1, 'link': 1, 'h2c': 1, 'span.h2c': 1 };
var styleAttributes = [
	'border-top-style', 'border-top-color',
	'border-right-style', 'border-right-color',
	'border-bottom-style', 'border-bottom-color',
	'border-left-style', 'border-left-color',
	'outline-style', 'outline-color',
	'display', 'text-decoration',
	'font-family', 'font-style', 'font-weight', 'color',
	'position', 'float', 'clear', 'overflow',
	'background-color', 'background-image', 'background-repeat', 'background-position',
	'z-index'
];
var styleAttributesPx = [
	'padding-top','padding-right','padding-bottom','padding-left',
	'margin-top','margin-right','margin-bottom','margin-left',
	'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
	'outline-width',
	'top', 'bottom', 'left', 'right', 
	'line-height', 'font-size'
];

function getLetterCoords(el, offset) {
	var doc = el.ownerDocument;
	var range = doc.createRange();
	var win = doc.defaultView;
	
	range.setStart(el, offset);
	range.setEnd(el, offset + 1);
	
	var sel = win.getSelection();
	sel.removeAllRanges();
	sel.addRange(range);
	
	//log("Selecting letter", range, el, offset)
	var rect = $.extend({ }, sel.getRangeAt(0).getClientRects()[0]);
	
	return rect;
}

function el(dom) {	
	var css = this.css = { };
	this.dom = dom;
	
	var computedStyleNormal = computedStyle(dom, styleAttributes);
	for (var i in computedStyleNormal) {
	    css[i] = computedStyleNormal[i];
	}
	var computedStylePx = computedStyle(dom, styleAttributesPx);
	for (var i in computedStylePx) {
	    css[i] = parseInt(computedStylePx[i]) || 0;
	}
	
	if (css.zIndex == "auto") {
		css.zIndex = -1;
	}
	else {
		css.zIndex = parseInt(css.zIndex) || 0;
	}
	
	css.font = $.trim(
		css.fontStyle + " " + css.fontWeight + " " + 
		css.fontSize + "px " + css.fontFamily
	);
	
	var textNodes = this.textNodes = [];
	var childNodes = dom.childNodes;
	for (var j = 0, l = childNodes.length; j < l; j++) {
		if (childNodes[j].nodeType == 3) {
			textNodes.push(childNodes[j]);
		}
	}
	
	log("inited el", this, css, this.children);
	this.children = $(dom).children().map(function() {
		return new el(this);
	});
	
	// TODO: order children by z index for rendering
}

el.prototype.render = function(ctx) {
  	var e = this;
	
	this.renderText(ctx);
	
	for (var i = 0; i < this.children.length; i++) {
		this.children[i].render(ctx);
	}
};
el.prototype.renderText = function(ctx) {

  	ctx.font = this.css.font;
  	ctx.fillStyle = this.css.color;
	ctx.textBaseline = "bottom";
	
	var nodes = this.textNodes;
	
	for (var i = 0 ; i < nodes.length; i++) {
	    var text = nodes[i].data;
	    for (var f = 0; f < text.length; f++) {
	    	var letter = text[f];
	    	if (letter == ' ' || letter == '\t' || letter == '\n') {
	    		continue;
	    	}
	    	
	    	var rect = getLetterCoords(nodes[i], f);
	    	
	    	//if ($.trim(text).indexOf("consider") == 0) {
	    	//log(f, text[f], text.length, rect);
	    	//}
	    	
	    	ctx.fillText(text[f], rect.left, rect.bottom);
	    }
	}
};

function initialize(doc, cb) {

	var body = doc.body;
	var canvas = doc.createElement("canvas");
	var ctx = canvas.getContext("2d");
	
	body.normalize();
	
	var width = $(body).outerWidth(true),
		height = $(body).outerHeight(true);
		
	canvas.width = width;
	canvas.height = height;
	ctx.fillStyle = "rgba(255,0,0,.2)";
	ctx.fillRect(0, 0, width, height);
	
	var bodyElement = new el(body);
	bodyElement.render(ctx);

	cb(canvas);
}

function render(doc) {
	var els = [];
	
	initialize(doc, function(canvas) {
		var x = $("<div style='position:absolute; cursor:pointer; width:25px; height:25px; background:red; right:10px; top:10px; z-index:1000;'></div>").click(function() {
			$(canvas).remove();
			$(x).remove();
		});
		$(canvas).
			css("position", "absolute").
			css("top", 0).css("left", 0).
			css("background", "white");
		
		$(doc.body).append(x);
		doc.body.appendChild(canvas);
	});
}

if (window.parent != window) {

	var hasKey = window.parent.h2c && window.parent.h2c.key;
	assert(hasKey, "No key provided");
	
	log("Frame has been loaded.  Key received.", window.parent.document.body, window.parent.h2c);
	
		
	var container = window.frameElement.parentNode;
	var parentDoc = window.parent.document;
	
	render(parentDoc);
}

})();