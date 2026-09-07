<?php
namespace App\Core;

class Db
{
    private static $pdo;

    public static function pdo(): \PDO
    {
        if (self::$pdo) {
            return self::$pdo;
        }
        $c = require __DIR__ . '/../Config/config.php';
        $d = $c['db'];
        $dsn = "mysql:host={$d['host']};port={$d['port']};dbname={$d['name']};charset=utf8mb4";
        self::$pdo = new \PDO($dsn, $d['user'], $d['pass'], [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        ]);
        return self::$pdo;
    }

    public static function all(string $sql, array $params = []): array
    {
        $s = self::pdo()->prepare($sql);
        $s->execute($params);
        return $s->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $s = self::pdo()->prepare($sql);
        $s->execute($params);
        $r = $s->fetch();
        return $r === false ? null : $r;
    }

    public static function col(string $sql, array $params = []): mixed
    {
        $s = self::pdo()->prepare($sql);
        $s->execute($params);
        return $s->fetchColumn();
    }
}
