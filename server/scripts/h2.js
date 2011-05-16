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
	dom._element = this;
	
	this.tagName = dom.tagName.toLowerCase();
	this.isBody = this.tagName == "body";
	
	
	if (this.isBody) {
		var body = this.body = this;
		this.pendingResources = 0;
		this.checkImages = function() {
			if (this.childrenInitialized && this.pendingResources <= 0) {
				onready(this);
			}
		};
		this.loadImage = function(src, useBroken, element) {
			this.pendingResources++;
			retrieveImage(src, function(img) {
				element.loadedImage = img;
				log("Set elements loaded image", img);
				body.pendingResources--;
				body.checkImages();
			}, dom.ownerDocument, useBroken);
		}
	}
	else {
		this.parent = dom.parentNode._element;
		this.body = this.parent.body;
	}
	
	this.initializeDOM();
	
	
	log("inited el", this);
	
	// TODO: order children by z index for rendering
	this.children = $(dom).children().map(function() {
		return new el(this);
	});
	
	this.childrenInitialized = true;
	
	
	if (this.isBody) {
		this.checkImages();
	}

}

el.prototype.initializeDOM = function() {

	var dom = this.dom;
	var $dom = $(this.dom);
	var css = this.css = { };
	
	this.clientRects = dom.getClientRects();
	this.src = this.tagName == 'img' ? $dom.attr("src") : false;
	this.shouldRender = (dom.offsetWidth > 0 && dom.offsetHeight > 0);
	
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
	
	css.font = $.trim(
		css.fontStyle + " " + css.fontWeight + " " + 
		css.fontSize + "px " + css.fontFamily
	);
	
	if (css.zIndex == "auto") {
		css.zIndex = -1;
	}
	else {
		css.zIndex = parseInt(css.zIndex) || 0;
	}
	
	
	if (this.isBody) {
		var doc = dom.ownerDocument || document;
		css.backgroundRect = {
			top: 0, left: 0, width: $(doc).width(), height: $(doc).height()
		};
	}
	
	// Collect all of the text nodes for future reference 
	var textNodes = this.textNodes = [];
	var childNodes = dom.childNodes;
	for (var j = 0, l = childNodes.length; j < l; j++) {
		if (childNodes[j].nodeType == 3) {
			textNodes.push(childNodes[j]);
		}
	}
	
	// Fetch any images that are necessary for rendering
	if (this.shouldRender) {
		if (this.tagName == "img") {
			this.body.loadImage(this.src, true, this);
		}
		else if (css.backgroundImage != "none") {
			this.body.loadImage(this.css.backgroundImage, false, this);
		}
	}
	
};

el.prototype.render = function(ctx) {

	if (!this.shouldRender) {
		return;
	}
	
	this.renderBox(ctx);
	this.renderText(ctx);
	
	var children = this.children;
	for (var i = 0, l = children.length; i < l; i++) {
		children[i].render(ctx);
	}
};


// Render borders and background colors / images
el.prototype.renderBox = function(ctx) {

	var css = this.css;
	var isBody = this.isBody;
	var backgroundColor = css.backgroundColor;
	var rects = this.clientRects;
	var loadedImage = this.loadedImage;
	
	for (var i = 0; i < rects.length; i++) {
	
		var rect = rects[i];
		var backgroundRect = isBody ? css.backgroundRect : rect;
				
		if (backgroundColor) {
			ctx.fillStyle = backgroundColor;
			ctx.fillRect(
				backgroundRect.left, backgroundRect.top, 
				backgroundRect.width, backgroundRect.height
			);
		}
		
		if (loadedImage) {
			var repeat = this.tagName == "img" ? "no-repeat" : css.backgroundRepeat;
			ctx.fillStyle = ctx.createPattern(loadedImage, repeat);
			ctx.fillRect(
				backgroundRect.left, backgroundRect.top, 
				backgroundRect.width, backgroundRect.height
			);
		}
		
		this.renderBorders(ctx, rect);
	}
};

