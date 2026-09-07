<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class ActivityController
{
    public function list(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('activity.view');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $rows = Db::all("SELECT l.id,l.action,l.entity,l.entity_id,l.detail,l.created_at,u.username
                         FROM ft_admin_activity_log l LEFT JOIN ft_admin_users u ON u.id=l.admin_user_id
                         ORDER BY l.id DESC LIMIT 100");
        return ['items' => $rows];
    }
}
