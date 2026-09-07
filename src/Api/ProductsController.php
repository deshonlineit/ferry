<?php
namespace App\Api;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Db;
use App\Core\Input;

class ProductsController
{
    public function list(array $get): array
    {
        $where = ['p.status = ?'];
        $params = ['publish'];

        if (!empty($get['q'])) {
            $where[] = 'p.name LIKE ?';
            $params[] = '%' . $get['q'] . '%';
        }
        if (!empty($get['category'])) {
            $catId = Db::col("SELECT id FROM ft_categories WHERE slug=?", [$get['category']]);
            if ($catId) {
                $all = Db::all("SELECT id, parent_id FROM ft_categories");
                $set = [$catId];
                $queue = [$catId];
                while ($queue) {
                    $cur = array_pop($queue);
                    foreach ($all as $c) {
                        if ($c['parent_id'] == $cur && !in_array($c['id'], $set, true)) {
                            $set[] = $c['id'];
                            $queue[] = $c['id'];
                        }
                    }
                }
                $ph = implode(',', array_fill(0, count($set), '?'));
                $where[] = "EXISTS(SELECT 1 FROM ft_product_categories pc WHERE pc.product_id=p.id AND pc.category_id IN ($ph))";
                $params = array_merge($params, $set);
            } else {
                $where[] = '1=0';
            }
        }
        if (!empty($get['attribute']) && is_array($get['attribute'])) {
            foreach ($get['attribute'] as $av) {
                if (strpos($av, ':') !== false) {
                    [$as, $vs] = explode(':', $av, 2);
                    $where[] = 'EXISTS(SELECT 1 FROM ft_product_attributes pa JOIN ft_attribute_values avv ON avv.id=pa.attribute_value_id JOIN ft_attributes a ON a.id=avv.attribute_id WHERE pa.product_id=p.id AND a.slug = ? AND avv.slug = ?)';
                    $params[] = $as;
                    $params[] = $vs;
                }
            }
        }
        if (!empty($get['stock']) && is_array($get['stock'])) {
            $allowed = ['instock', 'outofstock'];
            $vals = array_values(array_intersect($get['stock'], $allowed));
            if ($vals) {
                $ph = implode(',', array_fill(0, count($vals), '?'));
                $where[] = "p.stock_status IN ($ph)";
                $params = array_merge($params, $vals);
            }
        }

        $w = 'WHERE ' . implode(' AND ', $where);
        $total = (int) Db::col("SELECT COUNT(*) FROM ft_products p $w", $params);

        $sort = match ($get['sort'] ?? 'newest') {
            'name'  => 'p.name ASC',
            'price' => 'price ASC',
            default => 'p.id DESC',
        };
        $per = 20;
        $page = max(1, (int) ($get['page'] ?? 1));
        $off = ($page - 1) * $per;

        $sql = "SELECT p.id,p.sku,p.slug,p.name,p.image,p.stock,p.stock_status,
                       (SELECT price FROM ft_product_prices WHERE product_id=p.id AND customer_group='retail' LIMIT 1) AS price
                FROM ft_products p $w ORDER BY $sort LIMIT " . (int) $per . " OFFSET " . (int) $off;
        $items = Db::all($sql, $params);

        return ['items' => $items, 'page' => $page, 'per_page' => $per, 'total' => $total];
    }

    public function show(string $slug): array
    {
        $p = Db::one("SELECT id,sku,slug,name,description,status,stock,stock_status,weight,min_order_qty,image FROM ft_products WHERE slug=?", [$slug]);
        if (!$p) {
            throw new \Exception('Product not found', 404);
        }
        $id = $p['id'];
        $prices = Db::all("SELECT customer_group,price,currency FROM ft_product_prices WHERE product_id=?", [$id]);
        $cats = Db::all("SELECT c.id,c.slug,c.name FROM ft_product_categories pc JOIN ft_categories c ON c.id=pc.category_id WHERE pc.product_id=?", [$id]);
        $attrs = Db::all("SELECT a.name AS attr, av.value, av.id AS value_id FROM ft_product_attributes pa JOIN ft_attribute_values av ON av.id=pa.attribute_value_id JOIN ft_attributes a ON a.id=av.attribute_id WHERE pa.product_id=?", [$id]);
        $media = Db::all("SELECT id,file_path,alt FROM ft_media WHERE product_id=?", [$id]);
        return ['product' => $p, 'prices' => $prices, 'categories' => $cats, 'attributes' => $attrs, 'media' => $media];
    }

    private function guard(string $perm): void
    {
        Auth::requireLogin();
        Auth::requirePermission($perm);
        Csrf::verify(Input::csrfToken()) or throw new \Exception('Invalid CSRF token', 419);
    }

