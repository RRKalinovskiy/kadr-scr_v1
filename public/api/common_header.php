<?php
/**
 * Минимальный общий модуль: JSON-заголовок и вывод ответа.
 * Не зависит от БД, поэтому его безопасно подключать из db.php,
 * чтобы ошибки подключения возвращались аккуратным JSON, а не сырым fatal.
 */

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

if (!function_exists('kadr_json')) {
    function kadr_json($payload, int $code = 200): void
    {
        http_response_code($code);
        echo json_encode($payload, JSON_UNESCAPED_UNICODE);
        exit;
    }
}
