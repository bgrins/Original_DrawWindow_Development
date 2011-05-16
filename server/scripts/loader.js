window.h2c = {
	key: '_adf2',
	domain: null,
	cache: false,
	frameHTML: function() {
		var html = [];
		var scriptPath = "localhost/~brian/html2canvas/server/scripts/";
		var host = (("https:" == document.location.protocol) ? "https://" : "http://");
		var src = host + scriptPath + "compiled.js";
		var src1 = host + scriptPath + "jquery-1.6.1.min.js";
		var src2 = host + scriptPath + "h2.js" + (h2c.cache ? "" : "?dt=" + (new Date()).getTime());
		var flashcanvas = host + scriptPath + "flashcanvaspro/flashcanvas.js";
		


		html.push("<html><head>");
		/*html.push("<script type='text/javascript' src='"+src+"'></script>");*/
		html.push("<script type='text/javascript' src='"+src1+"'></script>");
		html.push("<script type='text/javascript' src='"+src2+"'></script>");
		html.push("<!--[if lt IE 9]><script type='text/javascript' src='"+flashcanvas+"'></script><![endif]-->");
		html.push("</head><body>Loading</body></html>");
		return html.join('');
	},
	createElement: function(el) {
		if (document.createElementNS && document.documentElement.namespaceURI !== null) {
		    return document.createElementNS("http://www.w3.org/1999/xhtml", el)
		} 
		else {
		    return document.createElement(el)
		} 
	},
	writeFrame: function(appendTo) {
	
		var frame = h2c.createElement("iframe");
		frame.frameBorder = 0;
		frame.style.border = "0";
		frame.style.width = '1px';
		frame.style.height = '1px';
		frame.style.position = 'absolute';
		frame.style.top = '-2px';
		frame.style.left = '-2px';
		
		var domain = this.domain;
  		var internetExplorer = document.selection && 
  			window.ActiveXObject && /MSIE/.test(navigator.userAgent);
		
		if (domain && internetExplorer) {
			frame.h2c.html = this.frameHTML();
			frame.src = "javascript:(function(){document.open();" +
			  (domain ? "document.domain=\"" + domain + "\";" : "") +
			  "document.write(window.frameElement.h2c.html);document.close();})()";
			appendTo.appendChild(frame);
		  	
		}
		else {
		  	frame.src = "javascript:;";
			appendTo.appendChild(frame);
    		var doc = frame.contentWindow.document;
    	  	doc.open();
    	  	doc.write(this.frameHTML());
    	  	doc.close();
		}
	},
	loader: function() {
		var div = h2c.createElement("div");
		
		div.id = 'h2c-wrapper';
		div.style.position = "absolute";
		div.style.top = "0";
		div.style.left = "0";
		div.style.width = "0";
		div.style.height = "0";
		div.style.zIndex = 100001;
		
		var oldWrapper = document.getElementById('h2c-wrapper');
		
		if (oldWrapper) {
			oldWrapper.parentNode.removeChild(oldWrapper);
		}
		document.body.appendChild(div);
		window.h2c.writeFrame(div);		
		return false;
	}
}