    private function persistRelations(int $productId, array $d): void
    {
        Db::pdo()->prepare("DELETE FROM ft_product_prices WHERE product_id=?")->execute([$productId]);
        foreach (['retail', 'wholesale'] as $g) {
            if (isset($d['price_' . $g]) && $d['price_' . $g] !== '' && $d['price_' . $g] !== null) {
                Db::pdo()->prepare("INSERT INTO ft_product_prices (product_id,customer_group,price,currency) VALUES (?,?,?,?)")
                    ->execute([$productId, $g, (float) $d['price_' . $g], 'CHF']);
            }
        }
        Db::pdo()->prepare("DELETE FROM ft_product_categories WHERE product_id=?")->execute([$productId]);
        foreach (array_unique(array_filter(array_map('intval', (array) ($d['category_ids'] ?? [])))) as $cid) {
            Db::pdo()->prepare("INSERT IGNORE INTO ft_product_categories (product_id,category_id) VALUES (?,?)")->execute([$productId, $cid]);
        }
        Db::pdo()->prepare("DELETE FROM ft_product_attributes WHERE product_id=?")->execute([$productId]);
        foreach (array_unique(array_filter(array_map('intval', (array) ($d['attribute_value_ids'] ?? [])))) as $avid) {
            Db::pdo()->prepare("INSERT IGNORE INTO ft_product_attributes (product_id,attribute_value_id) VALUES (?,?)")->execute([$productId, $avid]);
        }
    }

    public function create(): array
    {
        $this->guard('products.create');
        $d = Input::all();
        if (empty($d['name'])) {
            throw new \Exception('Name is required', 422);
        }
        $slug = $d['slug'] ?? '';
        if (!$slug) {
            $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower($d['name']));
        }
        if (Db::one("SELECT id FROM ft_products WHERE slug=?", [$slug])) {
            $slug .= '-' . substr(md5(uniqid()), 0, 6);
        }
        Db::pdo()->prepare("INSERT INTO ft_products (sku,slug,name,description,status,featured,stock,stock_status,manages_stock,weight,min_order_qty,image,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([
                $d['sku'] ?? null, $slug, $d['name'], $d['description'] ?? null,
                $d['status'] ?? 'publish', !empty($d['featured']) ? 1 : 0,
                (int) ($d['stock'] ?? 0), $d['stock_status'] ?? 'instock', !empty($d['manages_stock']) ? 1 : 0,
                (($d['weight'] ?? '') !== '' ? (float) $d['weight'] : null), (int) ($d['min_order_qty'] ?? 1),
                $d['image'] ?? null, date('Y-m-d H:i:s'), date('Y-m-d H:i:s'),
            ]);
        $id = (int) Db::pdo()->lastInsertId();
        $this->persistRelations($id, $d);
        Auth::logActivity('create', 'product', $id, ['name' => $d['name']]);
        return ['id' => $id, 'slug' => $slug, 'ok' => true];
    }

    public function update(string $id): array
    {
        $this->guard('products.edit');
        $p = Db::one("SELECT id FROM ft_products WHERE id=?", [$id]);
        if (!$p) {
            throw new \Exception('Product not found', 404);
        }
        $d = Input::all();
        $fields = [];
        $params = [];
        $map = [
            'sku' => 'sku', 'slug' => 'slug', 'name' => 'name', 'description' => 'description',
            'status' => 'status', 'featured' => 'featured', 'stock' => 'stock', 'stock_status' => 'stock_status',
            'manages_stock' => 'manages_stock', 'weight' => 'weight', 'min_order_qty' => 'min_order_qty', 'image' => 'image',
        ];
        foreach ($map as $k => $col) {
            if (isset($d[$k])) {
                $v = $d[$k];
                if ($k === 'featured' || $k === 'manages_stock') {
                    $v = !empty($v) ? 1 : 0;
                } elseif ($k === 'stock' || $k === 'min_order_qty') {
                    $v = (int) $v;
                } elseif ($k === 'weight') {
                    $v = $v === '' ? null : (float) $v;
                }
                $fields[] = "$col=?";
                $params[] = $v;
            }
        }
        if ($fields) {
            $fields[] = 'updated_at=?';
            $params[] = date('Y-m-d H:i:s');
            $params[] = $id;
            Db::pdo()->prepare("UPDATE ft_products SET " . implode(',', $fields) . " WHERE id=?")->execute($params);
        }
        $this->persistRelations((int) $id, $d);
        Auth::logActivity('edit', 'product', (int) $id, ['fields' => array_keys($d)]);
        return ['ok' => true];
    }

    public function delete(string $id): array
    {
        $this->guard('products.delete');
        Db::pdo()->prepare("DELETE FROM ft_product_prices WHERE product_id=?")->execute([$id]);
        Db::pdo()->prepare("DELETE FROM ft_product_categories WHERE product_id=?")->execute([$id]);
        Db::pdo()->prepare("DELETE FROM ft_product_attributes WHERE product_id=?")->execute([$id]);
        Db::pdo()->prepare("UPDATE ft_media SET product_id=NULL WHERE product_id=?")->execute([$id]);
        Db::pdo()->prepare("DELETE FROM ft_products WHERE id=?")->execute([$id]);
        Auth::logActivity('delete', 'product', (int) $id, []);
        return ['ok' => true];
    }
}
