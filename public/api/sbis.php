<?php
/** HTTP JSON-RPC к стендам СБИС (SAP.Authenticate / CommonStatistic.GetReport). */

function kadr_stand_secret(): string
{
    static $key = null;
    if ($key !== null) {
        return $key;
    }
    $cfg = require __DIR__ . '/config.php';
    $seed = (string) ($cfg['cred_secret'] ?? (($cfg['db_pass'] ?? '') . '|kadr-stand-v1|' . ($cfg['db_name'] ?? '')));
    $key = hash('sha256', $seed, true);
    return $key;
}

function kadr_encrypt_secret(string $plain): string
{
    $iv  = random_bytes(16);
    $raw = openssl_encrypt($plain, 'AES-256-CBC', kadr_stand_secret(), OPENSSL_RAW_DATA, $iv);
    if ($raw === false) {
        return '';
    }
    return base64_encode($iv . $raw);
}

function kadr_decrypt_secret(string $blob): string
{
    if ($blob === '') {
        return '';
    }
    $bin = base64_decode($blob, true);
    if ($bin === false || strlen($bin) < 17) {
        return '';
    }
    $iv  = substr($bin, 0, 16);
    $raw = substr($bin, 16);
    $out = openssl_decrypt($raw, 'AES-256-CBC', kadr_stand_secret(), OPENSSL_RAW_DATA, $iv);
    return is_string($out) ? $out : '';
}

