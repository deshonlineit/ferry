<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class AdminUsersController
{
    private function guard(): void
    {
        Auth::requireLogin();
        Auth::requirePermission('admin_users.view');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
    }

    public function list(): array
    {
        $this->guard();
        $rows = Db::all("SELECT u.id,u.username,u.email,u.full_name,u.status,u.last_login,u.role_id,r.name AS role_name
                         FROM ft_admin_users u LEFT JOIN ft_admin_roles r ON r.id=u.role_id ORDER BY u.id DESC");
        return ['items' => $rows];
    }

    public function show(string $id): array
    {
        $this->guard();
        $u = Db::one("SELECT id,username,email,full_name,status,role_id FROM ft_admin_users WHERE id=?", [$id]);
        if (!$u) {
            throw new \Exception('User not found', 404);
        }
        return ['user' => $u];
    }

    public function create(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('admin_users.create');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $d = Input::all();
        $this->validate($d, true);
        if (Db::one("SELECT id FROM ft_admin_users WHERE username=? OR email=?", [$d['username'], $d['email']])) {
            throw new \Exception('Username or email already exists', 422);
        }
        if (!Auth::isSuperAdmin() && !empty($d['role_id'])) {
            throw new \Exception('Only super admin can assign roles', 403);
        }
        Db::pdo()->prepare("INSERT INTO ft_admin_users (username,email,password_hash,role_id,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
            ->execute([
                $d['username'], $d['email'], password_hash($d['password'], PASSWORD_BCRYPT),
                (int) ($d['role_id'] ?: 2), $d['full_name'] ?? null, $d['status'] ?? 'active',
                date('Y-m-d H:i:s'), date('Y-m-d H:i:s'),
            ]);
        $id = (int) Db::pdo()->lastInsertId();
        Auth::logActivity('create', 'admin_user', $id, ['username' => $d['username']]);
        return ['id' => $id, 'ok' => true];
    }

    public function update(string $id): array
    {
        Auth::requireLogin();
        Auth::requirePermission('admin_users.edit');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $u = Db::one("SELECT * FROM ft_admin_users WHERE id=?", [$id]);
        if (!$u) {
            throw new \Exception('User not found', 404);
        }
        $d = Input::all();
        $self = (int) (Auth::user()['id'] ?? 0) === (int) $id;
        if (!$self) {
            $this->guard();
        }
        if (!empty($d['role_id']) && (int) $d['role_id'] !== (int) $u['role_id']) {
            if (!Auth::isSuperAdmin()) {
                throw new \Exception('Only super admin can change roles', 403);
            }
            if ($u['role_id'] == 1 && !Auth::isSuperAdmin()) {
                throw new \Exception('Cannot modify a super admin', 403);
            }
        }
        $fields = [];
        $params = [];
        if (isset($d['email'])) { $fields[] = 'email=?'; $params[] = $d['email']; }
        if (isset($d['full_name'])) { $fields[] = 'full_name=?'; $params[] = $d['full_name']; }
        if (isset($d['username'])) { $fields[] = 'username=?'; $params[] = $d['username']; }
        if (isset($d['role_id'])) { $fields[] = 'role_id=?'; $params[] = (int) $d['role_id']; }
        if (isset($d['status'])) { $fields[] = 'status=?'; $params[] = $d['status']; }
        if (!empty($d['password'])) {
            if (strlen($d['password']) < 8) {
                throw new \Exception('Password must be at least 8 characters', 422);
            }
            $fields[] = 'password_hash=?';
            $params[] = password_hash($d['password'], PASSWORD_BCRYPT);
        }
        if ($fields) {
            $fields[] = 'updated_at=?';
            $params[] = date('Y-m-d H:i:s');
            $params[] = $id;
            Db::pdo()->prepare("UPDATE ft_admin_users SET " . implode(',', $fields) . " WHERE id=?")->execute($params);
            Auth::logActivity('edit', 'admin_user', (int) $id, ['fields' => array_keys($d)]);
        }
        return ['ok' => true];
    }

    public function toggleStatus(string $id): array
    {
        return $this->setStatus($id, null);
    }

    public function setStatus(string $id, ?string $status): array
    {
        Auth::requireLogin();
        Auth::requirePermission('admin_users.edit');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $u = Db::one("SELECT * FROM ft_admin_users WHERE id=?", [$id]);
        if (!$u) {
            throw new \Exception('User not found', 404);
        }
        if ($u['role_id'] == 1 && !Auth::isSuperAdmin()) {
            throw new \Exception('Cannot change status of a super admin', 403);
        }
        $new = $status ?? ($u['status'] === 'active' ? 'inactive' : 'active');
        Db::pdo()->prepare("UPDATE ft_admin_users SET status=?, updated_at=? WHERE id=?")
            ->execute([$new, date('Y-m-d H:i:s'), $id]);
        Auth::logActivity('status', 'admin_user', (int) $id, ['status' => $new]);
        return ['ok' => true, 'status' => $new];
    }

    public function delete(string $id): array
    {
        Auth::requireLogin();
        Auth::requirePermission('admin_users.delete');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $u = Db::one("SELECT * FROM ft_admin_users WHERE id=?", [$id]);
        if (!$u) {
            throw new \Exception('User not found', 404);
        }
        if ((int) (Auth::user()['id'] ?? 0) === (int) $id) {
            throw new \Exception('You cannot delete your own account', 422);
        }
        if ($u['role_id'] == 1 && !Auth::isSuperAdmin()) {
            throw new \Exception('Only super admin can delete super admin accounts', 403);
        }
        Db::pdo()->prepare("DELETE FROM ft_admin_users WHERE id=?")->execute([$id]);
        Auth::logActivity('delete', 'admin_user', (int) $id, ['username' => $u['username']]);
        return ['ok' => true];
    }

    private function validate(array $d, bool $create): void
    {
        foreach (['username', 'email', 'password'] as $f) {
            if (empty($d[$f])) {
                throw new \Exception("Field '$f' is required", 422);
            }
        }
        if (!filter_var($d['email'], FILTER_VALIDATE_EMAIL)) {
            throw new \Exception('Invalid email', 422);
        }
        if (strlen($d['password']) < 8) {
            throw new \Exception('Password must be at least 8 characters', 422);
        }
    }
}
