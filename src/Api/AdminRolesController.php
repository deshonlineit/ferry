<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class AdminRolesController
{
    private function guardView(): void
    {
        Auth::requireLogin();
        Auth::requirePermission('roles.view');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
    }

    private function guardMutate(): void
    {
        Auth::requireLogin();
        Auth::requirePermission('roles.edit');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
    }

    public function list(): array
    {
        $this->guardView();
        $rows = Db::all("SELECT r.id,r.name,r.slug,r.description,r.status,
                            (SELECT COUNT(*) FROM ft_admin_users u WHERE u.role_id=r.id) AS user_count
                         FROM ft_admin_roles r ORDER BY r.id");
        return ['items' => $rows];
    }

    public function show(string $id): array
    {
        $this->guardView();
        $r = Db::one("SELECT id,name,slug,description,status FROM ft_admin_roles WHERE id=?", [$id]);
        if (!$r) {
            throw new \Exception('Role not found', 404);
        }
        $perms = Db::all("SELECT p.id,p.pkey,p.name,p.pgroup FROM ft_role_permissions rp JOIN ft_admin_permissions p ON p.id=rp.permission_id WHERE rp.role_id=?", [$id]);
        $r['permissions'] = $perms;
        return ['role' => $r];
    }

    public function create(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('roles.create');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $d = Input::all();
        if (empty($d['name']) || empty($d['slug'])) {
            throw new \Exception('Name and slug are required', 422);
        }
        $slug = preg_replace('/[^a-z0-9_]/', '_', strtolower($d['slug']));
        if (Db::one("SELECT id FROM ft_admin_roles WHERE slug=? OR name=?", [$slug, $d['name']])) {
            throw new \Exception('Role name or slug already exists', 422);
        }
        Db::pdo()->prepare("INSERT INTO ft_admin_roles (name,slug,description,status,created_at) VALUES (?,?,?,?,?)")
            ->execute([$d['name'], $slug, $d['description'] ?? null, $d['status'] ?? 'active', date('Y-m-d H:i:s')]);
        $id = (int) Db::pdo()->lastInsertId();
        Auth::logActivity('create', 'role', $id, ['name' => $d['name']]);
        return ['id' => $id, 'ok' => true];
    }

    public function update(string $id): array
    {
        $this->guardMutate();
        $r = Db::one("SELECT * FROM ft_admin_roles WHERE id=?", [$id]);
        if (!$r) {
            throw new \Exception('Role not found', 404);
        }
        $d = Input::all();
        $fields = [];
        $params = [];
        if (isset($d['name'])) { $fields[] = 'name=?'; $params[] = $d['name']; }
        if (isset($d['description'])) { $fields[] = 'description=?'; $params[] = $d['description']; }
        if (isset($d['status'])) { $fields[] = 'status=?'; $params[] = $d['status']; }
        if ($fields) {
            $params[] = $id;
            Db::pdo()->prepare("UPDATE ft_admin_roles SET " . implode(',', $fields) . " WHERE id=?")->execute($params);
            Auth::logActivity('edit', 'role', (int) $id, ['fields' => array_keys($d)]);
        }
        return ['ok' => true];
    }

    public function delete(string $id): array
    {
        Auth::requireLogin();
        Auth::requirePermission('roles.delete');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $r = Db::one("SELECT * FROM ft_admin_roles WHERE id=?", [$id]);
        if (!$r) {
            throw new \Exception('Role not found', 404);
        }
        if ((int) Db::col("SELECT COUNT(*) FROM ft_admin_users WHERE role_id=?", [$id]) > 0) {
            throw new \Exception('Cannot delete role with assigned users', 422);
        }
        Db::pdo()->prepare("DELETE FROM ft_role_permissions WHERE role_id=?")->execute([$id]);
        Db::pdo()->prepare("DELETE FROM ft_admin_roles WHERE id=?")->execute([$id]);
        Auth::logActivity('delete', 'role', (int) $id, ['name' => $r['name']]);
        return ['ok' => true];
    }

    public function assignPermission(string $id): array
    {
        $this->guardMutate();
        $d = Input::all();
        $permId = (int) ($d['permission_id'] ?? 0);
        if (!$permId || !Db::one("SELECT id FROM ft_admin_permissions WHERE id=?", [$permId])) {
            throw new \Exception('Valid permission_id required', 422);
        }
        if (!Db::one("SELECT id FROM ft_admin_roles WHERE id=?", [$id])) {
            throw new \Exception('Role not found', 404);
        }
        Db::pdo()->prepare("INSERT IGNORE INTO ft_role_permissions (role_id,permission_id) VALUES (?,?)")->execute([$id, $permId]);
        Auth::logActivity('perm_add', 'role', (int) $id, ['permission_id' => $permId]);
        return ['ok' => true];
    }

    public function removePermission(string $id, string $permId): array
    {
        $this->guardMutate();
        Db::pdo()->prepare("DELETE FROM ft_role_permissions WHERE role_id=? AND permission_id=?")->execute([$id, (int) $permId]);
        Auth::logActivity('perm_remove', 'role', (int) $id, ['permission_id' => (int) $permId]);
        return ['ok' => true];
    }
}
