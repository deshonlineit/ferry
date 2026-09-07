<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class AdminDashboardController
{
    public function stats(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('dashboard.view');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        return [
            'products'   => (int) Db::col("SELECT COUNT(*) FROM ft_products WHERE status='publish'"),
            'low_stock'  => (int) Db::col("SELECT COUNT(*) FROM ft_products WHERE stock>0 AND stock<=5"),
            'out_of_stock' => (int) Db::col("SELECT COUNT(*) FROM ft_products WHERE stock_status='outofstock'"),
            'categories' => (int) Db::col("SELECT COUNT(*) FROM ft_categories"),
            'customers'  => (int) Db::col("SELECT COUNT(*) FROM ft_customers"),
            'pending_wholesale' => (int) Db::col("SELECT COUNT(*) FROM ft_customers WHERE wholesale_approved=0"),
            'orders'     => (int) Db::col("SELECT COUNT(*) FROM ft_orders"),
            'revenue'    => (float) Db::col("SELECT COALESCE(SUM(total),0) FROM ft_orders WHERE status IN ('completed','processing')"),
            'admins'     => (int) Db::col("SELECT COUNT(*) FROM ft_admin_users WHERE status='active'"),
        ];
    }
}
