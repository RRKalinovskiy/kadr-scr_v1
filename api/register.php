<?php
/** Регистрация: создаёт рабочее место, пользователя и стартовое состояние. */

require_once __DIR__ . '/common.php';

$b        = kadr_body();
$name     = trim($b['name'] ?? '');
$email    = strtolower(trim($b['email'] ?? ''));
$password = $b['password'] ?? '';

if ($name === '') {
    kadr_json(['ok' => false, 'error' => 'Укажите имя'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    kadr_json(['ok' => false, 'error' => 'Некорректный email'], 400);
}
if (strlen($password) < 6) {
    kadr_json(['ok' => false, 'error' => 'Пароль должен быть не короче 6 символов'], 400);
}

$db  = kadr_db();
$chk = $db->prepare('SELECT id FROM kadr_users WHERE email = ? LIMIT 1');
$chk->execute([$email]);
if ($chk->fetch()) {
    kadr_json(['ok' => false, 'error' => 'Пользователь с таким email уже зарегистрирован'], 409);
}

$userId    = bin2hex(random_bytes(8));
$accountId = bin2hex(random_bytes(8));
$now       = (int) (microtime(true) * 1000);
$hash      = password_hash($password, PASSWORD_DEFAULT);

$db->prepare('INSERT INTO kadr_accounts (id, name, plan, created_at) VALUES (?,?,?,?)')
    ->execute([$accountId, $name . ' · рабочее место', 'team', $now]);
$db->prepare('INSERT INTO kadr_users (id, account_id, name, email, password_hash, created_at) VALUES (?,?,?,?,?,?)')
    ->execute([$userId, $accountId, $name, $email, $hash, $now]);
$db->prepare('INSERT INTO kadr_account_state (account_id, state, updated_at) VALUES (?,?,?)')
    ->execute([$accountId, '{}', $now]);

$session = kadr_create_session($userId, $accountId);

kadr_json([
    'ok'      => true,
    'user'    => ['id' => $userId, 'accountId' => $accountId, 'name' => $name, 'email' => $email],
    'session' => $session,
]);
