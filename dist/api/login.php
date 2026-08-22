<?php
/** Вход по email и паролю. */

require_once __DIR__ . '/common.php';

$b        = kadr_body();
$email    = strtolower(trim($b['email'] ?? ''));
$password = $b['password'] ?? '';

if ($email === '' || $password === '') {
    kadr_json(['ok' => false, 'error' => 'Введите email и пароль'], 400);
}

$db   = kadr_db();
$stmt = $db->prepare('SELECT * FROM kadr_users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    kadr_json(['ok' => false, 'error' => 'Неверный email или пароль'], 401);
}

$session = kadr_create_session($user['id'], $user['account_id']);

kadr_json([
    'ok'      => true,
    'user'    => kadr_public_user($user),
    'session' => $session,
]);
