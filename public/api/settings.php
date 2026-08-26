<?php
/**
 * Настройки пользователя.
 * GET  — вернуть сохранённые настройки;
 * POST — сохранить (тело: { "settings": {...} }).
 */

require_once __DIR__ . '/common.php';

$s  = kadr_require_session();
$db = kadr_db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b        = kadr_body();
    $settings = $b['settings'] ?? null;
    if ($settings === null) {
        kadr_json(['ok' => false, 'error' => 'Не переданы настройки'], 400);
    }
    $json = json_encode($settings, JSON_UNESCAPED_UNICODE);
    $db->prepare(
        'INSERT INTO kadr_user_settings (account_id, settings, updated_at) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE settings = VALUES(settings), updated_at = VALUES(updated_at)'
    )->execute([$s['account_id'], $json, (int) (microtime(true) * 1000)]);
    kadr_json(['ok' => true]);
}

$stmt = $db->prepare('SELECT settings FROM kadr_user_settings WHERE account_id = ? LIMIT 1');
$stmt->execute([$s['account_id']]);
$row      = $stmt->fetch();
$settings = $row ? json_decode($row['settings'], true) : null;

kadr_json(['ok' => true, 'settings' => $settings]);
