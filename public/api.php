<?php
/**
 * API для обработки запросов аутентификации и работы с командами
 * Разместите этот файл в корне сайта на хостинге (рядом с index.html)
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Обработка preflight запроса
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Конфигурация БД
$config = [
    'db_host' => 'localhost',
    'db_name' => 'u3617849_default',
    'db_user' => 'u3617849_default',
    'db_pass' => '1S5Nrmf2tpvU5rlE'
];

try {
    $pdo = new PDO(
        "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4",
        $config['db_user'],
        $config['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка подключения к базе данных']);
    exit();
}

// Получение JSON тела запроса
$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'register_team':
            // Регистрация новой команды
            if (empty($input['teamName']) || empty($input['email']) || empty($input['password'])) {
                throw new Exception('Заполните все поля');
            }

            $stmt = $pdo->prepare("SELECT id FROM teams WHERE email = ?");
            $stmt->execute([$input['email']]);
            if ($stmt->fetch()) {
                throw new Exception('Команда с таким email уже существует');
            }

            $stmt = $pdo->prepare("INSERT INTO teams (name, email, password, created_at) VALUES (?, ?, ?, NOW())");
            $stmt->execute([
                $input['teamName'],
                $input['email'],
                password_hash($input['password'], PASSWORD_DEFAULT)
            ]);

            $teamId = $pdo->lastInsertId();
            
            // Создаем первого пользователя (админа команды)
            $stmt = $pdo->prepare("INSERT INTO users (team_id, email, password, role, created_at) VALUES (?, ?, ?, 'admin', NOW())");
            $stmt->execute([
                $teamId,
                $input['email'],
                password_hash($input['password'], PASSWORD_DEFAULT)
            ]);

            echo json_encode(['success' => true, 'message' => 'Команда создана успешно']);
            break;

        case 'login':
            // Вход в систему
            if (empty($input['email']) || empty($input['password'])) {
                throw new Exception('Введите email и пароль');
            }

            $stmt = $pdo->prepare("SELECT u.id, u.email, u.role, u.team_id, t.name as team_name 
                                   FROM users u 
                                   JOIN teams t ON u.team_id = t.id 
                                   WHERE u.email = ?");
            $stmt->execute([$input['email']]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user || !password_verify($input['password'], $user['password'] ?? '')) {
                // Пробуем найти по email команды (для админа при входе через email команды)
                $stmt = $pdo->prepare("SELECT id, name, password FROM teams WHERE email = ?");
                $stmt->execute([$input['email']]);
                $team = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($team && password_verify($input['password'], $team['password'])) {
                     // Если вошли как владелец команды напрямую
                     $user = [
                         'id' => $team['id'], // В данном контексте ID команды
                         'email' => $team['email'],
                         'role' => 'owner',
                         'team_id' => $team['id'],
                         'team_name' => $team['name']
                     ];
                } else {
                    throw new Exception('Неверный email или пароль');
                }
            }

            // Возвращаем данные пользователя (без пароля)
            unset($user['password']);
            echo json_encode(['success' => true, 'user' => $user]);
            break;

        default:
            throw new Exception('Неизвестное действие');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
