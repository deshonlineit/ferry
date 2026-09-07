<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class CategoriesController
{
    public function list(): array
    {
        return Db::all("SELECT id,parent_id,slug,name,description,image,sort_order FROM ft_categories ORDER BY sort_order, name");
    }

    public function show(string $id): array
    {
        $c = Db::one("SELECT id,parent_id,slug,name,description,image,sort_order FROM ft_categories WHERE id=? OR slug=?", [$id, $id]);
        if (!$c) {
            throw new \Exception('Category not found', 404);
        }
        $c['products_count'] = (int) Db::col("SELECT COUNT(*) FROM ft_product_categories WHERE category_id=?", [$c['id']]);
        return ['category' => $c];
    }

    public function tree(): array
    {
        $all = $this->list();
        $byParent = [];
        foreach ($all as $c) {
            $byParent[$c['parent_id'] ?? 0][] = $c;
        }
        $build = function (int $pid) use (&$build, $byParent): array {
            $out = [];
            foreach ($byParent[$pid] ?? [] as $c) {
                $c['children'] = $build($c['id']);
                $out[] = $c;
            }
            return $out;
        };
        return $build(0);
    }

    private function guard(string $perm): void
    {
        Auth::requireLogin();
        Auth::requirePermission($perm);
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
    }

    public function create(): array
    {
        $this->guard('categories.create');
        $d = Input::all();
        if (empty($d['name'])) {
            throw new \Exception('Name is required', 422);
        }
        $slug = $d['slug'] ?? '';
        if (!$slug) {
            $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower($d['name']));
        }
        if (Db::one("SELECT id FROM ft_categories WHERE slug=?", [$slug])) {
            throw new \Exception('Slug already exists', 422);
        }
        Db::pdo()->prepare("INSERT INTO ft_categories (parent_id,slug,name,description,image,sort_order) VALUES (?,?,?,?,?,?)")
            ->execute([
                !empty($d['parent_id']) ? (int) $d['parent_id'] : null,
                $slug, $d['name'], $d['description'] ?? null, $d['image'] ?? null,
                (int) ($d['sort_order'] ?? 0),
            ]);
        $id = (int) Db::pdo()->lastInsertId();
        Auth::logActivity('create', 'category', $id, ['name' => $d['name']]);
        return ['id' => $id, 'ok' => true];
    }

    public function update(string $id): array
    {
        $this->guard('categories.edit');
        $d = Input::all();
        $fields = [];
        $params = [];
        foreach (['parent_id' => 'parent_id', 'slug' => 'slug', 'name' => 'name', 'description' => 'description', 'image' => 'image', 'sort_order' => 'sort_order'] as $k => $col) {
            if (isset($d[$k])) {
                $fields[] = "$col=?";
                $params[] = $k === 'parent_id' ? (!empty($d[$k]) ? (int) $d[$k] : null) : $d[$k];
            }
        }
        if ($fields) {
            $params[] = $id;
            Db::pdo()->prepare("UPDATE ft_categories SET " . implode(',', $fields) . " WHERE id=?")->execute($params);
            Auth::logActivity('edit', 'category', (int) $id, ['fields' => array_keys($d)]);
        }
        return ['ok' => true];
    }

    public function delete(string $id): array
    {
        $this->guard('categories.delete');
        Db::pdo()->prepare("DELETE FROM ft_product_categories WHERE category_id=?")->execute([$id]);
        Db::pdo()->prepare("UPDATE ft_categories SET parent_id=NULL WHERE parent_id=?")->execute([$id]);
        Db::pdo()->prepare("DELETE FROM ft_categories WHERE id=?")->execute([$id]);
        Auth::logActivity('delete', 'category', (int) $id, []);
        return ['ok' => true];
    }
}
