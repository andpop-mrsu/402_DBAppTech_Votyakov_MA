<?php
$autoloadPath = realpath(__DIR__ . '/../vendor/autoload.php');
if (!$autoloadPath) {
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Autoload not found',
        'path' => __DIR__ . '/../vendor/autoload.php'
    ]);
    exit;
}

require $autoloadPath;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;

$app = AppFactory::create();
$app->addBodyParsingMiddleware();

$app->add(function (Request $request, $handler) {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        ->withHeader('Content-Type', 'application/json');
});

$app->options('/{routes:.+}', function (Request $request, Response $response) {
    return $response;
});

$dbPath = __DIR__ . '/../db/games.db';
if (!file_exists(dirname($dbPath))) {
    mkdir(dirname($dbPath), 0777, true);
}

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    $response = new \Slim\Psr7\Response();
    $response->getBody()->write(json_encode(['error' => 'Database connection failed']));
    return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
}

$pdo->exec("
    CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player TEXT NOT NULL DEFAULT 'Anonymous',
        word TEXT NOT NULL,
        won INTEGER DEFAULT 0,
        wrong INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
");

$pdo->exec("
    CREATE TABLE IF NOT EXISTS steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        letter TEXT NOT NULL,
        result TEXT NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    )
");

$pdo->exec("
    CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT UNIQUE NOT NULL
    )
");

$count = $pdo->query("SELECT COUNT(*) FROM words")->fetchColumn();
if ($count == 0) {
    $words = ["АВРОРА","ВОСТОК","ГИТАРА","ГРАДУС","ГРУСТЬ","ДЕНЬГИ",
             "ДЕРЕВО","ДОКТОР","ДОРОГА","ЖЕЛЕЗО","ЖУРНАЛ","ЗВЕЗДА",
             "КОСМОС","МОЛНИЯ","РАДУГА","СУМРАК","ТАЙНИК",
             "УЛЫБКА","ФОНТАН","ЦВЕТОК","ЮНОСТЬ","ЯБЛОКО","ЯНТАРЬ","БАНКЕТ"];
    $stmt = $pdo->prepare("INSERT OR IGNORE INTO words (word) VALUES (?)");
    foreach ($words as $word) {
        $stmt->execute([$word]);
    }
}

$app->get('/words/random', function(Request $request, Response $response) use ($pdo) {
    $stmt = $pdo->query("SELECT word FROM words ORDER BY RANDOM() LIMIT 1");
    $word = $stmt->fetchColumn();
    $response->getBody()->write(json_encode(['word' => $word]));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->get('/games', function(Request $request, Response $response) use ($pdo) {
    $stmt = $pdo->query("SELECT * FROM games ORDER BY id DESC");
    $games = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $response->getBody()->write(json_encode($games));
    return $response;
});

$app->get('/games/{id}', function(Request $request, Response $response, $args) use ($pdo) {
    $gameId = (int)$args['id'];
    
    $stmt = $pdo->prepare("SELECT * FROM games WHERE id = ?");
    $stmt->execute([$gameId]);
    $game = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$game) {
        $response->getBody()->write(json_encode(["error"=>"Game not found"]));
        return $response->withStatus(404);
    }
    
    $stmt = $pdo->prepare("SELECT * FROM steps WHERE game_id = ? ORDER BY id");
    $stmt->execute([$gameId]);
    $steps = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $response->getBody()->write(json_encode([
        'game' => $game,
        'steps' => $steps
    ]));
    return $response;
});

$app->post('/games', function(Request $request, Response $response) use ($pdo) {
    $data = $request->getParsedBody();
    if (!$data) {
        $response->getBody()->write(json_encode(["error"=>"Invalid JSON"]));
        return $response->withStatus(400);
    }

    $stmt = $pdo->prepare("INSERT INTO games (player, word, won, wrong, created_at) VALUES (?, ?, ?, ?, datetime('now'))");
    $stmt->execute([
        $data['player'] ?? 'Anonymous',
        $data['word'],
        $data['won'] ? 1 : 0,
        $data['wrong'] ?? 0
    ]);
    $gameId = $pdo->lastInsertId();

    foreach ($data['history'] ?? [] as $h) {
        $stmt2 = $pdo->prepare("INSERT INTO steps (game_id, letter, result) VALUES (?, ?, ?)");
        $stmt2->execute([$gameId, $h['letter'], $h['result']]);
    }

    $response->getBody()->write(json_encode(["id" => $gameId]));
    return $response;
});

$app->post('/step/{id}', function(Request $request, Response $response, $args) use ($pdo) {
    $data = $request->getParsedBody();

    if (!$data || !isset($data['letter']) || !isset($data['result'])) {
        $response->getBody()->write(json_encode(["error"=>"Invalid JSON"]));
        return $response->withStatus(400);
    }

    $stmt = $pdo->prepare("INSERT INTO steps (game_id, letter, result) VALUES (?, ?, ?)");
    $stmt->execute([(int)$args['id'], $data['letter'], $data['result']]);

    $response->getBody()->write(json_encode(["status"=>"ok"]));
    return $response;
});

$app->patch('/games/{id}', function(Request $request, Response $response, $args) use ($pdo) {
    $data = $request->getParsedBody();
    $gameId = (int)$args['id'];
    
    if (!$data) {
        $response->getBody()->write(json_encode(["error"=>"Invalid JSON"]));
        return $response->withStatus(400);
    }
    
    $updates = [];
    $params = [];
    
    if (isset($data['won'])) {
        $updates[] = 'won = ?';
        $params[] = $data['won'] ? 1 : 0;
    }
    
    if (isset($data['wrong'])) {
        $updates[] = 'wrong = ?';
        $params[] = (int)$data['wrong'];
    }
    
    if (empty($updates)) {
        $response->getBody()->write(json_encode(["error"=>"No fields to update"]));
        return $response->withStatus(400);
    }
    
    $params[] = $gameId;
    $sql = "UPDATE games SET " . implode(', ', $updates) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    $response->getBody()->write(json_encode(["status"=>"updated"]));
    return $response;
});

$app->delete('/games/{id}', function(Request $request, Response $response, $args) use ($pdo) {
    $gameId = (int)$args['id'];
    
    $stmt = $pdo->prepare("DELETE FROM games WHERE id = ?");
    $stmt->execute([$gameId]);
    
    $response->getBody()->write(json_encode(["status"=>"deleted"]));
    return $response;
});

$app->get('/search', function(Request $request, Response $response) use ($pdo) {
    $params = $request->getQueryParams();
    $player = $params['player'] ?? '';
    
    $stmt = $pdo->prepare("SELECT * FROM games WHERE player LIKE ? ORDER BY id DESC");
    $stmt->execute(['%' . $player . '%']);
    $games = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $response->getBody()->write(json_encode($games));
    return $response;
});

$app->get('/stats', function(Request $request, Response $response) use ($pdo) {
    $stats = $pdo->query("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN won = 0 THEN 1 ELSE 0 END) as losses,
            AVG(wrong) as avg_wrong
        FROM games
    ")->fetch(PDO::FETCH_ASSOC);
    
    $players = $pdo->query("
        SELECT 
            player,
            COUNT(*) as games,
            SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) as wins
        FROM games 
        GROUP BY player
        ORDER BY games DESC
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    $response->getBody()->write(json_encode([
        'stats' => $stats,
        'players' => $players
    ]));
    return $response;
});

$app->get('/', function (Request $request, Response $response) {
    $indexPath = __DIR__ . '/index.html';
    if (file_exists($indexPath)) {
        $response->getBody()->write(file_get_contents($indexPath));
        return $response->withHeader('Content-Type', 'text/html');
    }
    $response->getBody()->write("Page not found");
    return $response->withStatus(404);
});

$app->get('/{file}', function (Request $request, Response $response, $args) {
    $file = $args['file'];
    $ext = pathinfo($file, PATHINFO_EXTENSION);
    
    $allowed = ['css', 'js', 'png', 'jpg', 'ico'];
    if (in_array($ext, $allowed) && file_exists(__DIR__ . '/' . $file)) {
        $content = file_get_contents(__DIR__ . '/' . $file);
        $response->getBody()->write($content);
        
        $mime = [
            'css' => 'text/css',
            'js' => 'application/javascript',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'ico' => 'image/x-icon'
        ];
        
        if (isset($mime[$ext])) {
            return $response->withHeader('Content-Type', $mime[$ext]);
        }
        return $response;
    }
    
    return $response
        ->withHeader('Location', '/')
        ->withStatus(302);
});

$app->run();