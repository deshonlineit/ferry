<?php
namespace App\Core;

use App\Core\Db;

class Router
{
    public static function dispatch(): void
    {
        Session::gc();
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $appRoot = realpath(__DIR__ . '/../..');
        $docRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? __DIR__);
        $rel = ltrim(substr($appRoot, strlen($docRoot)), DIRECTORY_SEPARATOR);
        $prefix = '/' . str_replace(DIRECTORY_SEPARATOR, '/', $rel);
        if ($prefix !== '/' && str_starts_with($path, $prefix)) {
            $path = substr($path, strlen($prefix)) ?: '/';
        }
        $root = $appRoot;

        // Static files (css/js/images) directly when they exist.
        if ($path !== '/' && $path !== '') {
            $file = $root . '/' . ltrim($path, '/');
            $real = realpath($file);
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if ($real && str_starts_with($real, $root . DIRECTORY_SEPARATOR) && is_file($real) && $ext !== 'php') {
                $mime = mime_content_type($real) ?: 'application/octet-stream';
                header("Content-Type: $mime");
                readfile($real);
                return;
            }
        }

        // Admin SPA shell
        if ($path === '/admin' || $path === '/admin/' || str_starts_with($path, '/admin/') && !str_starts_with($path, '/admin/assets/')) {
            $shell = $appRoot . '/admin/index.html';
            if (is_file($shell)) {
                header('Content-Type: text/html; charset=utf-8');
                header('Cache-Control: no-store, no-cache, must-revalidate');
                header('Pragma: no-cache');
                echo file_get_contents($shell);
                return;
            }
        }

        // Admin API
        if (preg_match('#^/api/admin/(.+)$#', $path, $m)) {
            self::json(fn() => self::adminDispatch($m[1]));
            return;
        }

        // Public API (read GET always; writes delegated to controllers which enforce auth)
        if (preg_match('#^/api/(?:v1/)?(.+)$#', $path, $m)) {
            self::json(fn() => self::publicDispatch($m[1]));
            return;
        }

