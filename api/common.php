<?php
/** Общие помощники: JSON-ввод/вывод, сессии, маппинг пользователя. */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

function kadr_body(): array
{
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function kadr_json($payload, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function kadr_token(): ?string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
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
    $expires = $now + ($cfg['session_ttl'] ?? 7 * 24 * 3600) * 1000;
    $stmt = kadr_db()->prepare(
        'INSERT INTO kadr_sessions (token, user_id, account_id, created_at, expires_at) VALUES (?,?,?,?,?)'
    );
    $stmt->execute([$token, $userId, $accountId, $now, $expires]);
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
