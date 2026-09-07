<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class CustomersController
{
    public function list(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('customers.view');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $q = trim(Input::all()['q'] ?? '');
        $w = '';
        $params = [];
        if ($q !== '') {
            $w = 'WHERE email LIKE ? OR company LIKE ? OR vat_id LIKE ?';
            $params = ["%$q%", "%$q%", "%$q%"];
        }
        $total = (int) Db::col("SELECT COUNT(*) FROM ft_customers $w", $params);
        $rows = Db::all("SELECT id,email,company,vat_id,customer_group,wholesale_approved,created_at FROM ft_customers $w ORDER BY id DESC LIMIT 50", $params);
        return ['items' => $rows, 'total' => $total];
    }

    public function show(string $id): array
    {
        Auth::requireLogin();
        Auth::requirePermission('customers.view');
        $c = Db::one("SELECT * FROM ft_customers WHERE id=?", [$id]);
        if (!$c) {
            throw new \Exception('Customer not found', 404);
        }
        $c['addresses'] = Db::all("SELECT * FROM ft_addresses WHERE customer_id=?", [$id]);
        return ['customer' => $c];
    }

    public function update(string $id): array
    {
        Auth::requireLogin();
        Auth::requirePermission('customers.edit');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $c = Db::one("SELECT id FROM ft_customers WHERE id=?", [$id]);
        if (!$c) {
            throw new \Exception('Customer not found', 404);
        }
        $d = Input::all();
        $fields = [];
        $params = [];
        foreach (['company', 'vat_id', 'customer_group', 'wholesale_approved'] as $k) {
            if (isset($d[$k])) {
                $v = $d[$k];
                if ($k === 'wholesale_approved') {
                    $v = !empty($v) ? 1 : 0;
                }
                $fields[] = "$k=?";
                $params[] = $v;
            }
        }
        if ($fields) {
            $params[] = $id;
            Db::pdo()->prepare("UPDATE ft_customers SET " . implode(',', $fields) . " WHERE id=?")->execute($params);
            Auth::logActivity('edit', 'customer', (int) $id, ['fields' => array_keys($d)]);
        }
        return ['ok' => true];
    }

    public function approve(string $id): array
    {
        Auth::requireLogin();
        Auth::requirePermission('customers.edit');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        Db::pdo()->prepare("UPDATE ft_customers SET wholesale_approved=1 WHERE id=?")->execute([$id]);
        Auth::logActivity('approve', 'customer', (int) $id, []);
        return ['ok' => true];
    }
}
