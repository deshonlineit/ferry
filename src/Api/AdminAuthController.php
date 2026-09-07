<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Input;

class AdminAuthController
{
    public function login(): array
    {
        $d = Input::all();
        $user = trim($d['username'] ?? '');
        $pass = $d['password'] ?? '';
        if ($user === '' || $pass === '') {
            throw new \Exception('Username and password are required', 422);
        }
        if (!Auth::login($user, $pass)) {
            throw new \Exception('Invalid credentials or account inactive', 401);
        }
        return $this->meData();
    }

    public function me(): array
    {
        Auth::requireLogin();
        return $this->meData();
    }

    public function logout(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('dashboard.view');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        Auth::logout();
        return ['ok' => true];
    }

    private function meData(): array
    {
        $u = Auth::user();
        return [
            'user' => [
                'id' => $u['id'],
                'username' => $u['username'],
                'email' => $u['email'],
                'full_name' => $u['full_name'],
                'role_name' => $u['role_name'],
                'role_slug' => $u['role_slug'],
                'permissions' => $u['permissions'],
            ],
            'csrf' => Csrf::token(),
        ];
    }
}
