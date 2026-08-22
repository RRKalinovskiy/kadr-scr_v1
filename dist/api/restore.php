<?php
/** Восстановление сессии по токену (проверка при загрузке сайта). */

require_once __DIR__ . '/common.php';

$s = kadr_require_session();

$stmt = kadr_db()->prepare('SELECT * FROM kadr_users WHERE id = ? LIMIT 1');
$stmt->execute([$s['user_id']]);
$user = $stmt->fetch();

if (!$user) {
    kadr_json(['ok' => false, 'error' => 'Пользователь не найден'], 401);
}

kadr_json([
    'ok'      => true,
    'user'    => kadr_public_user($user),
    'session' => [
        'token'     => $s['token'],
        'userId'    => $s['user_id'],
        'accountId' => $s['account_id'],
        'createdAt' => (int) $s['created_at'],
        'expiresAt' => (int) $s['expires_at'],
    ],
]);
