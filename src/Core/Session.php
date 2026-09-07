<?php
namespace App\Core;

use App\Core\Db;

class Session
{
    private static ?array $row = null;
    private static ?string $id = null;
    private static array $payload = [];
    private static bool $loaded = false;

    public const COOKIE = 'ft_admin_sid';
    public const LIFETIME = 7200;

    private static function ensure(): void
    {
        if (self::$loaded) {
            return;
        }
        self::$loaded = true;
        $id = $_COOKIE[self::COOKIE] ?? '';
        if ($id && ctype_alnum($id)) {
            $row = Db::one("SELECT * FROM ft_admin_sessions WHERE id=?", [$id]);
            if ($row && strtotime($row['expires_at']) > time()) {
                self::$id = $id;
                self::$row = $row;
                self::$payload = $row['payload'] ? (json_decode($row['payload'], true) ?: []) : [];
                return;
            }
        }
        self::$id = null;
        self::$payload = [];
    }

    public static function id(): ?string
    {
        self::ensure();
        return self::$id;
    }

    public static function get(string $key, $default = null)
    {
        self::ensure();
        return self::$payload[$key] ?? $default;
    }

    public static function set(string $key, $value): void
    {
        self::ensure();
        self::$payload[$key] = $value;
        self::persist();
    }

    private static function persist(): void
    {
        $id = self::$id ?? self::newId();
        self::$id = $id;
        $expires = date('Y-m-d H:i:s', time() + self::LIFETIME);
        $payload = json_encode(self::$payload);
        $existing = Db::one("SELECT id FROM ft_admin_sessions WHERE id=?", [$id]);
        if ($existing) {
            Db::pdo()->prepare("UPDATE ft_admin_sessions SET payload=?, expires_at=? WHERE id=?")
                ->execute([$payload, $expires, $id]);
        } else {
            Db::pdo()->prepare("INSERT INTO ft_admin_sessions (id, admin_user_id, payload, created_at, expires_at) VALUES (?,?,?,?,?)")
                ->execute([$id, self::$row['admin_user_id'] ?? null, $payload, date('Y-m-d H:i:s'), $expires]);
        }
        if (!headers_sent()) {
            setcookie(self::COOKIE, $id, [
                'expires' => time() + self::LIFETIME,
                'path' => '/',
                'httponly' => true,
                'samesite' => 'Strict',
            ]);
        }
    }

    private static function newId(): string
    {
        return bin2hex(random_bytes(32));
    }

    public static function regenerate(int $adminUserId): void
    {
        self::ensure();
        if (self::$id) {
            Db::pdo()->prepare("DELETE FROM ft_admin_sessions WHERE id=?")->execute([self::$id]);
        }
        self::$id = self::newId();
        self::$payload = [];
        self::$row = ['admin_user_id' => $adminUserId];
        self::persist();
        self::bindUser($adminUserId);
    }

    public static function bindUser(int $adminUserId): void
    {
        if (self::$id) {
            Db::pdo()->prepare("UPDATE ft_admin_sessions SET admin_user_id=? WHERE id=?")
                ->execute([$adminUserId, self::$id]);
        }
    }

    public static function destroy(): void
    {
        self::ensure();
        if (self::$id) {
            Db::pdo()->prepare("DELETE FROM ft_admin_sessions WHERE id=?")->execute([self::$id]);
        }
        if (!headers_sent()) {
            setcookie(self::COOKIE, '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
        }
        self::$id = null;
        self::$row = null;
        self::$payload = [];
        self::$loaded = true;
    }

    public static function gc(): void
    {
        Db::pdo()->prepare("DELETE FROM ft_admin_sessions WHERE expires_at < ?")->execute([date('Y-m-d H:i:s')]);
    }
}
