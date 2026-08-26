<?php
/**
 * Состояние рабочего места (коллекции, тесты, настройки).
 * GET  — вернуть сохранённое состояние;
 * POST — сохранить переданное состояние (тело: { "state": {...} }).
 */

require_once __DIR__ . '/common.php';

$s  = kadr_require_session();
$db = kadr_db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b     = kadr_body();
    $state = $b['state'] ?? null;
    if ($state === null) {
        kadr_json(['ok' => false, 'error' => 'Не передано состояние'], 400);
    }
    $json = json_encode($state, JSON_UNESCAPED_UNICODE);
    $db->prepare(
        'INSERT INTO kadr_account_state (account_id, state, updated_at) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE state = VALUES(state), updated_at = VALUES(updated_at)'
    )->execute([$s['account_id'], $json, (int) (microtime(true) * 1000)]);
    kadr_json(['ok' => true]);
}

$stmt = $db->prepare('SELECT state FROM kadr_account_state WHERE account_id = ? LIMIT 1');
$stmt->execute([$s['account_id']]);
$row   = $stmt->fetch();
$state = $row ? json_decode($row['state'], true) : null;

kadr_json(['ok' => true, 'state' => $state]);
