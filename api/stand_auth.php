<?php
/**
 * Авторизация на стенде СБИС: SAP.Authenticate.
 * Cookie сессии стенда сохраняются в БД (kadr_stand_sessions) и затем
 * используются для CommonStatistic.GetReport.
 *
 * POST { standId, standUrl, login, password }
 * GET  { standId } — есть ли сохранённая cookie-сессия.
 */

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/sbis.php';

$s = kadr_require_session();
$accountId = (string) $s['account_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $standId = (string) ($_GET['standId'] ?? '');
    if ($standId === '') {
        kadr_json(['ok' => false, 'error' => 'Не указан стенд'], 400);
    }
    $cookies = kadr_load_stand_cookies($accountId, $standId);
    kadr_json(['ok' => true, 'hasSession' => $cookies !== '', 'cookiePreview' => $cookies !== '' ? substr($cookies, 0, 48) . '…' : null]);
}

$b        = kadr_body();
$standId  = trim((string) ($b['standId'] ?? ''));
$standUrl = rtrim(trim((string) ($b['standUrl'] ?? '')), '/');
$login    = trim((string) ($b['login'] ?? ''));
$password = (string) ($b['password'] ?? '');

if ($standId === '' || $standUrl === '' || $login === '' || $password === '') {
    kadr_json(['ok' => false, 'error' => 'Укажите стенд, логин и пароль'], 400);
}
if (!preg_match('#^https://#i', $standUrl)) {
    kadr_json(['ok' => false, 'error' => 'Допустим только https URL стенда'], 400);
}

$finger = [
    'Language'          => 'ru-RU',
    'ScreenResolution'  => '1920;1080',
    'TimeZone'          => 'Europe/Moscow',
    'NavigatorPlatform' => 'Win32',
    'MaxTouchPoints'    => 0,
    'Temp'              => 'UserAgentData',
    'DeviceModel'       => 'windows pc',
    'Platform'          => 'Windows',
    'OsVersion'         => 'Windows: 10.0.0',
];

$dataRecord = [
    'd' => [
        $login,
        $password,
        false,
        true,
        false,
        null,
        $standUrl . '/auth/?ret=%2F',
        false,
        ['mobile' => false, 'model' => '', 'platform' => 'Windows', 'platformVersion' => '10.0.0', 'fingerPrintData' => $finger],
        $finger,
    ],
    's' => [
        ['t' => 'Строка', 'n' => 'login'],
        ['t' => 'Строка', 'n' => 'password'],
        ['t' => 'Логическое', 'n' => 'stranger'],
        ['t' => 'Логическое', 'n' => 'from_browser'],
        ['t' => 'Логическое', 'n' => 'license_extended'],
        ['t' => 'Строка', 'n' => 'license_session_id'],
        ['t' => 'Строка', 'n' => 'full_url'],
        ['t' => 'Логическое', 'n' => 'get_last_url'],
        ['t' => 'JSON-объект', 'n' => 'browser_data'],
        ['t' => 'JSON-объект', 'n' => 'device_fingerprint_data'],
    ],
    '_type' => 'record',
    'f' => 0,
];

$payload = [
    'jsonrpc'  => '2.0',
    'protocol' => 4,
    'method'   => 'SAP.Authenticate',
    'params'   => [
        'login'    => $login,
        'password' => $password,
        'data'     => $dataRecord,
    ],
    'id' => 1,
];

$url = $standUrl . '/auth/service/?srv=1';
$rpc = kadr_sbis_rpc($url, $payload, '', 'SAP.Authenticate');

if ($rpc['error'] !== '') {
    kadr_json(['ok' => false, 'error' => 'Не удалось связаться со стендом: ' . $rpc['error']], 502);
}

$err = kadr_sbis_rpc_error($rpc['json']);
$cookies = $rpc['cookies'];
if ($err && !$cookies) {
    kadr_json(['ok' => false, 'error' => $err], 401);
}

if (!$cookies) {
    kadr_json(['ok' => false, 'error' => $err ?: 'Стенд не вернул cookie сессии. Проверьте логин/пароль и доступность /auth/service/'], 401);
}

$header = kadr_cookie_header_from_map($cookies);
kadr_save_stand_cookies($accountId, $standId, $header);

kadr_json([
    'ok'           => true,
    'hasSession'   => true,
    'cookiePreview'=> substr($header, 0, 48) . '…',
]);
