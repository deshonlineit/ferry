<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class MediaController
{
    private const DIR = __DIR__ . '/../../assets/uploads';
    private const ALLOWED = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'image/svg+xml' => 'svg'];
    private const MAX = 5 * 1024 * 1024;

    public function list(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('media.view');
        $rows = Db::all("SELECT id,file_path,alt,mime,product_id FROM ft_media ORDER BY id DESC LIMIT 200");
        return ['items' => $rows];
    }

    public function upload(): array
    {
        Auth::requireLogin();
        Auth::requirePermission('media.upload');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            throw new \Exception('No file uploaded', 422);
        }
        $f = $_FILES['file'];
        if ($f['size'] > self::MAX) {
            throw new \Exception('File exceeds 5MB limit', 422);
        }
        $mime = mime_content_type($f['tmp_name']);
        if (!isset(self::ALLOWED[$mime])) {
            throw new \Exception('Unsupported file type: ' . $mime, 422);
        }
        if (!is_dir(self::DIR)) {
            mkdir(self::DIR, 0755, true);
        }
        $ext = self::ALLOWED[$mime];
        $name = bin2hex(random_bytes(8)) . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', basename($f['name']));
        $name = substr($name, 0, 120) . '.' . $ext;
        $dest = self::DIR . '/' . $name;
        if (!move_uploaded_file($f['tmp_name'], $dest)) {
            throw new \Exception('Failed to save file', 500);
        }
        $rel = 'assets/uploads/' . $name;
        Db::pdo()->prepare("INSERT INTO ft_media (product_id,file_path,mime,alt) VALUES (?,?,?,?)")
            ->execute([!empty($_POST['product_id']) ? (int) $_POST['product_id'] : null, $rel, $mime, $_POST['alt'] ?? '']);
        $id = (int) Db::pdo()->lastInsertId();
        Auth::logActivity('upload', 'media', $id, ['file' => $rel]);
        return ['id' => $id, 'file_path' => $rel, 'url' => $rel];
    }

    public function delete(string $id): array
    {
        Auth::requireLogin();
        Auth::requirePermission('media.upload');
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
        $m = Db::one("SELECT * FROM ft_media WHERE id=?", [$id]);
        if (!$m) {
            throw new \Exception('Media not found', 404);
        }
        $path = self::DIR . '/' . basename($m['file_path']);
        if (is_file($path)) {
            @unlink($path);
        }
        Db::pdo()->prepare("DELETE FROM ft_media WHERE id=?")->execute([$id]);
        return ['ok' => true];
    }
}
