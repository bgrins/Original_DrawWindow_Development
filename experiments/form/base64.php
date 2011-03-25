<?php

header("Content-Type: text/css");
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

$prepend = "data:" . $type . ";base64,";
$base64 = base64_encode($response);

echo '#url { background-image:url("' . $prepend . $base64 . '") }';

curl_close($session);

?>