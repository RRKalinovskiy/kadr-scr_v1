<?php
/**
 * Диагностика подключения к БД.
 *
 * Откройте в браузере:  https://kadr-scr.ru/api/ping.php
 * Эндпоинт покажет пошагово, что именно не так: реквизиты, подключение,
 * наличие таблиц, и подскажет, если в пароле есть «ломающие» спецсимволы.
 *
 * Пароль при этом НЕ выводится — только его длина и наличие проблемных
 * символов (' и \), чтобы не раскрывать секрет.
 *
 * После успешной настройки файл можно оставить — он не мешает и не раскрывает
 * паролей, но при желании его можно удалить.
 */

require_once __DIR__ . '/common_header.php';

header('Content-Type: text/plain; charset=utf-8');

function line(string $s = ''): void { echo $s, "\n"; }

line('=== КАДР · диагностика БД ===');
line();

if (function_exists('opcache_invalidate')) {
    @opcache_invalidate(__DIR__ . '/config.php', true);
}
clearstatcache(true, __DIR__ . '/config.php');

$cfgFile = __DIR__ . '/config.php';
if (!is_file($cfgFile)) {
    line('[ОШИБКА] Файл api/config.php не найден на сервере.');
    line('         Убедитесь, что папка api/ целиком выложена в корень сайта.');
    exit;
}

$cfg = require $cfgFile;

line('1) Реквизиты из api/config.php:');
foreach (['db_host', 'db_name', 'db_user'] as $k) {
    line(sprintf('   %-8s = %s', $k, $cfg[$k] ?? '(не задан)'));
}
$pass = (string) ($cfg['db_pass'] ?? '');
line(sprintf('   db_pass  = %s (длина %d)', $pass === '' ? '(пусто)' : '***', strlen($pass)));
line();

$problems = [];
foreach (['db_host', 'db_name', 'db_user', 'db_pass'] as $k) {
    if (empty($cfg[$k]) || $cfg[$k] === 'CHANGE_ME') {
        $problems[] = $k;
    }
}
if ($problems) {
    line('[ОШИБКА] Не заполнены (или оставлены CHANGE_ME): ' . implode(', ', $problems));
    line('         Отредактируйте api/config.php и повторите.');
    exit;
}

if (strpos($pass, "'") !== false || strpos($pass, '\\') !== false) {
    line('[ВНИМАНИЕ] В пароле есть символы \' или \\.');
    line('           В одинарных кавычках их нужно экранировать: \' → \\\' и \\ → \\\\.');
    line('           Если подключение ниже упадёт с Access denied — почти наверняка дело в этом.');
    line('           Проще всего сменить пароль в панели reg.ru на буквенно-цифровой.');
    line();
}

line('2) Подключение к MySQL:');
$dsn = 'mysql:host=' . $cfg['db_host'] . ';dbname=' . $cfg['db_name'] . ';charset=utf8mb4';
try {
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE  => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT  => 5,
    ]);
    line('   [ОК] Соединение установлено.');
} catch (PDOException $e) {
    line('   [ОШИБКА] ' . $e->getMessage());
    line();
    line('   Возможные причины (по вероятности):');
    line('   a) Неверный пароль. Сбросьте его: reg.ru → Базы данных → Сменить пароль,');
    line('      затем впишите НОВЫЙ пароль в api/config.php.');
    line('   b) Неверные db_name / db_user. На reg.ru имя базы и имя пользователя');
    line('      совпадают и имеют вид u3617849_<имя>. Сверьте с панелью.');
    line('   c) Пароль со спецсимволами (см. предупреждение выше).');
    line('   d) Пользователь не привязан к базе: в панели reg.ru убедитесь, что');
    line('      пользователь имеет доступ именно к этой БД.');
    exit;
}

line();
line('3) Таблицы схемы:');
$required = ['kadr_accounts', 'kadr_users', 'kadr_sessions', 'kadr_account_state'];
$missing  = [];
foreach ($required as $t) {
    $stmt = $pdo->query('SHOW TABLES LIKE ' . $pdo->quote($t));
    if ($stmt->fetchColumn()) {
        line('   [ОК] ' . $t);
    } else {
        line('   [НЕТ] ' . $t);
        $missing[] = $t;
    }
}
if ($missing) {
    line();
    line('[ОШИБКА] Отсутствуют таблицы: ' . implode(', ', $missing));
    line('         Примените mysql/schema.sql: reg.ru → Базы данных → phpMyAdmin');
    line('         → выберите БД → вкладка SQL → вставьте файл → Вперёд.');
    exit;
}

line();
line('[ГОТОВО] БД настроена корректно — регистрация и вход должны работать.');
