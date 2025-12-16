<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: *");
header("Access-Control-Allow-Methods: *");

$db = new PDO("sqlite:" . __DIR__ . "/../db/games.db");
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$method = $_SERVER['REQUEST_METHOD'];
$uri = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$parts = explode('/', $uri);

if ($method === 'GET' && $uri === 'games') {
    $stmt = $db->query("SELECT * FROM games ORDER BY id DESC");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

if ($method === 'GET' && $parts[0] === 'games' && isset($parts[1])) {
    $stmt = $db->prepare("SELECT letter, result FROM steps WHERE game_id = ?");
    $stmt->execute([$parts[1]]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

if ($method === 'POST' && $uri === 'games') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data) { http_response_code(400); echo json_encode(["error"=>"Invalid JSON"]); exit; }

    $stmt = $db->prepare("INSERT INTO games (player, word, won, wrong, created_at) VALUES (?, ?, ?, ?, datetime('now'))");
    $stmt->execute([$data['player'], $data['word'], $data['won'] ? 1 : 0, $data['wrong']]);
    $gameId = $db->lastInsertId();

    foreach ($data['history'] as $h) {
        $stmt2 = $db->prepare("INSERT INTO steps (game_id, letter, result) VALUES (?, ?, ?)");
        $stmt2->execute([$gameId, $h['letter'], $h['result']]);
    }

    echo json_encode(["id" => $gameId]);
    exit;
}

if ($method === 'POST' && $parts[0] === 'step' && isset($parts[1])) {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || !isset($data['letter']) || !isset($data['result'])) {
        http_response_code(400); 
        echo json_encode(["error"=>"Invalid JSON"]); 
        exit; 
    }

    $stmt = $db->prepare("INSERT INTO steps (game_id, letter, result) VALUES (?, ?, ?)");
    $stmt->execute([$parts[1], $data['letter'], $data['result']]);

    echo json_encode(["status"=>"ok"]);
    exit;
}

$indexPath = __DIR__ . '/index.html';
if (file_exists($indexPath)) {
    header("Content-Type: text/html");
    readfile($indexPath);
    exit;
}

http_response_code(404);
echo "Страница не найдена";
