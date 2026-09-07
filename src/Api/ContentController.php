<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class ContentController
{
    public function contentList(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('content.view');
        $rows = Db::all("SELECT section_key,title,body,meta,updated_at FROM ft_site_content ORDER BY section_key");
        $out = [];
        foreach ($rows as $r) {
            $out[$r['section_key']] = $r;
        }
        return ['items' => $out];
    }

    public function contentUpdate(string $key): array
    {
        Auth::requireLogin();
        Auth::requirePermission('content.edit');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $d = Input::all();
        if (!Db::one("SELECT id FROM ft_site_content WHERE section_key=?", [$key])) {
            Db::pdo()->prepare("INSERT INTO ft_site_content (section_key,title,body,meta,updated_at) VALUES (?,?,?,?,?)")
                ->execute([$key, $d['title'] ?? null, $d['body'] ?? null, isset($d['meta']) ? json_encode($d['meta']) : null, date('Y-m-d H:i:s')]);
        } else {
            Db::pdo()->prepare("UPDATE ft_site_content SET title=?,body=?,meta=?,updated_at=? WHERE section_key=?")
                ->execute([$d['title'] ?? null, $d['body'] ?? null, isset($d['meta']) ? json_encode($d['meta']) : null, date('Y-m-d H:i:s'), $key]);
        }
        Auth::logActivity('edit', 'content', null, ['section' => $key]);
        return ['ok' => true];
    }

    public function settingsList(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('settings.view');
        $rows = Db::all("SELECT name,value FROM ft_site_settings");
        $out = [];
        foreach ($rows as $r) {
            $out[$r['name']] = $r['value'];
        }
        return ['items' => $out];
    }

    public function settingsUpdate(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('settings.edit');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $d = Input::all();
        foreach ($d as $k => $v) {
            if (is_array($v) || is_object($v)) {
                $v = json_encode($v);
            }
            if (Db::one("SELECT name FROM ft_site_settings WHERE name=?", [$k])) {
                Db::pdo()->prepare("UPDATE ft_site_settings SET value=? WHERE name=?")->execute([$v, $k]);
            } else {
                Db::pdo()->prepare("INSERT INTO ft_site_settings (name,value) VALUES (?,?)")->execute([$k, $v]);
            }
        }
        Auth::logActivity('edit', 'settings', null, ['keys' => array_keys($d)]);
        return ['ok' => true];
    }
}
