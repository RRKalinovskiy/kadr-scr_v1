<?php
/**
 * Отчёт CommonStatistic.GetReport.
 * Cookie берутся из БД (после SAP.Authenticate).
 *
 * POST { standId, standUrl, payload }
 *   payload — полный JSON-RPC { jsonrpc, protocol, method, params, id }
 *             или только params { Фильтр, Сортировка, Навигация, ДопПоля }.
 */

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/sbis.php';

$s = kadr_require_session();
$b = kadr_body();

$standId  = trim((string) ($b['standId'] ?? ''));
$standUrl = rtrim(trim((string) ($b['standUrl'] ?? '')), '/');
$payload  = $b['payload'] ?? null;

if ($standId === '' || $standUrl === '' || !is_array($payload)) {
    kadr_json(['ok' => false, 'error' => 'Не переданы стенд или тело GetReport'], 400);
}
if (!preg_match('#^https://#i', $standUrl)) {
    kadr_json(['ok' => false, 'error' => 'Допустим только https URL стенда'], 400);
}

$cookies = kadr_load_stand_cookies((string) $s['account_id'], $standId);
if ($cookies === '') {
    kadr_json(['ok' => false, 'error' => 'Нет сессии стенда. Сначала выполните синхронизацию (SAP.Authenticate).', 'needAuth' => true], 401);
}

if (!isset($payload['method'])) {
    $payload = [
        'jsonrpc'  => '2.0',
        'protocol' => 7,
        'method'   => 'CommonStatistic.GetReport',
        'params'   => $payload,
        'id'       => 1,
    ];
}
$payload['method'] = 'CommonStatistic.GetReport';
if (!isset($payload['jsonrpc'])) {
    $payload['jsonrpc'] = '2.0';
}
if (!isset($payload['protocol'])) {
    $payload['protocol'] = 7;
}
if (!isset($payload['id'])) {
    $payload['id'] = 1;
}

$url = $standUrl . '/stats-cloud-interface/service/?srv=1';
$rpc = kadr_sbis_rpc($url, $payload, $cookies, 'CommonStatistic.GetReport');

if ($rpc['error'] !== '') {
    kadr_json(['ok' => false, 'error' => 'Не удалось вызвать GetReport: ' . $rpc['error']], 502);
}

if (!$rpc['json']) {
    kadr_json([
        'ok'      => false,
        'error'   => 'GetReport вернул не-JSON (HTTP ' . $rpc['http'] . ')',
        'preview' => mb_substr($rpc['raw'], 0, 400),
    ], 502);
}

if ($rpc['cookies']) {
    $merged = array_merge(kadr_cookie_map_from_header($cookies), $rpc['cookies']);
    kadr_save_stand_session((string) $s['account_id'], $standId, $standUrl, kadr_cookie_header_from_map($merged));
}

$err = kadr_sbis_rpc_error($rpc['json']);
if ($err) {
    $needAuth = (stripos($err, 'сесс') !== false || stripos($err, 'auth') !== false
        || stripos($err, 'авториз') !== false || $rpc['http'] === 401);
    kadr_json(['ok' => false, 'error' => $err, 'needAuth' => $needAuth], $needAuth ? 401 : 502);
}

$table = $rpc['json'] ? kadr_parse_sbis_table($rpc['json']) : null;
if (!$table) {
    kadr_json([
        'ok'      => false,
        'error'   => 'Ответ GetReport не удалось разобрать в таблицу',
        'http'    => $rpc['http'],
        'preview' => mb_substr($rpc['raw'], 0, 400),
    ], 502);
}

kadr_json([
    'ok'      => true,
    'columns' => $table['columns'],
    'rows'    => $table['rows'],
]);
