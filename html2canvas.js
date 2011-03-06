/*
html2canvas.js
Render HTML to a canvas relying on the browser's layout engine
*/

/*
NEEDS MORE TESTING FOR:
  * Background Properties
  * Images
  * Page zoomed on load
*/

(function() {

window.html2canvas = html2canvas;
html2canvas.element = element;
html2canvas.logLevels = { RELEASE: 0, NORMAL: 1, VERBOSE: 2 };
var settings = html2canvas.settings = {
	enabled: !!document.createElement('canvas').getContext,
	drawBoundingBox: false,
	logLevel: html2canvas.logLevels.RELEASE
};


function log() { if (window.console) { console.log(Array.prototype.slice.apply(arguments)); } }
function log1() { if (settings.logLevel >= 1) { log.apply(this, arguments); } }
function log2() { if (settings.logLevel >= 2) { log.apply(this, arguments); } }
function error(msg) { throw "[Web Designer] " + msg; return false; }
function shouldProcess(dom) { return (dom.nodeType == 1) && (!ignoreTags[dom.tagName.toLowerCase()]); }
function computedStyle(elem, styles) {
	var defaultView = elem.ownerDocument.defaultView;
	var computedStyle = defaultView.getComputedStyle( elem, true );
	var ret = { };
	for (var i = 0; i < styles.length; i++) {
		ret[styles[i]] = computedStyle.getPropertyValue( styles[i] );
	}
	return ret;
}

var getUniqueID = (function(id) { return function() { return id++; } })(0);
var ignoreTags = { 'style':1, 'br': 1, 'script': 1, 'link': 1 };
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

// Convert: <div>Hi <strong>there.</strong> <!-- some comment --></div>
// Into: <div><span>Hi </span><strong>there.</strong></div>
$.fn.wrapSiblingTextNodes = function(wrapper) {
	return this.each(function() {
		var element = $(this);
		var children = element.children();
		element.contents().each(function() {
		    if (this.nodeType == 3) {
		    	if ($.trim(this.data) == "") { $(this).remove(); }
		    	if (children.length) {
		    		$(this).wrap(wrapper);
		    	}
		    }
		    else if (this.nodeType != 1) {
		    	$(this).remove();
		    }
		});
		
	});
};

function html2canvas(body, width, cb) {
	
	if ((typeof body) == "string") {
		var iframe = $("<iframe src=''></iframe>").appendTo("body");
		body = iframe.contents().find("body").html(body)[0];
	}
	
	if ($.isFunction(width)) {
		cb = width;
		width = false;
	}
	if (width) {
		$(body).width(width);
	}
	
	// TODO: cloning wipes current styles, but we probably still want to seperate it
	// since we manipulate the dom
	//var clone = body.cloneNode();
	//log(clone, body, clone.ownerDocument == body.ownerDocument);
	
	var el = new element(body, function(canvas) {
		cb(canvas);
	});
	
	el.renderCanvas();
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
	this.nodeType = this._domElement.nodeType;
	this.tagName = this._domElement.tagName.toLowerCase();
	this.readyChildren = 0;
	this.ready = false;
	this.onready = onready || function() { };
	
	if (this.tagName == "body") {
		this.totalChildren = 0;
		this.readyChilren = 0;
		this.body = this;
		this.outputCanvas = document.createElement("canvas");
		this.outputCanvas._el = this;
	}
	else {
		this.parent = this._domElement.parentNode._element;
		this.body = this.parent.body;
		this.closestBlock = (this.parent.isBlock) ? this.parent : this.parent.closestBlock;
		this.body.totalChildren++;
	}
	
	this.jq.wrapSiblingTextNodes("<span></span>");
	
	this.copyDOM();
	
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
	for (var i = 0; i < this.childNodes.length; i++) {
		var child = this.childNodes[i];
		if (shouldProcess(child)) {
	   		this.childElements.push(new element(child));
	   	}
	}
}


element.prototype.signalReady = function() {
	if (this.tagName != "body") {
		var body = this.body;
		body.readyChildren++;
		if (body.readyChildren == body.totalChildren) {	
			body.outputCanvas.width = body.css.outerWidthMargins;
			body.outputCanvas.height = body.css.outerHeightMargins;
			body.copyToCanvas(body.outputCanvas);
			body.onready(body.outputCanvas);
		}
	}
};

element.prototype.copyDOM = function() {
		
	var el = this.jq;
	
	this.css = { };
	
	var computedStyleNormal = computedStyle(el[0], styleAttributes);
	var computedStylePx = computedStyle(el[0], styleAttributesPx);
	for (var i in computedStyleNormal) {
		this.css[$.camelCase(i)] = computedStyleNormal[i];
	}
	for (var i in computedStylePx) {
		this.css[$.camelCase(i)] = parseInt(computedStylePx[i]) || 0;
	}
	
	/* May want to use jQuery CSS (it is a little slower, but MAY give better results?
	for (var i = 0; i < styleAttributes.length; i++) {
		var attr = styleAttributes[i];
		this.css[$.camelCase(attr)] = el.css(attr);
	}
	for (var i = 0; i < styleAttributesPx.length; i++) {
		var attr = styleAttributesPx[i];
		this.css[$.camelCase(attr)] = parseInt(el.css(attr), 10) || 0;
	}
	*/
	
	this.offset = el.offset();
	this.position = el.position();
	this.elementHeight = el.height();
	this.elementWidth = this.overflowHiddenWidth = el.width();
	
	// Offset needs to be computed with the margin to show where to start the bounding box of element
	// Offset does not take body's border into account, except in certain cases:
	// http://bugs.jquery.com/ticket/7948
	var body = this.body;
	this.hasAbsoluteParent = this.parent && 
		(this.parent.hasAbsoluteParent || this.parent.css.position == "absolute");
		
	var includeBodyBordersInOffset = (this != body);
	if ($.browser.mozilla && !this.hasAbsoluteParent && this.css.position != "fixed") {
		includeBodyBordersInOffset = false;
	}
	
	var bodyBorderTopWidth = includeBodyBordersInOffset ? body.css.borderTopWidth : 0;
	var bodyBorderLeftWidth = includeBodyBordersInOffset ? body.css.borderLeftWidth : 0;
	
	this.isBlock = this.css.display == "block" || this.tagName == "body";
	
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
	
	// For some reason, <strong> elements in FF report a font-weight of 401 even though they are bold
	if ($.browser.mozilla && parseInt(this.css.fontWeight, 10) == 401) {
		this.css.fontWeight = "bold";
	}
	
	this.css.font = $.trim(this.css.fontStyle + " " + this.css.fontWeight + " "  + this.css.fontSize + "px " + this.css.fontFamily);
	
	// outerHeight: Full height, but without the margins
	this.css.outerHeight = 
		this.elementHeight + 
		this.css.paddingTop +
		this.css.paddingBottom +
		this.css.borderTopWidth +
		this.css.borderBottomWidth;
	
	// outerHeightMargins: The total bounding height of the object
	this.css.outerHeightMargins = 
		this.css.outerHeight + 
		this.css.marginTop + 
		this.css.marginBottom;
		
	// outerWidth: Full width, but without the margins
	this.css.outerWidth = 
		this.elementWidth + 
		this.css.paddingLeft +
		this.css.paddingRight +
		this.css.borderLeftWidth + 
		this.css.borderRightWidth;
		
	// outerWidthMargins: The total bounding width of the object
	this.css.outerWidthMargins = 
		this.css.outerWidth + 
		this.css.marginLeft +
		this.css.marginRight;
	
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
	
	this.shouldRender = (this.css.outerWidthMargins > 0 && this.css.outerHeightMargins > 0);
	
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
	 
	if (this.tagName == "img") {
		this.src = el.attr("src");
	}
	
	var childNodes = this._domElement.childNodes;
	this.hasOnlyTextNodes = (childNodes.length > 0); // img, hr, etc shouldn't show up as text nodes
	for (var i = 0; i < childNodes.length; i++) {
		if (childNodes[i].nodeType != 3) { this.hasOnlyTextNodes = false; }
	}
	
	if (this.hasOnlyTextNodes) {
	
		this.text = el.text();
	
		var oldHtml = el.html();
		var newHtml = "<span id='measure'>x</span>";
		var measured = el.html(newHtml).find("#measure");
		var textStart = el.position();
		if (!this.css.lineHeight) {
			this.css.lineHeight = measured.height();
		}
		el.html(oldHtml);
		
		this.textStartsOnDifferentLine = 
			(textStart.left != this.position.left) ||  
			(textStart.top != this.position.top);
			
		this.textStart = {
			top: textStart.top - this.position.top,
			left: textStart.left - this.position.left
		};
		
		this.css.textBaselinePx = (this.css.lineHeight) - ((this.css.lineHeight - this.css.fontSize) / 2);
	}
};

element.prototype.copyToCanvas = function(canvas) {
	if (!this.shouldRender) { return; }
	
	var ctx = canvas.getContext("2d"),
		x = this.x, y = this.y,
		w = this.width, h = this.height;
	
	log2("Rendering", this.tagName, this.text, x, y, w, h);
	
	if (this.jq.attr("data-debug") || settings.drawBoundingBox) {
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
	if (w > 0 && h > 0) {
		ctx.drawImage(this.canvas, x, y, w, h);
	}
	
	// iframes have a contents canvas, that we need to render
	if (this.tagName == "iframe") {
		var c = this.contents;
		var innerOffset = this.css.innerOffset;
		ctx.drawImage(c, innerOffset.left + x, innerOffset.top + y, c.width, c.height);
	}
	
	
	for (var i = 0, len = this.childElements.length; i < len; i++) {
		this.childElements[i].copyToCanvas(canvas);
	}
};


element.prototype.renderCanvas = function() {

	if (!this.shouldRender) { return; }
	log2("RENDERING CANVAS", this.tagName, this.height, this.width);
	
	var canvas = this.canvas = document.createElement("canvas");
	canvas.width = this.width;
	canvas.height = this.height;
	var ctx = canvas.getContext("2d");
	
	
	var that = this;
	that.renderBackground(ctx, function() {
		that.renderBorders(ctx);
		that.renderText(ctx);
		that.signalReady();
	});
	
	for (var i = 0, len = this.childElements.length; i < len; i++) {
		this.childElements[i].renderCanvas();
	}
};

element.prototype.renderText = function(ctx) {
	if (this.hasOnlyTextNodes) {
		
		// Time to print out some text, don't have to worry about any more elements changing styles
  		ctx.font = this.css.font;
  		ctx.fillStyle = this.css.color;
		ctx.textBaseline = "bottom";
		
		var startX = this.css.innerOffset.left;
		var startY = this.css.innerOffset.top + this.css.textBaselinePx;
		var minimumTextY = this.css.outerHeightMargins - this.css.marginBottom - this.css.borderBottomWidth;
		
		if (this.textStartsOnDifferentLine) {
			startX = this.textStart.left;
		}
		
		var lines = wordWrap(ctx, this.text, this.overflowHiddenWidth, 
			startX, !this.textStartsOnDifferentLine);
	
		log2("Recieved lines", lines, startX, this.css.lineHeight, this.overflowHiddenWidth, this.css.outerWidthMargins);
		
		for (var j = 0; j < lines.length; j++) {
		
		    //log2("Rendering Text", lines[j], startX, offsetTop + lastY);
		    
		    // Push down to next line of printing
		   // error(this.css.lineHeight + " " +  this.css.fontSize + " " + this.css.textBaselinePx);
		    
		    
		    if (lines[j] != ' ') { 
		    	
		    	if (startY > minimumTextY) {
		    		startY = minimumTextY;
		    		log("ERROR", lines[j], startY, minimumTextY, lines, this.css.outerHeightMargins,
		    			this.css.textBaselinePx, this.css.fontSize, this.css.lineHeight, this.css.innerOffset);
		    		//error("Text parsing: '" + lines[j] + "' is too low (" + startY + ", " + minimumTextY + ")");
		    	}
		    	
		    	var width = ctx.measureText(lines[j]).width;
		    	ctx.fillText(lines[j], startX, startY);
		    	
				if (this.css.textDecoration == 'underline') {
					
					ctx.moveTo(startX, this.css.fontSize);
					ctx.lineTo(startX + width, this.css.fontSize);
					ctx.strokeStyle = this.css.color;
					ctx.lineWidth = 1; //face.underlineThickness;
					ctx.stroke();
				}

		    	startY = startY + this.css.lineHeight;
		    }
		    
		    // reset in case this started at a different place (textStartsOnDifferentLine)
		    startX = this.css.innerOffset.left;
		}
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
	var offsetLeft = this.css.marginLeft;
	var offsetTop = this.css.marginTop;
	
	if (this.css.backgroundColor) {
		ctx.fillStyle = this.css.backgroundColor;
		ctx.fillRect(offsetLeft, offsetTop, this.css.outerWidth, this.css.outerHeight);
	}
	
	var ownerDoc = this.jq[0].ownerDocument;
	
	if (this.tagName == "img") {
		retrieveImageCanvas(this.src, function(imgCanvas) {
	    	ctx.drawImage(imgCanvas, 0, 0, imgCanvas.width, imgCanvas.height);
	    	cb();
		}, ownerDoc);
	}
	else if (this.css.backgroundImage != "none") {
		retrieveImageCanvas(this.css.backgroundImage, function(imgCanvas) {
	    	ctx.drawImage(imgCanvas, 0, 0, imgCanvas.width, imgCanvas.height);
	    	cb();
		}, ownerDoc);
	}
	else {
		cb();
	}
};

retrieveImageCanvas.cache = { };
function retrieveImageCanvas(src, cb, ownerDocument) {

	if (src.indexOf("data:") == -1) {
	    var url = new RegExp(/url\((.*)\)/);
	    var matched = url(src);
	    if (matched && matched[1]) {
	    	src = matched[1];
	    }
	    
	    
	    // Convert a relative path into absolute.
	    // TODO: Is this worth the js URI dependancy since it may not be running in frame?
	    var original = new URI(src);
	    if (!original.getAuthority()) {
	    	 var root = new URI((ownerDocument || document).location.href);
	    	 src = original.resolve(root).toString();
	    }
	    
	    if (retrieveImageCanvas.cache[src]) {
	    	src = retrieveImageCanvas.cache[src];
	    }
	}
	
	var imgCanvas = document.createElement("canvas");
	var imgCtx = imgCanvas.getContext("2d");
	var img = new Image();
	img.onload = function() {
	    imgCanvas.width = img.width;
	    imgCanvas.height = img.height;
	    imgCtx.drawImage(img, 0, 0, img.width, img.height);
	    retrieveImageCanvas.cache[src] = imgCanvas.toDataURL("image/png");
	    
	    cb(imgCanvas);
	};
	img.onerror = function() {
		// Todo: draw 'broken' image
		imgCanvas.width = imgCanvas.height = 1;
		cb(imgCanvas);
	}
	img.src = src;

}

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

if (window.html2canvasProcessOnLoad) {
	html2canvas(document.body, window.html2canvasProcessOnLoad)
}

})();
