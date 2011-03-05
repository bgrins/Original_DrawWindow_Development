function log() {
	if (window.console) {
		console.log(Array.prototype.slice.apply(arguments));
	}
}
var blankSrc = "about:blank";
var data = [];


function frameLoaded(frame, ind) {
	$(frame).attr("ready", "true").attr("ind", ind);
	var body = $(frame).contents().find("body");
	if (frame.src == blankSrc) {
		body.html(data[ind]);
	}
	$(frame).height(body[0].scrollHeight).width(body[0].scrollWidth);

	html2canvas(body[0], function(canvas) {
		$(frame).closest(".result").find('.canvas').html('').append(canvas);
	});
}

$(function() {
	html2canvas.settings.drawBoundingBox = $("#drawBoundingBox").attr("checked");
	$("#drawBoundingBox").change(function() {
		html2canvas.settings.drawBoundingBox = $(this).attr("checked");
		$("iframe[ready]").each(function() { 
			log($(this).attr("ind")); 
			frameLoaded(this, $(this).attr("ind"));
		})
	});
	
	$("script[type='text/html']").each(function() {		
		var results = $($("#testTemplate").html()).appendTo($("#tests"));
		data.push($(this).html());
		var ind = data.length - 1;
		var src = $(this).data("src") || blankSrc;
		results.find("h2").text($(this).data("description") || ("Test " + ind));
	    var iframe = $("<iframe id='test-"+ind+"' onload='frameLoaded(this, "+ind+");' src='"+src+"' />").
	    	appendTo(results.find(".frame"));
	});
});