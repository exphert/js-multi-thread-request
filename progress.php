<?php
// Set headers to disable caching
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');

function sendProgress($progress) {
    echo "data: {$progress}\n\n";
    ob_flush();
    flush();
}

for ($i = 1; $i <= 100; $i++) {
    // Simulate some work with sleep
    sleep(1);

    // Send progress to the client
    sendProgress($i);
}
?>
