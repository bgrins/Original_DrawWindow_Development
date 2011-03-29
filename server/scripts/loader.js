window.h2c = {
	key: '_adf2',
	domain: null,
	frameHTML: function() {
		var html = [];
		var scriptPath = "192.168.0.169/~brian/html2canvas/server/scripts/";
		var host = (("https:" == document.location.protocol) ? "https://" : "http://");
		var src = host + scriptPath + "compiled.js";
		html.push("<html><head>");
		html.push("<script type='text/javascript' src='"+src+"'></script>");
		html.push("</head><body></body></html>");
		return html.join('');
	},
	loader: function() {
		var scriptPath = "192.168.0.169/~brian/html2canvas/server/scripts/";
		var host = (("https:" == document.location.protocol) ? "https://" : "http://");
		
		function createHTMLElement(el) {
		  if (document.createElementNS && document.documentElement.namespaceURI !== null)
		    return document.createElementNS("http://www.w3.org/1999/xhtml", el)
		  else
		    return document.createElement(el)
		}
		
		
		window.html2canvasProcessOnLoad = function(canvas) {
			console.log(canvas);
			//return;
			$(canvas).css({
				"position": "absolute",
				"top": 0,
				"left": 0,
				"z-index": 1001,
				"opacity": ".5"
			}).appendTo("body");
		}
		
		
		var frame = createHTMLElement("iframe");
		frame.frameBorder = 0;
		frame.style.border = "0";
		frame.style.width = '1';
		frame.style.height = '1';
		frame.style.display = "none";
		
		frame.h2c = { };
		frame.h2c.processOnLoad = true;
		var domain = this.domain;
  		var internetExplorer = document.selection && window.ActiveXObject && 
  			/MSIE/.test(navigator.userAgent);
  			
		if (domain && internetExplorer) {
		  frame.h2c.html = this.frameHTML();
		  frame.src = "javascript:(function(){document.open();" +
		    (domain ? "document.domain=\"" + domain + "\";" : "") +
		    "document.write(window.frameElement.h2c.html);document.close();})()";
		}
		else {
		  frame.src = "javascript:;";
		}
		
		document.body.appendChild(frame);
		
    	var win = frame.contentWindow;
    	if (!domain || !internetExplorer) {
    	  win.document.open();
    	  win.document.write(this.frameHTML());
    	  win.document.close();
    	}
		
		//var s = document.createElement("script");
		//s.setAttribute("type", "text/javascript");
		//s.setAttribute("src", host + scriptPath + "compiled.js");
		//document.body.appendChild(s);
		
		return false;
	}
}
