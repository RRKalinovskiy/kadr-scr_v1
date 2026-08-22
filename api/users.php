<?php
/** Список пользователей рабочего места (для раздела «Пользователи»). */

require_once __DIR__ . '/common.php';

$s = kadr_require_session();

$stmt = kadr_db()->prepare('SELECT * FROM kadr_users WHERE account_id = ? ORDER BY created_at');
$stmt->execute([$s['account_id']]);
$rows = $stmt->fetchAll();

kadr_json(['ok' => true, 'users' => array_map('kadr_public_user', $rows)]);
