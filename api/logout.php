<?php
/** Выход: удаляет токен сессии. */

require_once __DIR__ . '/common.php';

$token = kadr_token();
if ($token) {
    kadr_db()->prepare('DELETE FROM kadr_sessions WHERE token = ?')->execute([$token]);
}

kadr_json(['ok' => true]);
