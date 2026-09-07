<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class OrdersController
{
    public function list(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('orders.view');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $rows = Db::all("SELECT o.id,o.order_no,o.customer_id,o.status,o.total,o.currency,o.created_at,
                                (SELECT email FROM ft_customers c WHERE c.id=o.customer_id) AS customer_email
                         FROM ft_orders o ORDER BY o.created_at DESC LIMIT 100");
        return ['items' => $rows];
    }

    public function show(string $id): array
    {
        Auth::requireLogin();
        Auth::requirePermission('orders.view');
        $o = Db::one("SELECT * FROM ft_orders WHERE id=?", [$id]);
        if (!$o) {
            throw new \Exception('Order not found', 404);
        }
        $o['items'] = Db::all("SELECT * FROM ft_order_items WHERE order_id=?", [$id]);
        $o['history'] = Db::all("SELECT * FROM ft_order_status_history WHERE order_id=? ORDER BY created_at", [$id]);
        return ['order' => $o];
    }

    public function updateStatus(string $id): array
    {
        Auth::requireLogin();
        Auth::requirePermission('orders.edit');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $o = Db::one("SELECT id,status FROM ft_orders WHERE id=?", [$id]);
        if (!$o) {
            throw new \Exception('Order not found', 404);
        }
        $d = Input::all();
        $new = $d['status'] ?? '';
        if (!$new) {
            throw new \Exception('Status required', 422);
        }
        Db::pdo()->prepare("UPDATE ft_orders SET status=? WHERE id=?")->execute([$new, $id]);
        Db::pdo()->prepare("INSERT INTO ft_order_status_history (order_id,status,note,created_at) VALUES (?,?,?,?)")
            ->execute([$id, $new, $d['note'] ?? null, date('Y-m-d H:i:s')]);
        Auth::logActivity('status', 'order', (int) $id, ['status' => $new]);
        return ['ok' => true, 'status' => $new];
    }
}