el.prototype.renderText = function(ctx) {

	var css = this.css;
  	ctx.font = css.font;
  	ctx.fillStyle = css.color;
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

el.prototype.renderBorders = function(ctx, rect) {
	var css = this.css;
	var offsetLeft = rect.left;
	var offsetTop = rect.top;
	
	var borderLeftWidth = css.borderLeftWidth;
	if (borderLeftWidth) {
		ctx.fillStyle = css.borderLeftColor;
		ctx.fillRect(
			offsetLeft, offsetTop, 
			borderLeftWidth, rect.height);
	}
	
	var borderTopWidth = css.borderTopWidth;
	if (borderTopWidth) {		
		ctx.fillStyle = css.borderTopColor;
		ctx.fillRect(
			offsetLeft, offsetTop, 
			rect.width, borderTopWidth);
	}
	
	var borderBottomWidth = css.borderBottomWidth;
	if (borderBottomWidth) {		
		ctx.fillStyle = css.borderBottomColor;
		ctx.fillRect(
			offsetLeft, offsetTop + rect.height - borderBottomWidth, 
			rect.width, borderBottomWidth);
	}
	
	var borderRightWidth = css.borderRightWidth;
	if (borderRightWidth) {		
		ctx.fillStyle = css.borderRightColor;
		ctx.fillRect(
			offsetLeft + rect.width - borderRightWidth, 
			offsetTop, borderRightWidth, rect.height);
	}
	
	var outlineWidth = css.outlineWidth;
	if (outlineWidth > 0) {
	    ctx.strokeStyle = css.outlineColor;
	    ctx.lineWidth = outlineWidth;
	    ctx.strokeRect(
	    	offsetLeft - (outlineWidth / 2), offsetTop - (outlineWidth / 2), 
	    	rect.width + outlineWidth, rect.height + outlineWidth);
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






// retrieveImage: a method to interface with image loading, errors, and proxy
function retrieveImageFromCache(src) {
	assert(retrieveImage.cache.hasOwnProperty(src), "Error: image has not been loaded into cache");
	return retrieveImage.cache[src];
}

function retrieveImage(src, cb, ownerDocument, useBroken) {

	if (!$.isFunction(cb)) {
		cb = function() { };
	}
	
	if (retrieveImage.cache[src]) {
		log("Cache hit", src, retrieveImage.cache[src]);
		return cb(retrieveImageFromCache(src));	
	}
	
	var loadImageDirectly = true;
	
	if (src.indexOf("data:") == -1) {
	    var url = new RegExp(/url\((.*)\)/);
	    //src = src.replace(/['"]/g,''); trim quotes?
	    var matched = src.match(url);
	    if (matched && matched[1]) {
	    	src = matched[1];
	    }
	    
	    // Convert a relative path into absolute.
	    var original = new URI(src);
	    var authority = original.getAuthority();
	    
	    if (!authority) {
	    	var root = new URI((ownerDocument || document).location.href);
	   		src = original.resolve(root).toString();
	    }
	    else if (authority != document.location.host) {
	    	log("Going to need to proxy");
	    	
	    }
	}
	
	if (loadImageDirectly) {
		var img = new Image();
		img.onload = sendSuccess;
		img.onerror = sendError;
		img.src = src;
	}
	else {
	
	}
	
	function sendError() {
		var img = new Image();
		img.onload = sendSuccess;
		img.src = useBroken ? retrieveImage.brokenImage : retrieveImage.transparentImage;
	}
	
	function sendSuccess() {
	    retrieveImage.cache[src] = this;
	    cb(this);
	}
}

retrieveImage.cache = { };
retrieveImage.transparentImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACWCAYAAABkW7XSAAADLUlEQVR4Ae3QQREAAAiAMPqXVjv4HUeCNXWLAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwENgAfmTAf/IVJfgAAAAAElFTkSuQmCC";

retrieveImage.brokenImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAVBAMAAABWJ8jiAAAAIVBMVEUAAAAA//8A/wDAwMD/AP//AACAgIAAAID///8AgAAAAP87p9+eAAAAb0lEQVQImWPogIEGBmQmAwhkgJkcIKE0CNMYCDIyIEzLycYZbRDmpAnGDAwQ5swJxsYNEKYBM5xpbLxqAcQEU2PjhVCmSbDxqgoo09UYqB/CdAnuaIYwDYBOgjKNgSyoYRAngh0JZDBALMbuCzgTAD+sVWJQUviMAAAAAElFTkSuQmCC";


})();