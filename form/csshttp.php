<?php

define('PREFIX', "data:,");
define('LENGTH', 2000 - strlen(PREFIX)); 

function encode($string) {
	$quoted = rawurlencode($string);
	$out = "";
	for ($i = 0, $n = 0; $i < strlen($quoted); $i += LENGTH, $n++) {
		$out .= "#c" . $n . "{background:url(" . PREFIX . substr($quoted, $i, LENGTH) . ");}\n";
	}
	return $out;
}


$url = $_GET['url'];
if (!isset($url)) {
	exit();
}

//Start the Curl session
$session = curl_init($url);

// Don't return HTTP headers. Do return the contents of the call
curl_setopt($session, CURLOPT_HEADER, false);
curl_setopt($session, CURLOPT_FOLLOWLOCATION, true); 
//curl_setopt($ch, CURLOPT_TIMEOUT, 4); 
curl_setopt($session, CURLOPT_RETURNTRANSFER, true);

// Make the call
$response = curl_exec($session);

$type = curl_getinfo($session, CURLINFO_CONTENT_TYPE);
$base64 = base64_encode($response);

echo encode("data: " . $type . ";base64," . $base64)

?>