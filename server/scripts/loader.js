window.h2c = {
	key: '_adf2',
	base: "http://localhost/~brian/html2canvas/server/scripts/",
	loader: function() {
		
		window.html2canvasProcessOnLoad = function(canvas) {
			console.log(arguments);
			$(canvas).css({
				"position": "absolute",
				"top": 0,
				"left": 0,
				"z-index": 1001,
				"opacity": ".5"
			}).appendTo("body");
		}
		
		var s = document.createElement("script");
		s.setAttribute("type", "text/javascript");
		s.setAttribute("src", window.h2c.base + "compiled.js");
		document.body.appendChild(s);
		
		return false;
	}
}