        // Frontend storefront shell
        header('Content-Type: text/html; charset=utf-8');
        $docRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? __DIR__);
        $rel = ltrim(substr($appRoot, strlen($docRoot)), DIRECTORY_SEPARATOR);
        $base = '/' . str_replace(DIRECTORY_SEPARATOR, '/', $rel) . '/';
        $html = file_get_contents($appRoot . '/index.html');
        $html = preg_replace('/<head>/i', '<head><base href="' . htmlspecialchars($base, ENT_QUOTES) . '">', $html, 1);
        echo $html;
    }

    private static function json(callable $handler): void
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $data = $handler();
            echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            $code = ($e->getCode() >= 400 && $e->getCode() < 600) ? $e->getCode() : 400;
            http_response_code($code);
            echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
        }
    }

    private static function adminDispatch(string $tail): mixed
    {
        $segs = explode('/', trim($tail, '/'));
        $resource = $segs[0] ?? '';
        $id = $segs[1] ?? null;
        $sub = $segs[2] ?? null;
        $subId = $segs[3] ?? null;
        $method = $_SERVER['REQUEST_METHOD'];

        $map = [
            'auth'       => 'App\Api\AdminAuthController',
            'users'      => 'App\Api\AdminUsersController',
            'roles'      => 'App\Api\AdminRolesController',
            'permissions'=> 'App\Api\AdminPermissionsController',
            'media'      => 'App\Api\MediaController',
            'content'    => 'App\Api\ContentController',
            'settings'   => 'App\Api\ContentController',
            'products'   => 'App\Api\ProductsController',
            'categories' => 'App\Api\CategoriesController',
            'attributes' => 'App\Api\AttributesController',
            'customers'  => 'App\Api\CustomersController',
            'orders'     => 'App\Api\OrdersController',
            'dashboard'  => 'App\Api\AdminDashboardController',
            'activity'   => 'App\Api\ActivityController',
        ];
        if (!isset($map[$resource])) {
            throw new \Exception('Unknown admin resource: ' . $resource, 404);
        }
        $ctrl = new $map[$resource]();

        // auth
        if ($resource === 'auth') {
            return match ($segs[1] ?? '') {
                'login'  => $ctrl->login(),
                'me'     => $ctrl->me(),
                'logout' => $ctrl->logout(),
                default  => throw new \Exception('Unknown auth action', 404),
            };
        }
        // content
        if ($resource === 'content') {
            if ($method === 'GET' && $id === null) return $ctrl->contentList();
            if ($id !== null && in_array($method, ['PUT', 'POST', 'PATCH'])) return $ctrl->contentUpdate($id);
            throw new \Exception('Method not allowed', 405);
        }
        // settings
        if ($resource === 'settings') {
            if ($method === 'GET') return $ctrl->settingsList();
            if (in_array($method, ['PUT', 'POST', 'PATCH'])) return $ctrl->settingsUpdate();
            throw new \Exception('Method not allowed', 405);
        }
        // dashboard
        if ($resource === 'dashboard') {
            if ($method === 'GET' && ($segs[1] ?? '') === 'stats') return $ctrl->stats();
            throw new \Exception('Unknown dashboard action', 404);
        }
        // activity
        if ($resource === 'activity') {
            if ($method === 'GET' && $id === null) return $ctrl->list();
            throw new \Exception('Method not allowed', 405);
        }
        // users special
        if ($resource === 'users' && $id !== null && $sub === 'toggle') {
            return $ctrl->toggleStatus($id);
        }
        // roles special
        if ($resource === 'roles' && $id !== null && $sub === 'permissions') {
            if ($method === 'POST') return $ctrl->assignPermission($id);
            if ($method === 'DELETE' && $subId !== null) return $ctrl->removePermission($id, $subId);
            throw new \Exception('Method not allowed', 405);
        }
        // media
        if ($resource === 'media') {
            if ($method === 'GET' && $id === null) return $ctrl->list();
            if ($method === 'POST' && $id === null) return $ctrl->upload();
            if ($method === 'DELETE' && $id !== null) return $ctrl->delete($id);
            throw new \Exception('Method not allowed', 405);
        }

        // Standard REST
        if ($method === 'GET' && $id === null) {
            if ($resource === 'products') return $ctrl->list($_GET);
            return $ctrl->list();
        }
        if ($method === 'GET' && $id !== null) return $ctrl->show($id);
        if ($method === 'POST' && $id === null) return $ctrl->create();
        if (in_array($method, ['PUT', 'PATCH']) && $id !== null) return $ctrl->update($id);
        if ($method === 'DELETE' && $id !== null) return $ctrl->delete($id);
        throw new \Exception('Method not allowed', 405);
    }

    private static function publicDispatch(string $tail): mixed
    {
        $segs = explode('/', trim($tail, '/'));
        $resource = $segs[0] ?? '';
        $id = $segs[1] ?? null;
        $method = $_SERVER['REQUEST_METHOD'];

        $map = [
            'products'    => 'App\Api\ProductsController',
            'categories'  => 'App\Api\CategoriesController',
            'attributes'  => 'App\Api\AttributesController',
            'settings'    => 'App\Api\SettingsController',
        ];
        if (!isset($map[$resource])) {
            throw new \Exception('Unknown resource: ' . $resource, 404);
        }
        $ctrl = new $map[$resource]();

        if ($method === 'GET') {
            if ($resource === 'products') return $id ? $ctrl->show($id) : $ctrl->list($_GET);
            if ($resource === 'categories') return $id ? $ctrl->show($id) : $ctrl->list();
            if ($resource === 'attributes') return $ctrl->list();
            if ($resource === 'settings') return $ctrl->list();
        }
        // Writes require admin auth — handled inside controllers
        if ($method === 'POST' && $id === null) return $ctrl->create();
        if (in_array($method, ['PUT', 'PATCH']) && $id !== null) return $ctrl->update($id);
        if ($method === 'DELETE' && $id !== null) return $ctrl->delete($id);
        throw new \Exception('Method not allowed', 405);
    }
}
