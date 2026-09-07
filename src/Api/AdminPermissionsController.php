<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class AdminPermissionsController
{
    public function list(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('roles.view');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $rows = Db::all("SELECT id,pkey,name,pgroup FROM ft_admin_permissions ORDER BY pgroup, id");
        $grouped = [];
        foreach ($rows as $r) {
            $grouped[$r['pgroup']][] = $r;
        }
        return ['items' => $grouped];
    }
}
