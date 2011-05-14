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
	'background-color', 'background-image', 'background-repeat', 'background-position' 
];
var styleAttributesPx = [
	'padding-top','padding-right','padding-bottom','padding-left',
	'margin-top','margin-right','margin-bottom','margin-left',
	'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
	'outline-width',
	'top', 'bottom', 'left', 'right', 
	'line-height', 'font-size'
];

function getSelectionCoordinates(win) {
    if (win.getSelection) {
        var sel = win.getSelection();
        if (sel.rangeCount) {
        	var range = sel.getRangeAt(sel.rangeCount - 1);
        	return range.getClientRects()[0];
        }
    }
}

function selectLetter(el, offset) {
	var doc = el.ownerDocument;
	var range = doc.createRange();
	range.setStart(el, offset);
	range.setEnd(el, offset + 1);
	
	var sel = doc.defaultView.getSelection();
	sel.removeAllRanges();
	sel.addRange(range);
}

function el(dom) {
	
	
}

function initialize(doc, cb) {

	var body = doc.body;
	var canvas = doc.createElement("canvas");
	var ctx = canvas.getContext("2d");
	
	body.normalize();
	
	
	var width = $(doc.body).outerWidth(true);
	var height = $(doc.body).outerHeight(true);
	
	canvas.width = canvas.height = 200;
	ctx.fillStyle = "rgba(255,0,0,.2)";
	ctx.fillRect(0, 0, 200, 200);
	
	var all = $(doc.body).find("*");
	all.each(function() {
		
		
		var css = { };
		
		
		var computedStyleNormal = computedStyle(this, styleAttributes);
		for (var i in computedStyleNormal) {
			css[i] = computedStyleNormal[i];
		}
		
		var computedStylePx = computedStyle(this, styleAttributesPx);
		for (var i in computedStylePx) {
			css[i] = parseInt(computedStylePx[i]) || 0;
		}
	
		var font = $.trim(css.fontStyle + " " + css.fontWeight + " "  + css.fontSize + "px " + css.fontFamily);
		
		log(font, css.color)
  		ctx.font = font;
  		ctx.fillStyle = css.color;
		ctx.textBaseline = "bottom";
		
		var nodes = $(this).contents().filter(function() { return this.nodeType == 3; });
		for (var i = 0 ; i < nodes.length; i++) {
			var text = nodes[i].data;
			for (var f = 0; f < text.length; f++) {
				selectLetter(nodes[i], f);
				var rect = getSelectionCoordinates(window.parent,true);
				log(f, text, text.length, rect);
				ctx.fillText(text[f], rect.left, rect.bottom);
			
			}
		}
	});
	
	
	cb(canvas);
}

function render(doc) {
	var els = [];
	
	initialize(doc, function(canvas) {
		
		$(doc.body).append("<div style='position:absolute; right:0; top:0; z-index:1000;'>x</div>");
		doc.body.appendChild(canvas);
	});
}

if (window.parent != window) {
	console.log("herE");
	
	var hasKey = window.parent.h2c && window.parent.h2c.key;
	assert(hasKey, "No key provided");
	
	log("Frame has been loaded.  Key received.", window.parent.document.body, window.parent.h2c);
	
		
	var container = window.frameElement.parentNode;
	var parentDoc = window.parent.document;
	
	render(parentDoc);
	log(container, parentDoc);
	
}

})();