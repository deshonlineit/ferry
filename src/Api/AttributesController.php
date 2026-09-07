<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class AttributesController
{
    public function list(): array
    {
        $attrs = Db::all("SELECT id,slug,name,type FROM ft_attributes ORDER BY name");
        foreach ($attrs as &$a) {
            $a['values'] = Db::all("SELECT id,slug,value FROM ft_attribute_values WHERE attribute_id=? ORDER BY value", [$a['id']]);
        }
        return $attrs;
    }

    private function guard(string $perm): void
    {
        Auth::requireLogin();
        Auth::requirePermission($perm);
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
    }

    public function create(): array
    {
        $this->guard('attributes.create');
        $d = Input::all();
        if (empty($d['name']) || empty($d['slug'])) {
            throw new \Exception('Name and slug are required', 422);
        }
        $slug = preg_replace('/[^a-z0-9_]/', '_', strtolower($d['slug']));
        if (Db::one("SELECT id FROM ft_attributes WHERE slug=?", [$slug])) {
            throw new \Exception('Slug already exists', 422);
        }
        Db::pdo()->prepare("INSERT INTO ft_attributes (slug,name,type) VALUES (?,?,?)")
            ->execute([$slug, $d['name'], $d['type'] ?? 'select']);
        $id = (int) Db::pdo()->lastInsertId();
        Auth::logActivity('create', 'attribute', $id, ['name' => $d['name']]);
        return ['id' => $id, 'ok' => true];
    }

    public function update(string $id): array
    {
        $this->guard('attributes.create');
        $d = Input::all();
        $fields = [];
        $params = [];
        if (isset($d['name'])) { $fields[] = 'name=?'; $params[] = $d['name']; }
        if (isset($d['type'])) { $fields[] = 'type=?'; $params[] = $d['type']; }
        if ($fields) {
            $params[] = $id;
            Db::pdo()->prepare("UPDATE ft_attributes SET " . implode(',', $fields) . " WHERE id=?")->execute($params);
        }
        Auth::logActivity('edit', 'attribute', (int) $id, []);
        return ['ok' => true];
    }

    public function delete(string $id): array
    {
        $this->guard('attributes.create');
        Db::pdo()->prepare("DELETE FROM ft_product_attributes WHERE attribute_value_id IN (SELECT id FROM ft_attribute_values WHERE attribute_id=?)")->execute([$id]);
        Db::pdo()->prepare("DELETE FROM ft_attribute_values WHERE attribute_id=?")->execute([$id]);
        Db::pdo()->prepare("DELETE FROM ft_attributes WHERE id=?")->execute([$id]);
        Auth::logActivity('delete', 'attribute', (int) $id, []);
        return ['ok' => true];
    }

    public function addValue(string $id): array
    {
        $this->guard('attributes.create');
        $d = Input::all();
        if (empty($d['value'])) {
            throw new \Exception('Value is required', 422);
        }
        $slug = preg_replace('/[^a-z0-9_]/', '_', strtolower($d['value']));
        Db::pdo()->prepare("INSERT IGNORE INTO ft_attribute_values (attribute_id,slug,value) VALUES (?,?,?)")
            ->execute([$id, $slug, $d['value']]);
        return ['ok' => true, 'id' => (int) Db::pdo()->lastInsertId()];
    }

    public function deleteValue(string $id, string $valId): array
    {
        $this->guard('attributes.create');
        Db::pdo()->prepare("DELETE FROM ft_product_attributes WHERE attribute_value_id=?")->execute([$valId]);
        Db::pdo()->prepare("DELETE FROM ft_attribute_values WHERE id=? AND attribute_id=?")->execute([$valId, $id]);
        return ['ok' => true];
    }
}
