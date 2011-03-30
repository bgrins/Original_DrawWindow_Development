/*
html2canvas.js
Render HTML to a canvas relying on the browser's layout engine
*/

/*
NEEDS MORE TESTING FOR:
  * Images
  * Page zoomed on load
  * Body outerWidth, borders
  * IE
*/

// TODO: Don't need wordWrap anymore, since we render each word / char seperately.
// We should be able to optimize text rendering my preventing the need of an extra canvas for each node
// Still need to look into <pre>s and <code> and whatnot before doing anything too drastic, though.
//
(function() {

window.html2canvas = html2canvas;
html2canvas.element = element;
html2canvas.logLevels = { RELEASE: 0, NORMAL: 1, VERBOSE: 2 };
var settings = html2canvas.settings = {
	enabled: true, // temporarily true to test flashcanvas !!document.createElement('canvas').getContext,
	drawBoundingBox: false,
	logLevel: html2canvas.logLevels.RELEASE,
	isDevelopment: true
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
function shouldProcess(dom) { return (dom.nodeType == 1) && (!ignoreTags[dom.tagName.toLowerCase()]); }
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

$.fn.splitTextNodes = function() {
	
	var trimMultiple = /^[\s]+|[\s]+/g;
	
	var all = this.add(this.find("*")).toArray();
	var skip = "style, script, h2c, span.h2c";
	
	for (var i = 0; i < all.length; i++) {
		var element = $(all[i]);
		
		if (element.is(skip)) { continue; }
		
		var hasTextNodes = false;
		var hasOtherNodes = false;
		var textNodes = [];
		element.contents().each(function() {
			if (this.nodeType == 3) {
				hasTextNodes = true;
				textNodes.push(this);
			}
			else if (this.nodeType != 1) {
				$(this).remove();
			}
			else {
				hasOtherNodes = true;
				//$(this).removeAttr("onload");
			}
		});
		
		// If this only has text nodes, 
		if (hasTextNodes && !hasOtherNodes) {
			// Collapse all whitespace down to one space each
			var singleSpaces = element.html().replace(trimMultiple," ");
			var wordwrap = element.css("word-wrap");
			var splitter = wordwrap == "break-word" ? "" : " ";
			var words = singleSpaces.split(splitter);
			var newHtml = [];
			var space = '';
			
			for (var j = 0, wordLength = words.length; j < wordLength; j++) {
				// There was a space before this unless if it is the first word.
				//if (j == ' ') { space = ' '; }
				//else { space = ''; }
				
				space = splitter;
				if (j == 0) {
					space = '';
				}
				var word = words[j];
				if (word == "-") {
					// TODO: Dashes mess up this word wrap strategy of wrapping each letter in a span
					// Have to try out some other options to get the dash to actually render
					//word = "&shy;";
					//word = "&#8203;";
					word = " ";
				}
				
				newHtml.push(space+'<span class="h2c">'+word+'</span>');
			}
			element.html(newHtml.join(''));
		}
		else if (hasTextNodes && hasOtherNodes) {
			// Wrap each node, then push it onto list for processing (splitting up spaces)
			for (var j = 0; j < textNodes.length; j++) {
				var newElement = $(textNodes[j]).wrap('<span class="h2ccontainer"></span>').parent();
				all.push(newElement);
			}
		}
	}
};
$.fn.cloneDocument = function() {
	var $doc = this,
		doc = $doc[0],
		docWidth = $doc.width(),
		docHeight = $doc.height();
	
	//log(doc.doctype, document.doctype);
	
	doc.head = doc.head || doc.getElementsByTagName('head')[0];
	
	// This might be needed, but it causes extra HTTP requests
	// var clonedHead = $("<head />").html(doc.head.innerHTML);
	var clonedHead = $(doc.head.cloneNode(true));
	var clonedBody = $(doc.body.cloneNode(true));
	
	// Set image width and height, to lock it in place even if it is still
	// loading when we initally process.
	var allOldImages = $(doc.body).find("img");
	var allNewImages = clonedBody.find("img");
	
	assert(allOldImages.length == allNewImages.length, 
		"Cloned body does not match");
	
	allOldImages.each(function(i) {
		allNewImages.eq(i).width($(this).width()).height($(this).height()).
			attr("data-src", function() { return $(this).attr("src"); }).
			attr("src", "javascript:");
	});
	
	clonedHead.find("script").remove();
	clonedBody.find("script, iframe.h2cframe").remove();
	clonedBody.find("iframe").attr("src", "javascript:").remove();
	
	if (clonedHead.find("base").length == 0) {
		clonedHead.prepend(
			'<base href="'+doc.location.origin+doc.location.pathname+'" />'
		);
	}
	
	// todo: include attributes on the head and body tags (such as classname)
	var clonedHeadHtml = clonedHead.html();
	var clonedBodyHtml = clonedBody.html();
	// Overlay for now to test that it isn't messing it up when splitting text nodes.
	// This renderer frame will be probably need to be hidden 
	var styles = 'position:absolute; top: 0; left:0; opacity:.9; border:none; padding:0; margin:0;z-index:10000001;';
	
	//var styles = 'position:absolute; top: -'+(bodyHeight*2)+'px; left:-'+(bodyWidth*2)+'px';
	var iframe = $("<iframe scrolling='no' id='h2c-render-frame' frameborder='0' style='"+styles+"' src='javascript:' />").appendTo(doc.body).width(docWidth).height(docHeight);
	
	// TODO: Handle IE document domain things, or just do the processing here (since it may be running in iframe)
	var docType = getDoctypeString(doc);
	var d = iframe.contents()[0];
	
	d.open();
	d.write(docType + "<html><head>"+clonedHeadHtml+"</head><body>"+clonedBodyHtml+"</body>");
	d.close();
	
	// TODO: Inline styles not working.
	return d;
	
	/*
	//log(clonedHead.html(), clonedBody.html(), b.width(), $(d.body).width());
	//var html = $("<html>" + originalDocument.documentElement.innerHTML + "</html>");
	//log(originalDocument.documentElement.innerHTML, originalDocument.head, html.html());
	
	var b = $(this[0].body);
	//log("CLONING", this, b, b.html());
	var clonedBody = b.clone();
	clonedBody.find("script, iframe.h2cframe").remove();
	clonedBody.find("iframe").attr("src", "javascript:");
	log(this[0].head, this[0].head.innerHTML);
	var clonedHead = $(this[0].head).clone();
	clonedHead.find("script").remove();
	//log(clonedHead, clonedHead[0].innerHTML, clonedBody.html())
	//var originalFrames = b.find("iframe");
	
	//$(d.head).html(clonedHead.html());
	//$(d.body).html(clonedBody.html()).width(bodyWidth).height(bodyHeight);
	
	return d;
	
	
	var d = window.open().document;
	//iframe.remove(); // wasn't working in firefox
	
	$(d.head).replaceWith(clonedHead);
	$(d.body).replaceWith(clonedBody).width(this[0].width).height(this[0].height);
	var clonedFrames = clonedBody.find("iframe");
	
	//originalFrames.each(function(i) {
		//var frameDoc = $(this).contents().cloneDocument();
		//clonedFrames.eq(i).contents().find("head").replaceWith(frameDoc.head);
		//clonedFrames.eq(i).contents().find("body").html('yo');//replaceWith(frameDoc.body);
	//});

	return d;
	*/
};


function html2canvas(body, cb) {
	
	body = $(body.ownerDocument).cloneDocument().body;
	
	$(body).splitTextNodes();
	
	new element(body, function(canvas) {
		cb(canvas);
	});
}

function createCanvas() {
	var c = document.createElement("canvas");
    if (typeof FlashCanvas != "undefined") {
      FlashCanvas.initElement(c);
    }
    return c;	
}

function element(DOMElement, onready) {

	log1("initializing element", DOMElement, DOMElement.nodeType);
	
	if (!shouldProcess(DOMElement)) {
		return error("Invalid element passed for processing " + DOMElement.tagName);
	}
	
	DOMElement._element = this;
	this.uniqueID = getUniqueID();
	this._domElement = DOMElement;
	this.jq = $(this._domElement);
	this.document = this._domElement.ownerDocument;
	this.nodeType = this._domElement.nodeType;
	this.tagName = this._domElement.tagName.toLowerCase();
	this.isBody = this.tagName == "body";
	this.isTextPlaceholder = this.jq.is("span.h2c");
	this.readyChildren = 0;
	this.ready = false;
	this.onready = onready || function() { };
	
	if (this.isBody) {
		this.totalChildren = 0;
		this.body = this;
		this.outputCanvas = createCanvas();
		this.outputCanvas._el = this;
	}
	else {
		this.parent = this._domElement.parentNode._element;
		this.body = this.parent.body;
		this.closestBlock = (this.parent.isBlock) ? this.parent : this.parent.closestBlock;
	}
	
	this.copyDOM();
	if (this.shouldRender) {
		this.body.totalChildren++;
	}
	
	// Count the new document as another child so no ready signal will be recieved until it is done.
	// The iframe's readySignal will be recieved when the actual box finishes
	if (this.tagName == "iframe") {
		this.body.totalChildren++;
		var iframe = this;
		var iframeElement = new element(iframe.jq.contents().find("body")[0], function(canvas) {
			iframe.contents = canvas;
			iframe.signalReady();
		});
		
		iframeElement.renderCanvas();
	}
	
	
	// Recursively instantiate all childNodes, filtering out non element nodes
	this.childNodes = this._domElement.childNodes;
	this.childElements = [];
	this.childTextNodes = [];
	for (var i = 0; i < this.childNodes.length; i++) {
		var child = this.childNodes[i];
		if (shouldProcess(child)) {
	   		this.childElements.push(new element(child));
	   	}
	   	else if ($(child).is("span.h2c")) {
	   		this.childTextNodes.push(child);
	   	}
	}
	
	// Kick off the rendering since this is the body
	if (this.isBody) {
		this.renderCanvas();
	}
}

element.prototype.signalReady = function() {
	var body = this.body;
	body.readyChildren++;
	if (body.readyChildren == body.totalChildren) {	
	    body.outputCanvas.width = body.scrollWidth; //body.css.outerWidthMargins;
	    body.outputCanvas.height = body.css.outerHeightMargins;
	    body.onready(body.outputCanvas);
	    body.copyToCanvas(body.outputCanvas);
	}
};
var runonce = true;
element.prototype.copyToCanvas = function(canvas) {
	if (this.shouldRender) { 	
	
		var ctx = canvas.getContext("2d"),
			x = this.x, y = this.y,
			w = this.width, h = this.height;
		
		//log("Rendering", this.tagName, this.text, x, y, w, h, canvas.width, canvas.height, this.canvas.width, this.canvas.height);
		
		if (this.jq.attr("data-debug") || true || settings.drawBoundingBox) {
			ctx.strokeStyle = "#d66";
			ctx.lineWidth = 1;
			ctx.strokeRect(x, y, w, h);
		}
		
		// TODO: DRAW OUTLINE
		// Draw a bounding box to show where the DOM Element lies
		if (this.css.outlineWidth > 0) {
			ctx.strokeStyle = this.css.outlineColor;
			ctx.lineWidth = this.css.outlineWidth;
			ctx.strokeRect(
				this.css.outlineOffset.left, this.css.outlineOffset.top, 
				this.css.outlineOffset.width, this.css.outlineOffset.height);
		}
		
		// Render the element's canvas onto this canvas.  May eventually need to move
		// to a getImageData / putImageData model to better use caching	
		// FlashCanvas has a known issue about rendering a canvas that is hidden:
		// http://flashcanvas.net/docs/issues
		// which makes this a real pain in the ass with IE.  Need to come up with a better way
		// of keeping track of each element and getting image data...
		
		if (w > 0 && h > 0) {
			
			var c = this.canvas;
			//document.body.appendChild(c);
			//setTimeout(function() {
			ctx.drawImage(c, x, y, w, h);
			//}, 5000);
		}
		
		// iframes have a contents canvas, that we need to render
		if (this.tagName == "iframe") {
			var c = this.contents;
			var innerOffset = this.css.innerOffset;
			ctx.drawImage(c, innerOffset.left + x, innerOffset.top + y, c.width, c.height);
		}
	}
	
	for (var i = 0, len = this.childElements.length; i < len; i++) {
		this.childElements[i].copyToCanvas(canvas);
	}
};

element.prototype.copyDOM = function() {
		
	var el = this.jq;
	var body = this.body;
	var css = this.css = { };
	
	
	var computedStyleNormal = computedStyle(el[0], styleAttributes);
	for (var i in computedStyleNormal) {
		css[i] = computedStyleNormal[i];
	}
	
	var computedStylePx = computedStyle(el[0], styleAttributesPx);
	for (var i in computedStylePx) {
		css[i] = parseInt(computedStylePx[i]) || 0;
	}
	
	if (css.backgroundColor == "rgba(0, 0, 0, 0)" || css.backgroundColor == "transparent") {
		css.backgroundColor = false;
	}
	
	// Keep track of the parent's color since they won't be reported, but are still needed
	if (css.display == "inline") {
		css.parentBackgroundColor = css.backgroundColor || this.parent.css.parentBackgroundColor;
	}
	else {
		// Clear out the parent background color if we aren't inline
		css.parentBackgroundColor = css.backgroundColor;
	}
	
	this.scrollHeight = el[0].scollHeight;
	this.scrollWidth = el[0].scrollWidth;
	
	if (this.isBody) {
		this.elementHeight = $(this.document).height() - this.css.marginTop - this.css.marginBottom;
		this.offset = { top: 0, left: 0 };
	}
	else {
		this.elementHeight = el.height();
		this.offset = el.offset();
	}
	
	//this.elementWidth = this.scrollWidth;
	//this.elementHeight = this.scrollHeight;
	this.overflowHiddenWidth = el.width();
	this.elementWidth = this.overflowHiddenWidth;
	// Offset needs to be computed with the margin to show where to start the bounding box of element
	// Offset does not take body's border into account, except in certain cases:
	// http://bugs.jquery.com/ticket/7948
	this.hasAbsoluteParent = this.parent && 
		(this.parent.hasAbsoluteParent || this.parent.css.position == "absolute");
		
	var includeBodyBordersInOffset = (this != body);
	if ($.browser.mozilla && !this.hasAbsoluteParent && this.css.position != "fixed") {
		includeBodyBordersInOffset = false;
	}
	
	var bodyBorderTopWidth = includeBodyBordersInOffset ? body.css.borderTopWidth : 0;
	var bodyBorderLeftWidth = includeBodyBordersInOffset ? body.css.borderLeftWidth : 0;
	
	// For some reason, <strong> elements in FF report a font-weight of 401
	if ($.browser.mozilla && parseInt(this.css.fontWeight, 10) == 401) {
		this.css.fontWeight = "bold";
	}
	
	// Shorthand font rule to be used by canvas
	this.css.font = $.trim(this.css.fontStyle + " " + this.css.fontWeight + " "  + this.css.fontSize + "px " + this.css.fontFamily);
	
	// outerHeight: Full height, but without the margins
	this.css.outerHeight = 
		this.elementHeight + 
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
		this.elementWidth + 
		css.paddingLeft +
		css.paddingRight +
		css.borderLeftWidth + 
		css.borderRightWidth;
		
	// outerWidthMargins: The total bounding width of the object
	css.outerWidthMargins = 
		css.outerWidth + 
		css.marginLeft +
		css.marginRight;
	
	// The body needs to render background over margins (at least in Chrome)
	if (this.isBody) {
		this.css.outerHeightMargins = this.css.outerHeightMargins - this.css.marginTop - this.css.marginBottom;
		this.css.outerWidthMargins = this.css.outerWidthMargins - this.css.marginLeft - this.css.marginRight;
	}
	
	// innerOffset: where to start printing content from within the context of the element.
	this.css.innerOffset = {
		left: this.css.marginLeft + this.css.borderLeftWidth + this.css.paddingLeft,
		top: this.css.marginTop + this.css.borderTopWidth + this.css.paddingTop
	};
	
	// innerHeight: Just the base height + padding
	this.css.innerHeight = 
		this.elementHeight + 
		this.css.paddingBottom + 
		this.css.paddingTop;
		
	// innerWidth: Just the base width + padding
	this.css.innerWidth = 
		this.elementWidth + 
		this.css.paddingLeft + 
		this.css.paddingRight;
	
	this.shouldRender = (this._domElement.offsetWidth > 0 && this._domElement.offsetHeight > 0);
	
	this.offsetRenderBox = { 
		top:  Math.floor(Math.max(0, this.offset.top - this.css.marginTop + bodyBorderTopWidth)), 
		left: Math.floor(Math.max(0, this.offset.left - this.css.marginLeft + bodyBorderLeftWidth))
	};
	this.x = this.offsetRenderBox.left;
	this.y = this.offsetRenderBox.top;
	this.width = this.css.outerWidthMargins;
	this.height = this.css.outerHeightMargins;
	
	this.css.outlineOffset = {
		left: this.x + this.css.marginLeft - (this.css.outlineWidth / 2),
		top: this.y + this.css.marginTop - (this.css.outlineWidth / 2),
		width: this.css.outerWidth + (this.css.outlineWidth),
		height: this.css.outerHeight + (this.css.outlineWidth)
	}
	 
	 
	this.isBlock = this.css.display == "block" || this.isBody;
	/*
	// Todo: this width needs to be tested for all types of elements.
	// should be easy to set up a case in the harness with div's, p's, and body
	if (this.isBlock) {
		var oldStyle = el.attr("style");
		this.overflowHiddenWidth = el.css("overflow", "hidden").width();
		
		if (oldStyle) { el.attr("style", oldStyle); }
		else { el.removeAttr("style"); }
		
		this.isOverflowing = this.overflowHiddenWidth != this.width;
	}
	
	// Check if this element is overflowing by seeing if it's width is different than it's parent
	if (this.closestBlock && (this.closestBlock.width < this.width)) {
		this.overflowHiddenWidth = this.closestBlock.width;
		this.isOverflowing = this.overflowHiddenWidth != this.width;
	}
	*/


	if (this.tagName == "img") {
		this.src = el.attr("data-src");
	}
	
	var childNodes = this._domElement.childNodes;
	this.hasOnlyTextNodes = childNodes.length > 0 && this.isTextPlaceholder;
};

element.prototype.renderCanvas = function() {

	if (this.shouldRender) {
		//log("RENDERING CANVAS", this.tagName, this.text, this.height, this.width, this.hasOnlyTextNodes);
		
		var canvas = this.canvas = createCanvas();
		canvas.width = this.width;
		canvas.height = this.height;
		var ctx = canvas.getContext("2d");
		
		var that = this;
		that.renderBackground(ctx, function() {
			that.renderBorders(ctx);
			that.renderText(ctx);
			that.signalReady();
		});
	}
	for (var i = 0, len = this.childElements.length; i < len; i++) {
		this.childElements[i].renderCanvas();
	}
};

element.prototype.renderText = function(ctx) {
	//log("rendering text", this.childTextNodes);
  	
  	if (this.childTextNodes.length == 0) {
  		return;	
  	}
  	
  	ctx.font = this.css.font;
  	ctx.fillStyle = this.css.color;
	ctx.textBaseline = "bottom";
	var textTop = this.offset.top - this.css.innerOffset.top;
	var textLeft = this.offset.left - this.css.innerOffset.left;
	
	for (var i = 0, len = this.childTextNodes.length; i < len; i++) {
		var node = this.childTextNodes[i];
		var text = node.innerText; // node.childNodes[0].data;
		var top =  node.offsetTop - textTop + node.offsetHeight;
		var left = node.offsetLeft - textLeft;
		
		//log(text, top, left, this.css);
		ctx.fillText(text, left, top);
		
	}
};

element.prototype.renderBorders = function(ctx) {
	
	// TODO: Insets, etc.
	
	var css = this.css;
	var offsetLeft = css.marginLeft;
	var offsetTop = css.marginTop;
	
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


element.prototype.renderBackground = function(ctx, cb) {
	var css = this.css;
	var offsetLeft = this.isBody ? 0 : this.css.marginLeft;
	var offsetTop = this.isBody ? 0 : this.css.marginTop;
	var outerWidth = css.outerWidth;
	var outerHeight = css.outerHeight;
	var backgroundColor = css.parentBackgroundColor;
	var backgroundImage = css.backgroundImage;
	var backgroundRepeat = css.backgroundRepeat;
	var innerOffset = this.css.innerOffset;
	var tagName = this.tagName;
	if (this.tagName == "span" && this.text == "community") {
		log("HEREEEE", backgroundColor);
	}
	
	if (this.textStartsOnDifferentLine) {
		backgroundColor = false;
	}
	
	if (backgroundColor) {
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(offsetLeft, offsetTop, outerWidth, outerHeight);
	}
	if (this.tagName == "a") {
		//ctx.fillStyle = "red";
		//ctx.fillRect(offsetLeft, offsetTop, this.css.outerWidth, this.css.outerHeight);
	}
	if (this.tagName == "span") {
		//ctx.fillStyle = "green";
		//ctx.fillRect(offsetLeft, offsetTop, this.css.outerWidth, this.css.outerHeight);
	}
	var ownerDoc = this.jq[0].ownerDocument;
	
	if (this.tagName == "img") {
		retrieveImage(this.src, function(img, broken, transparent) {
			if (img == "error") {
				// Draw the 'broken' image if the image couldn't load
				// This image needs to be centered on the ctx (at least in Chrome)
				// taking into account the margins
				var centerX = innerOffset.left + 
					(outerWidth / 2) - (broken.width);
				var centerY = innerOffset.top + 
					(outerHeight / 2) - (broken.height);
	    		ctx.drawImage(broken, centerX, centerY, broken.width, broken.height);
			}
			else {
	    		ctx.drawImage(img, offsetLeft, offsetTop, img.width, img.height);
	    	}
	    	cb();
		}, ownerDoc);
	}
	else if (backgroundImage != "none") {
		retrieveImage(backgroundImage, function(img, broken, transparent) {
			if (img == "error") { 
        		ctx.fillStyle = ctx.createPattern(transparent, backgroundRepeat);
				ctx.fillRect(offsetLeft, offsetTop, outerWidth, outerHeight);
			}
			else {
				//log("Rendering", ctx.canvas.width, img.src, outerWidth, tagName )
        		ctx.fillStyle = ctx.createPattern(img, backgroundRepeat);
				ctx.fillRect(offsetLeft, offsetTop, outerWidth, outerHeight);
			}
	    	cb();
		}, ownerDoc);
	}
	else {
		cb();
	}
};

// retrieveImage: a method to interface with image loading, errors, and proxy
retrieveImage.cache = { };
function retrieveImage(src, cb, ownerDocument) {
	if (!$.isFunction(cb)) {
		cb = function() { };
	}
	
	if (retrieveImage.cache[src]) {
		log("Cache hit", src, retrieveImage.cache[src]);
		return cb(retrieveImage.cache[src]);	
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
	    	loadImageDirectly = false;
	    	var proxy = "http://localhost/~brian/html2canvas/form/proxy.php?url=" + src;
	    	var cssHTTP = "http://localhost/~brian/html2canvas/form/csshttp?url=" + src;
	    	
	    	// TODO: Don't use JSONP, use some kind of cross frame communication instead, since it gives more reliable error handling
	    	/*$.ajax(proxy, {
	    		dataType: "jsonp",
	    		success: function(data) {
	    			makeImage(data);
	    		}
	    	});*/
	    	
			CSSHttpRequest.get(
    		    cssHTTP,
    		    function(response) { log(response); makeImage(response); }
    		);
	    	
	    }
	}
	
	if (loadImageDirectly) {
		makeImage(src);
	}
	
	function makeImage(src) {
		var img = new Image();
		img.onload = sendSuccess;
		img.onerror = sendError;
		img.src = src;
	}
	
	function sendError() {
		cb("error", 
			retrieveImage.cache[retrieveImage.brokenImage],
			retrieveImage.cache[retrieveImage.transparentImage]
		);
	}
	
	function sendSuccess() {
		var i = this;
	    retrieveImage.cache[src] = i;
	    cb(i);
	}
}

// Not needed anymore
function wordWrap(ctx, phrase, maxWidth, initialOffset, isNewLine) {
	var words = phrase.split(" ");
	var lastLine = [];
	var lastX = initialOffset || 0;
	var output = [];
	
	for (var i = 0; i < words.length; i++) {
		var word = $.trim(words[i]);
		if (word == "") { continue; }
		
		var widthWithSpace = ctx.measureText(word + ' ').width;
	    
	    // Handle edge case where word doesn't fit with space, but does without.
	    // Want to still add it to the line, and the next word will get pushed down
	    if ((lastX + widthWithSpace) > maxWidth) {
	    	var widthNoSpace = ctx.measureText(word).width;
	    	if ((lastX + widthNoSpace) <= maxWidth) {
	    		widthWithSpace = widthNoSpace;
	    	}
	    }
	    
		lastX += widthWithSpace;
		
	    if (lastX > maxWidth) {
			// It is time for a new line.
	    
	    	var isFirstWord = (lastLine.length == 0) && isNewLine;
	    	
	    	if (isFirstWord) {
				// Need it to get printed because it's the only thing in the line.
	    		lastX = 0;
	    		output.push(word);
	    	}
	    	else {
	    		// Start the next line, first rendering out the current one if necessary.
	    		// This could be the case where a line came in starting nearly done, and we couldn't
	    		// even get the first word in before getting too big.
	    		if (lastLine.length) { output.push(lastLine.join(' ')); }
	    		isNewLine = true;
	    		lastX = widthWithSpace;
	    		lastLine = [word];
	    	}
	    } 
	    else {
	    	// Normal case - just add this word to the current line
	    	lastLine.push(word);
	    }    
	}
	
	if (lastLine.length) {	
		// There was leftover words in the line (it didn't end on an end of line)
		output.push(lastLine.join(' '));
	}
	
	return output;
}

retrieveImage.transparentImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACWCAYAAABkW7XSAAADLUlEQVR4Ae3QQREAAAiAMPqXVjv4HUeCNXWLAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwENgAfmTAf/IVJfgAAAAAElFTkSuQmCC";

retrieveImage.brokenImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAVBAMAAABWJ8jiAAAAIVBMVEUAAAAA//8A/wDAwMD/AP//AACAgIAAAID///8AgAAAAP87p9+eAAAAb0lEQVQImWPogIEGBmQmAwhkgJkcIKE0CNMYCDIyIEzLycYZbRDmpAnGDAwQ5swJxsYNEKYBM5xpbLxqAcQEU2PjhVCmSbDxqgoo09UYqB/CdAnuaIYwDYBOgjKNgSyoYRAngh0JZDBALMbuCzgTAD+sVWJQUviMAAAAAElFTkSuQmCC";

retrieveImage(retrieveImage.brokenImage);
retrieveImage(retrieveImage.transparentImage);


function getFeedbackFrameHtml() {
	return "Welcome to my custom processing...";
}

function buildUI(container) {
	
	var doc = container.ownerDocument;
	var feedbackStyles = "z-index: 100004; border: 0px; width: 250px; height: 200px;" +
		"display: block; position: fixed; right: 6px; bottom: 0px; background:green;";
	var frame = $("<iframe scrolling='no' frameborder='0' style='"+feedbackStyles+"' src='javascript:' />", 
		doc);
	
	frame.appendTo(container);
	var frameDoc = frame.contents()[0];
	frameDoc.open();
	frameDoc.write(getFeedbackFrameHtml());
	frameDoc.close();
	
}

if (window.html2canvasProcessOnLoad) {
	html2canvas(document.body, window.html2canvasProcessOnLoad);
}

if (window.parent) {
	var hasKey = window.parent.h2c && window.parent.h2c.key;
	assert(hasKey, "No key provided");
	
	log("Frame has been loaded.  Key received.", window.parent.document.body, window.parent.h2c.key);
	
	
		
	var container = window.frameElement.parentNode;
	buildUI(container);

	
	var parentDoc = window.parent.document;
	
	
	html2canvas(parentDoc.body, function(canvas) {
		//log("DONE", canvas.toDataURL());
		log("Processing is finished...")
		$(canvas).css({
		    "position": "absolute",
		    "top": 0,
		    "left": 0,
		    "z-index": 1001,
		    "opacity": ".5"
		}).appendTo(container);
	});
}

})();
