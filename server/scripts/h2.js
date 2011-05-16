(function() {

window.h2c = {
	render: render
};

var settings = {
	logLevel: 1
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
function error(msg) { throw "[H2C] " + msg; return false; }

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

function createCanvas(doc) {
	var c = (doc || document).createElement("canvas");
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

function getLetterRect(el, offset) {
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

function el(dom, onready) {	

	this.dom = dom;	
	this.initializeDOM();
	
	var textNodes = this.textNodes = [];
	var childNodes = dom.childNodes;
	for (var j = 0, l = childNodes.length; j < l; j++) {
		if (childNodes[j].nodeType == 3) {
			textNodes.push(childNodes[j]);
		}
	}
	
	log("inited el", this);
	
	// TODO: order children by z index for rendering
	this.children = $(dom).children().map(function() {
		return new el(this);
	});
	
	
	if (onready) {
		onready(this);
	}
}

el.prototype.initializeDOM = function() {
	var dom = this.dom;
	var $dom = $(this.dom);
	var css = this.css = { };
	
	
	this.clientRects = dom.getClientRects();
	
	this.tagName = dom.tagName.toLowerCase();
	this.isBody = this.tagName == "body";
	
	var computedStyleNormal = computedStyle(dom, styleAttributes);
	for (var i in computedStyleNormal) {
	    css[i] = computedStyleNormal[i];
	}
	var computedStylePx = computedStyle(dom, styleAttributesPx);
	for (var i in computedStylePx) {
	    css[i] = parseInt(computedStylePx[i]) || 0;
	}
	
	
	if (css.backgroundColor == "rgba(0, 0, 0, 0)" || css.backgroundColor == "transparent") {
		css.backgroundColor = false;
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
	
	css.offset = $dom.offset();
	css.height = $dom.height();
	css.width = $dom.width();
	
	css.scrollHeight = dom.scrollHeight;
	css.scrollWidth = dom.scrollWidth;
	
	
	// outerHeight: Full height, but without the margins
	css.outerHeight = 
		css.height + 
		css.paddingTop +
		css.paddingBottom +
		css.borderTopWidth +
		css.borderBottomWidth;
	
	// outerHeightMargins: The total bounding height of the object
	css.outerHeightMargins = 
		css.outerHeight + 
		css.marginTop + 
		css.marginBottom;
		
	// outerWidth: Full width, but without the margins
	css.outerWidth = 
		css.width + 
		css.paddingLeft +
		css.paddingRight +
		css.borderLeftWidth + 
		css.borderRightWidth;
		
	// outerWidthMargins: The total bounding width of the object
	css.outerWidthMargins = 
		css.outerWidth + 
		css.marginLeft +
		css.marginRight;
				
};

el.prototype.render = function(ctx) {
	if (this.css.display == 'none') {
		return;
	}
	
	this.renderBox(ctx);
	this.renderBorders(ctx);
	this.renderText(ctx);
	
	var children = this.children;
	for (var i = 0, l = children.length; i < l; i++) {
		children[i].render(ctx);
	}
};

el.prototype.renderBox = function(ctx) {

	// Render borders and background
	
	var css = this.css;
	var isBody = this.isBody;
	
	if (!css.backgroundColor) {
		return;
	}
	
	if (isBody) {
	
	}
	else {
	
	}
	
	var rects = this.clientRects;
	for (var i = 0; i < rects.length; i++) {
		
		var offsetLeft = isBody ? 0 : rects[i].left;
		var offsetTop = isBody ? 0 : rects[i].top;
		var outerWidth = isBody ? css.outerWidthMargins : rects[i].width;
		var outerHeight = isBody ? css.outerHeightMargins : rects[i].height;
		
	log(css.backgroundColor, this.clientRects,offsetLeft, offsetTop, outerHeight, outerWidth);
	ctx.fillStyle = css.backgroundColor;
	ctx.fillRect(offsetLeft, offsetTop, outerWidth, outerHeight);
	}
	
	/*
	var offsetLeft = isBody ? 0 : css.offset.left;
	var offsetTop = isBody ? 0 : css.offset.top;
	var outerWidth = isBody ? css.outerWidthMargins : css.outerWidth;
	var outerHeight = isBody ? css.outerHeightMargins : css.outerHeight;
	*/
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
	    	
	    	var rect = getLetterRect(nodes[i], f);
	    	
	    	//log(f, text[f], text.length, rect, this.tagName);
	    	
	    	ctx.fillText(text[f], rect.left, rect.bottom);
	    }
	}
};

el.prototype.renderBorders = function(ctx) {
	var css = this.css;
	var offsetLeft = css.offset.left;
	var offsetTop = css.offset.top;
	
	var borderLeftWidth = css.borderLeftWidth;
	if (borderLeftWidth) {
		ctx.fillStyle = css.borderLeftColor;
		ctx.fillRect(
			offsetLeft, offsetTop, 
			borderLeftWidth, css.outerHeight);
	}
	
	var borderTopWidth = css.borderTopWidth;
	if (borderTopWidth) {		
		ctx.fillStyle = css.borderTopColor;
		ctx.fillRect(
			offsetLeft, offsetTop, 
			css.outerWidth, borderTopWidth);
	}
	
	var borderBottomWidth = css.borderBottomWidth;
	if (borderBottomWidth) {		
		ctx.fillStyle = css.borderBottomColor;
		ctx.fillRect(
			offsetLeft, offsetTop + css.outerHeight - borderBottomWidth, 
			css.outerWidth, borderBottomWidth);
	}
	
	var borderRightWidth = css.borderRightWidth;
	if (borderRightWidth) {		
		ctx.fillStyle = css.borderRightColor;
		ctx.fillRect(
			offsetLeft + css.outerWidth - borderRightWidth, 
			offsetTop, borderRightWidth, css.outerHeight);
	}
};

function initialize(doc, cb) {
	var body = doc.body;
	var canvas = createCanvas(doc);
	var ctx = canvas.getContext("2d");
	
	body.normalize();
	
	var width = $(doc).width()
		height = $(doc).height();
		
	canvas.width = width;
	canvas.height = height;
	ctx.fillStyle = "rgba(255,0,0,.2)";
	ctx.fillRect(0, 0, width, height);
	
	new el(body, function(bodyElement) {
		bodyElement.render(ctx);
		cb(canvas);
	});
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
	$(document).ready(function() {
		render(parentDoc);
	});
}

})();