function kadr_ensure_stand_sessions(): void
{
    $db = kadr_db();
    $db->exec(
        'CREATE TABLE IF NOT EXISTS kadr_stand_sessions (
            account_id   VARCHAR(64)  NOT NULL,
            stand_id     VARCHAR(64)  NOT NULL,
            stand_url    VARCHAR(512) NOT NULL DEFAULT \'\',
            cookies      TEXT         NOT NULL,
            login        VARCHAR(255) NOT NULL DEFAULT \'\',
            password_enc TEXT         NULL,
            updated_at   BIGINT       NOT NULL,
            PRIMARY KEY (account_id, stand_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    // Миграция колонок для уже существующих таблиц
    $cols = [];
    try {
        $stmt = $db->query('SHOW COLUMNS FROM kadr_stand_sessions');
        foreach ($stmt->fetchAll() as $row) {
            $cols[strtolower((string) $row['Field'])] = true;
        }
    } catch (Throwable $e) {
        return;
    }
    if (!isset($cols['stand_url'])) {
        $db->exec("ALTER TABLE kadr_stand_sessions ADD COLUMN stand_url VARCHAR(512) NOT NULL DEFAULT '' AFTER stand_id");
    }
    if (!isset($cols['login'])) {
        $db->exec("ALTER TABLE kadr_stand_sessions ADD COLUMN login VARCHAR(255) NOT NULL DEFAULT '' AFTER cookies");
    }
    if (!isset($cols['password_enc'])) {
        $db->exec('ALTER TABLE kadr_stand_sessions ADD COLUMN password_enc TEXT NULL AFTER login');
    }
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

/** Достаёт session-cookie из cookie-jar Netscape / CURLINFO_COOKIELIST. */
function kadr_cookies_from_jar_lines(array $lines): array
{
    $map = [];
    foreach ($lines as $line) {
        $line = trim((string) $line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        $parts = preg_split('/\t+/', $line);
        if (!$parts || count($parts) < 7) {
            continue;
        }
        $name  = $parts[5];
        $value = $parts[6];
        if ($name !== '') {
            $map[$name] = $value;
        }
    }
    return $map;
}

/** Ищет sid/session в JSON-ответе SAP.Authenticate. */
function kadr_cookies_from_auth_result(?array $json): array
{
    if (!$json || !isset($json['result'])) {
        return [];
    }
    $map = [];
    $walk = static function ($node) use (&$walk, &$map): void {
        if (!is_array($node)) {
            return;
        }
        foreach (['sid', 'SID', 'session_id', 'SessionId', 's3cid', 'cid'] as $k) {
            if (isset($node[$k]) && is_scalar($node[$k]) && (string) $node[$k] !== '') {
                $map[strtolower((string) $k) === 'sessionid' ? 'sid' : (string) $k] = (string) $node[$k];
            }
        }
        // record d/s
        if (isset($node['s'], $node['d']) && is_array($node['s']) && is_array($node['d'])) {
            foreach ($node['s'] as $i => $f) {
                $n = is_array($f) ? (string) ($f['n'] ?? '') : '';
                if ($n !== '' && preg_match('/sid|session|cookie/i', $n) && isset($node['d'][$i]) && is_scalar($node['d'][$i])) {
                    $map[$n] = (string) $node['d'][$i];
                }
            }
        }
        foreach ($node as $v) {
            if (is_array($v)) {
                $walk($v);
            }
        }
    };
    $walk($json['result']);
    // Нормализуем: если нашли sid под другим именем
    if (!isset($map['sid'])) {
        foreach ($map as $k => $v) {
            if (stripos($k, 'sid') !== false) {
                $map['sid'] = $v;
                break;
            }
        }
    }
    return $map;
}

/**
 * Публичный hostname стенда для запросов с внешнего хостинга (reg.ru).
 * `*-cloud.sbis.ru` резолвится только во внутренней DNS Tensor → PHP на reg.ru
 * получает "Could not resolve host". Публичный вход — `*-online.sbis.ru`
 * (тот же auth/service и stats-cloud-interface).
 */
function kadr_stand_request_url(string $standUrl): string
{
    $standUrl = rtrim(trim($standUrl), '/');
    $count = 0;
    $mapped = preg_replace(
        '#^(https://)([a-z0-9-]+)-cloud(\.sbis\.ru)$#i',
        '$1$2-online$3',
        $standUrl,
        1,
        $count
    );
    return ($count > 0 && is_string($mapped)) ? $mapped : $standUrl;
}

/** Базы URL для RPC: сначала online (доступен снаружи), затем исходный. */
function kadr_stand_request_bases(string $standUrl): array
{
    $orig = rtrim(trim($standUrl), '/');
    $pub  = kadr_stand_request_url($orig);
    $bases = [];
    if ($pub !== '') {
        $bases[] = $pub;
    }
    if ($orig !== '' && $orig !== $pub) {
        $bases[] = $orig;
    }
    return $bases;
}

function kadr_sbis_dns_hint(string $error, string $url): string
{
    if ($error === '' || !preg_match('/could not resolve host|name or service not known|getaddrinfo/i', $error)) {
        return $error;
    }
    $host = parse_url($url, PHP_URL_HOST) ?: '';
    if ($host !== '' && preg_match('/-cloud\.sbis\.ru$/i', $host)) {
        $online = preg_replace('/-cloud\.sbis\.ru$/i', '-online.sbis.ru', $host);
        return $error . '. Хост ' . $host . ' недоступен с внешнего DNS; используйте https://' . $online . '/';
    }
    return $error . '. Стенд недоступен с сервера КАДР (нужен публичный *-online.sbis.ru или хост внутри сети Tensor).';
}

/**
 * @return array{json:?array, cookies:array, http:int, error:string, raw:string}
 */
function kadr_sbis_rpc(string $url, array $payload, string $cookieHeader, string $calledMethod): array
{
    if (!function_exists('curl_init')) {
        return ['json' => null, 'cookies' => [], 'http' => 0, 'error' => 'На сервере не включён cURL', 'raw' => ''];
    }

    $jar = tempnam(sys_get_temp_dir(), 'kadrck');
    if ($jar === false) {
        $jar = sys_get_temp_dir() . '/kadr_cookie_' . uniqid('', true);
    }

    $headerLines = [];
    $headers     = [
        'Content-Type: application/json;charset=utf-8',
        'Accept: application/json, text/javascript, */*; q=0.01',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ];
    if (preg_match('#^(https?://[^/]+)#i', $url, $m)) {
        $headers[] = 'Origin: ' . $m[1];
        $headers[] = 'Referer: ' . $m[1] . '/';
    }
    if ($calledMethod !== '') {
        // Wasaby/SBIS принимают оба варианта заголовка
        $headers[] = 'X-CalledMethod: ' . $calledMethod;
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
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => 90,
        CURLOPT_CONNECTTIMEOUT => 25,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_COOKIEJAR      => $jar,
        CURLOPT_COOKIEFILE     => $jar,
        CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$headerLines): int {
            $headerLines[] = $line;
            return strlen($line);
        },
    ]);
    $raw  = curl_exec($ch);
    $err  = curl_error($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $jarLines = [];
    if (defined('CURLINFO_COOKIELIST')) {
        $list = curl_getinfo($ch, CURLINFO_COOKIELIST);
        if (is_array($list)) {
            $jarLines = $list;
        }
    }
    curl_close($ch);

    $json = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($json)) {
        $json = null;
    }

    $cookies = array_merge(
        kadr_parse_set_cookie_headers($headerLines),
        kadr_cookies_from_jar_lines($jarLines)
    );
    if (is_file($jar)) {
        $fileLines = @file($jar, FILE_IGNORE_NEW_LINES) ?: [];
        $cookies = array_merge($cookies, kadr_cookies_from_jar_lines($fileLines));
        @unlink($jar);
    }

    $errMsg = $err ?: '';
    if ($errMsg !== '') {
        $errMsg = kadr_sbis_dns_hint($errMsg, $url);
    }

    return [
        'json'    => $json,
        'cookies' => $cookies,
        'http'    => $http,
        'error'   => $errMsg,
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
            return (string) ($e['message'] ?? $e['details'] ?? $e['string'] ?? json_encode($e, JSON_UNESCAPED_UNICODE));
        }
    }
    $result = $json['result'] ?? null;
    if (is_array($result) && isset($result['message']) && is_string($result['message'])
        && (stripos($result['message'], 'парол') !== false || stripos($result['message'], 'логин') !== false
            || stripos($result['message'], 'ошибк') !== false)) {
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

function kadr_load_stand_row(string $accountId, string $standId): ?array
{
    kadr_ensure_stand_sessions();
    $stmt = kadr_db()->prepare(
        'SELECT * FROM kadr_stand_sessions WHERE account_id = ? AND stand_id = ? LIMIT 1'
    );
    $stmt->execute([$accountId, $standId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function kadr_load_stand_cookies(string $accountId, string $standId): string
{
    $row = kadr_load_stand_row($accountId, $standId);
    return $row && isset($row['cookies']) ? (string) $row['cookies'] : '';
}

function kadr_list_stand_rows(string $accountId): array
{
    kadr_ensure_stand_sessions();
    $stmt = kadr_db()->prepare('SELECT * FROM kadr_stand_sessions WHERE account_id = ?');
    $stmt->execute([$accountId]);
    return $stmt->fetchAll() ?: [];
}

function kadr_account_creds_stand_id(): string
{
    return '__account__';
}

/** Сохраняет login/password на аккаунт, не затирая cookie-сессию стенда. */
function kadr_save_stand_credentials(
    string $accountId,
    string $standId,
    string $standUrl,
    string $login,
    string $password
): void {
    $existing = kadr_load_stand_row($accountId, $standId);
    $cookies = $existing ? (string) ($existing['cookies'] ?? '') : '';
    kadr_save_stand_session($accountId, $standId, $standUrl, $cookies, $login, $password);
}

function kadr_save_stand_session(
    string $accountId,
    string $standId,
    string $standUrl,
    string $cookies,
    string $login = '',
    string $password = ''
): void {
    kadr_ensure_stand_sessions();
    $now = (int) (microtime(true) * 1000);
    $enc = $password !== '' ? kadr_encrypt_secret($password) : null;

    $existing = kadr_load_stand_row($accountId, $standId);
    if ($enc === null && $existing && !empty($existing['password_enc'])) {
        $enc = (string) $existing['password_enc'];
    }
    if ($login === '' && $existing) {
        $login = (string) ($existing['login'] ?? '');
    }
    if ($standUrl === '' && $existing) {
        $standUrl = (string) ($existing['stand_url'] ?? '');
    }
    if ($cookies === '' && $existing) {
        $cookies = (string) ($existing['cookies'] ?? '');
    }

    kadr_db()->prepare(
        'INSERT INTO kadr_stand_sessions (account_id, stand_id, stand_url, cookies, login, password_enc, updated_at)
         VALUES (?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           stand_url = VALUES(stand_url),
           cookies = VALUES(cookies),
           login = VALUES(login),
           password_enc = VALUES(password_enc),
           updated_at = VALUES(updated_at)'
    )->execute([$accountId, $standId, $standUrl, $cookies, $login, $enc, $now]);
}

/** @deprecated use kadr_save_stand_session */
function kadr_save_stand_cookies(string $accountId, string $standId, string $cookies): void
{
    kadr_save_stand_session($accountId, $standId, '', $cookies);
}
