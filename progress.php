<?php

$task = $_GET["task"] ?? 0;

if ($task == 3) {
    header('Content-Type: application/json');
    $json = [
        'title' => 'Some Title',
        'content' => 'This is the content returned via JSON.'
    ];
    echo json_encode($json);
    exit;
}

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');

function sendProgress($progress) {
    echo "data: {$progress}\n\n";
    ob_flush();
    flush();
}

for ($i = 1; $i <= 10; $i++) {
    sleep(1); // Simulate work
    sendProgress($i);
	if ($task == 2 && $i == 5) {
		sendProgress("stop-here"); // Custom end trigger
	}
}

