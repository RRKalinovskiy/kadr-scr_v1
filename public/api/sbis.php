<?php
/** HTTP JSON-RPC к стендам СБИС (SAP.Authenticate / CommonStatistic.GetReport). */

function kadr_ensure_stand_sessions(): void
{
    kadr_db()->exec(
        'CREATE TABLE IF NOT EXISTS kadr_stand_sessions (
            account_id VARCHAR(64) NOT NULL,
            stand_id   VARCHAR(64) NOT NULL,
            cookies    TEXT        NOT NULL,
            updated_at BIGINT      NOT NULL,
            PRIMARY KEY (account_id, stand_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function kadr_cookie_map_from_header(string $header): array
{
    $map = [];
    if ($header === '') {
        return $map;
    }
    foreach (explode(';', $header) as $part) {
        $part = trim($part);
        if ($part === '' || strpos($part, '=') === false) {
            continue;
        }
        [$n, $v] = explode('=', $part, 2);
        $n = trim($n);
        if ($n === '' || strcasecmp($n, 'path') === 0 || strcasecmp($n, 'domain') === 0
            || strcasecmp($n, 'expires') === 0 || strcasecmp($n, 'max-age') === 0
            || strcasecmp($n, 'secure') === 0 || strcasecmp($n, 'httponly') === 0
            || strcasecmp($n, 'samesite') === 0) {
            continue;
        }
        $map[$n] = trim($v);
    }
    return $map;
}

function kadr_cookie_header_from_map(array $map): string
{
    $parts = [];
    foreach ($map as $k => $v) {
        if ($k === '') {
            continue;
        }
        $parts[] = $k . '=' . $v;
    }
    return implode('; ', $parts);
}

function kadr_parse_set_cookie_headers(array $headerLines): array
{
    $map = [];
    foreach ($headerLines as $line) {
        if (stripos($line, 'Set-Cookie:') !== 0) {
            continue;
        }
        $cookie = trim(substr($line, strlen('Set-Cookie:')));
        $pair   = explode(';', $cookie, 2)[0];
        if (strpos($pair, '=') === false) {
            continue;
        }
        [$n, $v] = explode('=', $pair, 2);
        $n = trim($n);
        if ($n !== '') {
            $map[$n] = trim($v);
        }
    }
    return $map;
}

/**
 * @return array{json:?array, cookies:array, http:int, error:string, raw:string}
 */
function kadr_sbis_rpc(string $url, array $payload, string $cookieHeader, string $calledMethod): array
{
    if (!function_exists('curl_init')) {
        return ['json' => null, 'cookies' => [], 'http' => 0, 'error' => 'На сервере не включён cURL', 'raw' => ''];
    }

    $headerLines = [];
    $headers     = [
        'Content-Type: application/json;charset=utf-8',
        'Accept: application/json, text/javascript, */*; q=0.01',
    ];
    if ($calledMethod !== '') {
        $headers[] = 'X-Called-Method: ' . $calledMethod;
    }
    if ($cookieHeader !== '') {
        $headers[] = 'Cookie: ' . $cookieHeader;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 90,
        CURLOPT_CONNECTTIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$headerLines): int {
            $headerLines[] = $line;
            return strlen($line);
        },
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($json)) {
        $json = null;
    }

    return [
        'json'    => $json,
        'cookies' => kadr_parse_set_cookie_headers($headerLines),
        'http'    => $http,
        'error'   => $err ?: '',
        'raw'     => is_string($raw) ? $raw : '',
    ];
}

function kadr_sbis_rpc_error(?array $json): ?string
{
    if (!$json) {
        return null;
    }
    if (isset($json['error'])) {
        $e = $json['error'];
        if (is_string($e)) {
            return $e;
        }
        if (is_array($e)) {
            return (string) ($e['message'] ?? $e['details'] ?? json_encode($e, JSON_UNESCAPED_UNICODE));
        }
    }
    $result = $json['result'] ?? null;
    if (is_array($result) && isset($result['message']) && is_string($result['message'])
        && (stripos($result['message'], 'парол') !== false || stripos($result['message'], 'логин') !== false)) {
        return $result['message'];
    }
    return null;
}

/** Находит самый большой recordset в ответе JSON-RPC. */
function kadr_parse_sbis_table($node, int $depth = 0): ?array
{
    if ($depth > 12 || !is_array($node)) {
        return null;
    }

    $best = null;
    if (isset($node['s'], $node['d']) && is_array($node['s']) && is_array($node['d'])) {
        $cols = [];
        foreach ($node['s'] as $f) {
            if (is_array($f) && isset($f['n']) && is_string($f['n'])) {
                $cols[] = $f['n'];
            }
        }
        if ($cols) {
            $type   = (string) ($node['_type'] ?? '');
            $first  = $node['d'][0] ?? null;
            $isRs   = $type === 'recordset';
            if ($type !== 'record' && $type !== 'recordset') {
                $isRs = is_array($first) && array_keys($first) === range(0, count($first) - 1);
            }
            $rows   = [];
            if ($isRs) {
                foreach ($node['d'] as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $obj = [];
                    foreach ($cols as $i => $name) {
                        $obj[$name] = $row[$i] ?? null;
                    }
                    $rows[] = $obj;
                }
            } else {
                $obj = [];
                foreach ($cols as $i => $name) {
                    $obj[$name] = $node['d'][$i] ?? null;
                }
                $rows[] = $obj;
            }
            $best = ['columns' => $cols, 'rows' => $rows];
        }
    }

    foreach ($node as $v) {
        if (!is_array($v)) {
            continue;
        }
        $found = kadr_parse_sbis_table($v, $depth + 1);
        if ($found && (!$best || count($found['rows']) > count($best['rows']))) {
            $best = $found;
        }
    }

    return $best;
}

function kadr_load_stand_cookies(string $accountId, string $standId): string
{
    kadr_ensure_stand_sessions();
    $stmt = kadr_db()->prepare(
        'SELECT cookies FROM kadr_stand_sessions WHERE account_id = ? AND stand_id = ? LIMIT 1'
    );
    $stmt->execute([$accountId, $standId]);
    $row = $stmt->fetch();
    return $row && isset($row['cookies']) ? (string) $row['cookies'] : '';
}

function kadr_save_stand_cookies(string $accountId, string $standId, string $cookies): void
{
    kadr_ensure_stand_sessions();
    $now = (int) (microtime(true) * 1000);
    kadr_db()->prepare(
        'INSERT INTO kadr_stand_sessions (account_id, stand_id, cookies, updated_at) VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE cookies = VALUES(cookies), updated_at = VALUES(updated_at)'
    )->execute([$accountId, $standId, $cookies, $now]);
}
