<?php
namespace App\Core;

class Input
{
    public static function all(): array
    {
        $data = [];
        if (!empty($_SERVER['QUERY_STRING'])) {
            parse_str($_SERVER['QUERY_STRING'], $data);
        }
        $ct = $_SERVER['CONTENT_TYPE'] ?? '';
        $raw = (string) (file_get_contents('php://input') ?: '');
        if (stripos($ct, 'application/json') !== false && $raw !== '') {
            $dec = json_decode($raw, true);
            if (is_array($dec)) {
                $data = array_merge($data, $dec);
            }
        } elseif (!empty($_POST)) {
            $data = array_merge($data, $_POST);
        } elseif ($raw !== '') {
            parse_str($raw, $posted);
            if (!empty($posted)) {
                $data = array_merge($data, $posted);
            }
        }
        return $data;
    }

    public static function csrfToken(): ?string
    {
        $h = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if ($h) {
            return $h;
        }
        $data = self::all();
        return $data['csrf_token'] ?? null;
    }
}
