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
	
	setTimeout(function() {
		$(frame).height(body[0].scrollHeight).width(body[0].scrollWidth);	
		html2canvas(body[0], function(canvas) {
			$(frame).closest(".result").find('.canvas').html('').append(canvas);
		});
	}, 100);

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
	
	$("#run").click(function() {
		$("#tests").empty();
		
		$("#testsToRun input:checked").each(function() {
			var results = $($("#testTemplate").html()).appendTo($("#tests"));
			var src = $(this).attr("src");
			var ind = $(this).attr("ind");
			results.find("h2").text($(this).attr("description") || ("Test " + ind));
	    	var iframe = $("<iframe id='test-"+ind+"' onload='frameLoaded(this, "+ind+");' src='"+src+"' />").
	    		appendTo(results.find(".frame"));
		});
	});
	
	var inputs = [];
	$("script[type='text/html']:not([disabled])").each(function() {	
		data.push($(this).html());
		var ind = data.length - 1;
		var desc = $(this).attr("description");
		var src = $(this).attr("data-src") || blankSrc;
		inputs.push(
			"<label>" +
			"<input type='checkbox' ind='"+ind+"' description='"+desc+"' src='"+src+"' />" +
			desc +
			"</label><br />"
		);
	});
	$("#testsToRun").html(inputs.join('')).find("input:first").attr("checked", "checked");
	
	$("#selectAll").click(function() {
		var allInputs = $("#testsToRun input");
		if (allInputs.filter(":checked").length > 0) {
			allInputs.removeAttr("checked");
		}
		else {
			allInputs.attr("checked", "checked");
		}
		return false;
	});
});