<?php
/**
 * Управление командными тестами.
 * GET  — список всех тестов команды;
 * POST — создать/обновить тест;
 * DELETE — удалить тест.
 */

require_once __DIR__ . '/common.php';

$s = kadr_require_session();
$db = kadr_db();
$accountId = $s['account_id'];

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Возвращаем все тесты аккаунта
    $stmt = $db->prepare('SELECT * FROM kadr_team_tests WHERE account_id = ? ORDER BY created_at DESC');
    $stmt->execute([$accountId]);
    $rows = $stmt->fetchAll();
    
    $tests = array_map(function($row) {
        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'description' => $row['description'],
            'suite' => $row['suite'],
            'path' => $row['path'],
            'viewports' => json_decode($row['viewports'] ?? '[]', true),
            'assignee' => $row['assignee'],
            'tags' => json_decode($row['tags'] ?? '[]', true),
            'testType' => $row['test_type'],
            'pageUrl' => $row['page_url'],
            'steps' => json_decode($row['steps'] ?? '[]', true),
            'enabled' => (bool) $row['enabled'],
            'status' => $row['status'],
            'lastRun' => $row['last_run'],
            'durMs' => $row['dur_ms'],
            'diffPct' => (float) $row['diff_pct'],
            'baselineAt' => $row['baseline_at'],
            'history' => json_decode($row['history'] ?? '[]', true),
            'createdBy' => $row['created_by'],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
        ];
    }, $rows);
    
    kadr_json(['ok' => true, 'tests' => $tests]);
    exit;
}

if ($method === 'POST') {
    $body = kadr_body();
    
    $id = $body['id'] ?? null;
    $name = trim($body['name'] ?? '');
    
    if ($name === '') {
        kadr_json(['ok' => false, 'error' => 'Название теста обязательно'], 400);
    }
    
    $now = (int) (microtime(true) * 1000);
    
    if ($id) {
        // Обновление существующего теста
        $stmt = $db->prepare('SELECT id FROM kadr_team_tests WHERE id = ? AND account_id = ?');
        $stmt->execute([$id, $accountId]);
        if (!$stmt->fetch()) {
            kadr_json(['ok' => false, 'error' => 'Тест не найден'], 404);
        }
        
        $update = $db->prepare('
            UPDATE kadr_team_tests SET
                name = ?, description = ?, suite = ?, path = ?,
                viewports = ?, assignee = ?, tags = ?, test_type = ?,
                page_url = ?, steps = ?, enabled = ?, status = ?,
                last_run = ?, dur_ms = ?, diff_pct = ?, baseline_at = ?,
                history = ?, updated_at = ?
            WHERE id = ? AND account_id = ?
        ');
        
        $update->execute([
            $name,
            $body['description'] ?? null,
            $body['suite'] ?? '__root__',
            $body['path'] ?? '',
            json_encode($body['viewports'] ?? [], JSON_UNESCAPED_UNICODE),
            $body['assignee'] ?? null,
            json_encode($body['tags'] ?? [], JSON_UNESCAPED_UNICODE),
            $body['testType'] ?? 'auto',
            $body['pageUrl'] ?? null,
            json_encode($body['steps'] ?? [], JSON_UNESCAPED_UNICODE),
            isset($body['enabled']) ? ($body['enabled'] ? 1 : 0) : 1,
            $body['status'] ?? 'idle',
            $body['lastRun'] ?? null,
            $body['durMs'] ?? null,
            $body['diffPct'] ?? 0,
            $body['baselineAt'] ?? null,
            json_encode($body['history'] ?? [], JSON_UNESCAPED_UNICODE),
            $now,
            $id,
            $accountId,
        ]);
        
        kadr_json(['ok' => true, 'id' => $id]);
    } else {
        // Создание нового теста
        $newId = $body['id'] ?? bin2hex(random_bytes(8));
        
        $insert = $db->prepare('
            INSERT INTO kadr_team_tests (
                id, account_id, name, description, suite, path,
                viewports, assignee, tags, test_type, page_url, steps,
                enabled, status, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        
        $insert->execute([
            $newId,
            $accountId,
            $name,
            $body['description'] ?? null,
            $body['suite'] ?? '__root__',
            $body['path'] ?? '',
            json_encode($body['viewports'] ?? [], JSON_UNESCAPED_UNICODE),
            $body['assignee'] ?? null,
            json_encode($body['tags'] ?? [], JSON_UNESCAPED_UNICODE),
            $body['testType'] ?? 'auto',
            $body['pageUrl'] ?? null,
            json_encode($body['steps'] ?? [], JSON_UNESCAPED_UNICODE),
            isset($body['enabled']) ? ($body['enabled'] ? 1 : 0) : 1,
            $body['status'] ?? 'idle',
            $s['user_id'],
            $now,
            $now,
        ]);
        
        kadr_json(['ok' => true, 'id' => $newId]);
    }
    exit;
}

if ($method === 'DELETE') {
    $body = kadr_body();
    $id = $body['id'] ?? null;
    
    if (!$id) {
        kadr_json(['ok' => false, 'error' => 'Не указан ID теста'], 400);
    }
    
    $stmt = $db->prepare('DELETE FROM kadr_team_tests WHERE id = ? AND account_id = ?');
    $stmt->execute([$id, $accountId]);
    
    kadr_json(['ok' => true]);
    exit;
}

kadr_json(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
