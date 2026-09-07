<?php
namespace App\Core;

use App\Core\Db;
use App\Core\Session;

class Csrf
{
    public static function token(): string
    {
        $t = Session::get('csrf_token');
        if (!$t) {
            $t = bin2hex(random_bytes(32));
            Session::set('csrf_token', $t);
        }
        return $t;
    }

    public static function verify(?string $provided): bool
    {
        if (!$provided) {
            return false;
        }
        $real = Session::get('csrf_token');
        if (!$real) {
            return false;
        }
        return hash_equals($real, $provided);
    }
}
