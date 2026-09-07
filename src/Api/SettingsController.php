<?php
namespace App\Api;

use App\Core\Db;

class SettingsController
{
    public function list(): array
    {
        $rows = Db::all("SELECT name,value FROM ft_site_settings");
        $out = [];
        foreach ($rows as $r) {
            $out[$r['name']] = $r['value'];
        }
        return $out;
    }
}
