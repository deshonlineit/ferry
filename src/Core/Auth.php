<?php
namespace App\Core;

use App\Core\Db;
use App\Core\Session;

class Auth
{
    private static ?array $user = null;
    private static bool $resolved = false;

    public static function login(string $username, string $password): bool
    {
        $u = Db::one("SELECT * FROM ft_admin_users WHERE (username=? OR email=?) AND status='active'", [$username, $username]);
        if (!$u || !password_verify($password, $u['password_hash'])) {
            return false;
        }
        Session::regenerate($u['id']);
        Db::pdo()->prepare("UPDATE ft_admin_users SET last_login=? WHERE id=?")
            ->execute([date('Y-m-d H:i:s'), $u['id']]);
        self::$user = null;
        self::$resolved = false;
        return true;
    }

    public static function logout(): void
    {
        Session::destroy();
        self::$user = null;
        self::$resolved = false;
    }

    public static function user(): ?array
    {
        if (self::$resolved) {
            return self::$user;
        }
        self::$resolved = true;
        $sid = Session::id();
        if (!$sid) {
            return null;
        }
        $row = Db::one("SELECT s.admin_user_id, s.id AS sid FROM ft_admin_sessions s WHERE s.id=?", [$sid]);
        if (!$row || !$row['admin_user_id']) {
            return null;
        }
        $u = Db::one("SELECT id,username,email,full_name,role_id,status FROM ft_admin_users WHERE id=? AND status='active'", [$row['admin_user_id']]);
        if (!$u) {
            return null;
        }
        $perms = Db::all(
            "SELECT p.pkey FROM ft_role_permissions rp JOIN ft_admin_permissions p ON p.id=rp.permission_id WHERE rp.role_id=?",
            [$u['role_id']]
        );
        $u['permissions'] = array_column($perms, 'pkey');
        $role = Db::one("SELECT name,slug FROM ft_admin_roles WHERE id=?", [$u['role_id']]);
        $u['role_name'] = $role['name'] ?? '';
        $u['role_slug'] = $role['slug'] ?? '';
        self::$user = $u;
        return $u;
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    public static function can(string $key): bool
    {
        $u = self::user();
        if (!$u) {
            return false;
        }
        return in_array($key, $u['permissions'], true) || in_array('*', $u['permissions'], true);
    }

    public static function requireLogin(): void
    {
        if (!self::check()) {
            throw new \Exception('Authentication required', 401);
        }
    }

    public static function requirePermission(string $key): void
    {
        self::requireLogin();
        if (!self::can($key)) {
            throw new \Exception('Permission denied: ' . $key, 403);
        }
    }

    public static function isSuperAdmin(): bool
    {
        $u = self::user();
        return $u && $u['role_slug'] === 'super_admin';
    }

    public static function logActivity(string $action, string $entity, ?int $entityId = null, ?array $detail = null): void
    {
        $u = self::user();
        Db::pdo()->prepare("INSERT INTO ft_admin_activity_log (admin_user_id,action,entity,entity_id,detail,created_at) VALUES (?,?,?,?,?,?)")
            ->execute([$u['id'] ?? null, $action, $entity, $entityId, $detail ? json_encode($detail) : null, date('Y-m-d H:i:s')]);
    }
}
