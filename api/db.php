<?php
/**
 * Подключение к MySQL (PDO). Используется всеми эндпоинтами.
 *
 * При сбое подключения не роняет PHP с «сырой» ошибкой, а возвращает
 * аккуратный JSON — так сайт показывает понятное сообщение, а эндпоинт
 * api/ping.php может вывести детальную диагностику.
 */

require_once __DIR__ . '/common_header.php';

/** Пытается открыть PDO-соединение. Возвращает [PDO|null, string|null(ошибка)]. */
function kadr_db_try(): array
{
    // Сбрасываем opcache для config.php, чтобы правки реквизитов подхватывались
    // сразу, а не после истечения срока кеширования байткода.
    if (function_exists('opcache_invalidate')) {
        @opcache_invalidate(__DIR__ . '/config.php', true);
    }
    clearstatcache(true, __DIR__ . '/config.php');

    $cfg = require __DIR__ . '/config.php';

    $problems = [];
    foreach (['db_host', 'db_name', 'db_user', 'db_pass'] as $key) {
        if (empty($cfg[$key]) || $cfg[$key] === 'CHANGE_ME') {
            $problems[] = $key;
        }
    }
    if ($problems) {
        return [null, 'Не заполнены реквизиты в api/config.php: ' . implode(', ', $problems)];
    }

    $dsn = 'mysql:host=' . $cfg['db_host'] . ';dbname=' . $cfg['db_name'] . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_TIMEOUT            => 5,
        ]);
        return [$pdo, null];
    } catch (PDOException $e) {
        return [null, $e->getMessage()];
    }
}

/**
 * Возвращает готовый PDO. При ошибке подключения отвечает клиенту
 * понятным JSON (HTTP 500) и завершает скрипт.
 */
function kadr_db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    [$pdo, $err] = kadr_db_try();
    if ($pdo === null) {
        kadr_json([
            'ok'    => false,
            'error' => 'Не удалось подключиться к базе данных. Проверьте реквизиты в api/config.php. Детали: ' . $err,
        ], 500);
    }
    return $pdo;
}
