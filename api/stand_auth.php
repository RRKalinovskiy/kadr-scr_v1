<?php
/**
 * Авторизация на стенде СБИС: SAP.Authenticate.
 * Cookie + логин/пароль (шифр.) сохраняются в kadr_stand_sessions на аккаунт.
 *
 * POST { standId, standUrl, login?, password? }
 *   — если password пустой, берётся сохранённый с аккаунта.
 * GET  ?standId=… — сессия + сохранённые credentials одного стенда
 * GET  без standId — список credentials по всем стендам аккаунта
 */

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/sbis.php';

$s = kadr_require_session();
$accountId = (string) $s['account_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $standId = (string) ($_GET['standId'] ?? '');
    if ($standId !== '') {
        $row = kadr_load_stand_row($accountId, $standId);
        $cookies = $row['cookies'] ?? '';
        $login = (string) ($row['login'] ?? '');
        $password = !empty($row['password_enc']) ? kadr_decrypt_secret((string) $row['password_enc']) : '';
        kadr_json([
            'ok'           => true,
            'hasSession'   => $cookies !== '',
            'cookiePreview'=> $cookies !== '' ? substr((string) $cookies, 0, 48) . '…' : null,
            'login'        => $login,
            'password'     => $password,
            'standUrl'     => (string) ($row['stand_url'] ?? ''),
            'updatedAt'    => isset($row['updated_at']) ? (int) $row['updated_at'] : null,
        ]);
    }

    $stands = [];
    foreach (kadr_list_stand_rows($accountId) as $row) {
        $stands[(string) $row['stand_id']] = [
            'hasSession' => !empty($row['cookies']),
            'login'      => (string) ($row['login'] ?? ''),
            'password'   => !empty($row['password_enc']) ? kadr_decrypt_secret((string) $row['password_enc']) : '',
            'standUrl'   => (string) ($row['stand_url'] ?? ''),
            'updatedAt'  => (int) ($row['updated_at'] ?? 0),
        ];
    }
    kadr_json(['ok' => true, 'stands' => $stands]);
}

$b        = kadr_body();
$standId  = trim((string) ($b['standId'] ?? ''));
$standUrl = rtrim(trim((string) ($b['standUrl'] ?? '')), '/');
$login    = trim((string) ($b['login'] ?? ''));
$password = (string) ($b['password'] ?? '');

if ($standId === '') {
    kadr_json(['ok' => false, 'error' => 'Не указан стенд'], 400);
}

$saved = kadr_load_stand_row($accountId, $standId);
if ($login === '' && $saved) {
    $login = trim((string) ($saved['login'] ?? ''));
}
if ($password === '' && $saved && !empty($saved['password_enc'])) {
    $password = kadr_decrypt_secret((string) $saved['password_enc']);
}
if ($standUrl === '' && $saved) {
    $standUrl = rtrim((string) ($saved['stand_url'] ?? ''), '/');
}

if ($standUrl === '' || $login === '' || $password === '') {
    kadr_json(['ok' => false, 'error' => 'Укажите URL стенда, логин и пароль (или сохраните их заранее)'], 400);
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
        [
            'mobile'           => false,
            'model'            => '',
            'platform'         => 'Windows',
            'platformVersion'  => '10.0.0',
            'fingerPrintData'  => $finger,
        ],
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

// Несколько форматов params — SBIS/Wasaby принимают разные сигнатуры
$payloads = [
    [
        'jsonrpc'  => '2.0',
        'protocol' => 4,
        'method'   => 'SAP.Authenticate',
        'params'   => [
            'login'    => $login,
            'password' => $password,
            'data'     => $dataRecord,
        ],
        'id' => 1,
    ],
    [
        'jsonrpc'  => '2.0',
        'protocol' => 4,
        'method'   => 'SAP.Authenticate',
        'params'   => ['data' => $dataRecord],
        'id' => 1,
    ],
    [
        'jsonrpc'  => '2.0',
        'protocol' => 4,
        'method'   => 'SAP.Authenticate',
        'params'   => [
            'login'    => $login,
            'password' => $password,
        ],
        'id' => 1,
    ],
];

// Публичный вход: *-online.sbis.ru (с reg.ru *-cloud.sbis.ru не резолвится).
// Целевой путь авторизации — /auth/service/
$urls = [];
foreach (kadr_stand_request_bases($standUrl) as $base) {
    $urls[] = $base . '/auth/service/';
    $urls[] = $base . '/auth/service/?srv=1';
}
$urls = array_values(array_unique($urls));

$lastErr = '';
$lastHttp = 0;
$lastPreview = '';
$cookies = [];
$okRpc = null;
$usedBase = kadr_stand_request_url($standUrl);

foreach ($urls as $url) {
    foreach ($payloads as $payload) {
        // full_url в data должен совпадать с хостом запроса
        if (preg_match('#^(https://[^/]+)#i', $url, $um)) {
            $payloadForUrl = $payload;
            if (isset($payloadForUrl['params']['data']['d'][6])) {
                $payloadForUrl['params']['data']['d'][6] = $um[1] . '/auth/?ret=%2F';
            }
        } else {
            $payloadForUrl = $payload;
        }

        $rpc = kadr_sbis_rpc($url, $payloadForUrl, '', 'SAP.Authenticate');
        $lastHttp = $rpc['http'];
        $lastPreview = mb_substr($rpc['raw'], 0, 280);

        if ($rpc['error'] !== '') {
            $lastErr = 'Сеть: ' . $rpc['error'];
            continue;
        }

        $err = kadr_sbis_rpc_error($rpc['json']);
        $found = array_merge($rpc['cookies'], kadr_cookies_from_auth_result($rpc['json']));

        if ($err && !$found) {
            $lastErr = $err;
            // явная ошибка логина — дальше не пробуем другие форматы
            if (stripos($err, 'парол') !== false || stripos($err, 'логин') !== false) {
                kadr_json(['ok' => false, 'error' => $err, 'http' => $lastHttp], 401);
            }
            continue;
        }

        if ($found) {
            $cookies = $found;
            $okRpc = $rpc;
            if (preg_match('#^(https://[^/]+)#i', $url, $um)) {
                $usedBase = $um[1];
            }
            break 2;
        }

        // Успешный JSON без cookie — считаем ошибкой формата
        if ($rpc['json'] && !$err) {
            $lastErr = 'Стенд ответил без cookie сессии (HTTP ' . $rpc['http'] . ')';
        } elseif (!$rpc['json']) {
            $lastErr = 'Не-JSON ответ стенда (HTTP ' . $rpc['http'] . ')';
        } else {
            $lastErr = $err ?: ('HTTP ' . $rpc['http']);
        }
    }
}

if (!$cookies) {
    kadr_json([
        'ok'      => false,
        'error'   => $lastErr ?: 'Не удалось авторизоваться на стенде',
        'http'    => $lastHttp,
        'preview' => $lastPreview,
    ], 401);
}

$header = kadr_cookie_header_from_map($cookies);
// В БД храним URL, с которого реально ходили (online), чтобы GetReport попал туда же
kadr_save_stand_session($accountId, $standId, $usedBase ?: $standUrl, $header, $login, $password);

kadr_json([
    'ok'            => true,
    'hasSession'    => true,
    'cookiePreview' => substr($header, 0, 48) . '…',
    'login'         => $login,
]);
