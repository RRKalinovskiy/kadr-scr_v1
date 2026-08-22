<?php
/** Общие помощники: JSON-ввод/вывод, сессии, маппинг пользователя. */

require_once __DIR__ . '/common_header.php';
require_once __DIR__ . '/db.php';

function kadr_body(): array
{
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function kadr_token(): ?string
{
    // Проверяем стандартные заголовки Authorization
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    
    // Если заголовок не найден, пробуем получить токен из заголовка, 
    // переданного через RewriteRule (на некоторых хостингах Apache сбрасывает Authorization)
    if (!$h && isset($_SERVER['HTTP_X_AUTHORIZATION'])) {
        $h = $_SERVER['HTTP_X_AUTHORIZATION'];
    }
    
    // Также проверяем, если токен был передан через POST/GET параметр (резервный вариант)
    if (!$h) {
        $raw  = file_get_contents('php://input');
        $data = json_decode($raw ?: '{}', true);
        if (is_array($data) && isset($data['token']) && is_string($data['token'])) {
            return trim($data['token']);
        }
    }
    
    if (preg_match('/^Bearer\s+(.+)$/i', $h, $m)) {
        return trim($m[1]);
    }
    return null;
}

function kadr_session(): ?array
{
    $token = kadr_token();
    if (!$token) {
        return null;
    }
    $stmt = kadr_db()->prepare('SELECT * FROM kadr_sessions WHERE token = ? AND expires_at > ? LIMIT 1');
    $stmt->execute([$token, (int) (microtime(true) * 1000)]);
    $row = $stmt->fetch();
    
    if ($row) {
        // Продлеваем сессию при каждом обращении (активность)
        $cfg = require __DIR__ . '/config.php';
        $ttl = ($cfg['session_ttl'] ?? 7200) * 1000; // 2 часа по умолчанию в мс
        $now = (int) (microtime(true) * 1000);
        $newExpires = $now + $ttl;
        
        $update = kadr_db()->prepare('UPDATE kadr_sessions SET expires_at = ?, last_activity = ? WHERE token = ?');
        $update->execute([$newExpires, $now, $token]);
        
        $row['expires_at'] = $newExpires;
    }
    
    return $row ?: null;
}

function kadr_require_session(): array
{
    $s = kadr_session();
    if (!$s) {
        kadr_json(['ok' => false, 'error' => 'Сессия истекла, войдите заново'], 401);
    }
    return $s;
}

function kadr_create_session(string $userId, string $accountId): array
{
    $cfg     = require __DIR__ . '/config.php';
    $token   = bin2hex(random_bytes(32));
    $now     = (int) (microtime(true) * 1000);
    $ttl     = ($cfg['session_ttl'] ?? 7200); // 2 часа по умолчанию
    $expires = $now + ($ttl * 1000);
    
    $stmt = kadr_db()->prepare(
        'INSERT INTO kadr_sessions (token, user_id, account_id, created_at, expires_at, last_activity) VALUES (?,?,?,?,?,?)'
    );
    $stmt->execute([$token, $userId, $accountId, $now, $expires, $now]);
    
    return [
        'token'     => $token,
        'userId'    => $userId,
        'accountId' => $accountId,
        'createdAt' => $now,
        'expiresAt' => $expires,
    ];
}

function kadr_public_user(array $u): array
{
    return [
        'id'        => $u['id'],
        'accountId' => $u['account_id'],
        'name'      => $u['name'],
        'email'     => $u['email'],
    ];
}
