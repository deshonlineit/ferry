<?php
set_time_limit(0);
/*
 * ETL: copy ALL live WooCommerce products -> local ft_ schema.
 * Source: live server MySQL via SSH tunnel (127.0.0.1:3308)
 * Dest:   local MySQL (127.0.0.1:3307, db ferry_local)
 */

$src = new PDO(
    'mysql:host=127.0.0.1;port=3308;dbname=ferrytelecomde_wp_dxjvg;charset=utf8mb4;connect_timeout=10',
    'ferrytelecomde_wp_xjtol', 'G*B%kVa4I19ZPUq3',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 10]
);
$dst = new PDO(
    'mysql:host=127.0.0.1;port=3307;dbname=ferry_local;charset=utf8mb4;connect_timeout=10',
    'root', '',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 10]
);
$P = 'H7QhWJK_';

$q = function ($pdo, $sql, $params = []) {
    $s = $pdo->prepare($sql);
    $s->execute($params);
    return $s;
};

function batchInsert($dst, $table, $cols, $rows) {
    if (!$rows) return;
    $ph = '(' . implode(',', array_fill(0, count($cols), '?')) . ')';
    $sql = "INSERT INTO $table (" . implode(',', $cols) . ") VALUES " . implode(',', array_fill(0, count($rows), $ph));
    $flat = [];
    foreach ($rows as $row) foreach ($row as $v) $flat[] = $v;
    $dst->prepare($sql)->execute($flat);
}

$dst->exec("SET FOREIGN_KEY_CHECKS=0");
foreach (['ft_attribute_values','ft_attributes','ft_product_categories','ft_product_attributes',
          'ft_product_prices','ft_media','ft_products','ft_categories','ft_site_settings'] as $t) {
    $dst->exec("TRUNCATE TABLE $t");
}
$dst->exec("SET FOREIGN_KEY_CHECKS=1");
echo "cleared target tables\n";

echo "=== Attributes ===\n";
$attrMap = [];
$taxRows = $q($src, "SELECT DISTINCT taxonomy FROM {$P}term_taxonomy WHERE taxonomy LIKE 'pa_%'")->fetchAll(PDO::FETCH_COLUMN);
foreach ($taxRows as $tax) {
    $name = ucwords(str_replace(['pa_', '_'], ['', ' '], $tax));
    $q($dst, "INSERT INTO ft_attributes (slug,name,type) VALUES (?,?,?)", [$tax, $name, 'select']);
    $aid = $dst->lastInsertId();
    $vals = $q($src, "SELECT t.term_id, t.slug, t.name FROM {$P}terms t JOIN {$P}term_taxonomy tt ON tt.term_id=t.term_id WHERE tt.taxonomy=?", [$tax])->fetchAll(PDO::FETCH_ASSOC);
    foreach ($vals as $v) {
        $q($dst, "INSERT INTO ft_attribute_values (attribute_id,slug,value) VALUES (?,?,?)", [$aid, $v['slug'], $v['name']]);
        $attrMap[$v['term_id']] = $dst->lastInsertId();
    }
}
echo "attributes: " . count($taxRows) . ", attribute values: " . count($attrMap) . "\n";

echo "=== Categories ===\n";
$catMap = [];
$cats = $q($src, "SELECT t.term_id, t.slug, t.name, COALESCE(tt.description,'') d, tt.parent
                  FROM {$P}terms t JOIN {$P}term_taxonomy tt ON tt.term_id=t.term_id
                  WHERE tt.taxonomy='product_cat'")->fetchAll(PDO::FETCH_ASSOC);
foreach ($cats as $c) {
    $q($dst, "INSERT INTO ft_categories (slug,name,description,parent_id,sort_order) VALUES (?,?,?,NULL,0)",
        [$c['slug'], $c['name'], $c['d']]);
    $catMap[$c['term_id']] = $dst->lastInsertId();
}
foreach ($cats as $c) {
    if ($c['parent'] && isset($catMap[$c['parent']])) {
        $q($dst, "UPDATE ft_categories SET parent_id=? WHERE id=?", [$catMap[$c['parent']], $catMap[$c['term_id']]]);
    }
}
echo "categories: " . count($cats) . "\n";

echo "=== Products (ALL published) ===\n";
$allIds = $q($src, "SELECT ID FROM {$P}posts WHERE post_type='product' AND post_status='publish' ORDER BY ID")->fetchAll(PDO::FETCH_COLUMN);
$total = count($allIds);
echo "total source products: $total\n";

$chunks = array_chunk($allIds, 1000);
$prodCount = 0; $mediaCount = 0; $noImage = 0; $priceCount = 0;
$chunkIdx = 0;
foreach ($chunks as $ids) {
    $chunkIdx++;
    $idList = implode(',', $ids);

    $meta = [];
    $metaRows = $q($src, "SELECT post_id, meta_key, meta_value FROM {$P}postmeta WHERE post_id IN ($idList)")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($metaRows as $r) { $meta[$r['post_id']][$r['meta_key']] = $r['meta_value']; }

    $posts = [];
    $postRows = $q($src, "SELECT ID, post_title, post_name, post_content, post_date FROM {$P}posts WHERE ID IN ($idList)")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($postRows as $r) { $posts[$r['ID']] = $r; }

    $prodCats = []; $prodAttrs = [];
    $rel = $q($src, "SELECT tr.object_id, tt.taxonomy, t.term_id FROM {$P}term_relationships tr
                  JOIN {$P}term_taxonomy tt ON tt.term_taxonomy_id=tr.term_taxonomy_id
                  JOIN {$P}terms t ON t.term_id=tt.term_id
                  WHERE tr.object_id IN ($idList) AND (tt.taxonomy='product_cat' OR tt.taxonomy LIKE 'pa_%')")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rel as $r) {
        if ($r['taxonomy'] === 'product_cat') $prodCats[$r['object_id']][] = $r['term_id'];
        else $prodAttrs[$r['object_id']][] = $r['term_id'];
    }

    $attIds = [];
    foreach ($ids as $pid) {
        $pm = $meta[$pid] ?? [];
        if (!empty($pm['_thumbnail_id'])) $attIds[] = (int)$pm['_thumbnail_id'];
        if (!empty($pm['_product_image_gallery'])) {
            foreach (explode(',', $pm['_product_image_gallery']) as $g) { $g = (int)$g; if ($g) $attIds[] = $g; }
        }
    }
    $guidMap = [];
    if ($attIds) {
        $attList = implode(',', array_unique($attIds));
        $g = $q($src, "SELECT ID, guid FROM {$P}posts WHERE ID IN ($attList)")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($g as $x) $guidMap[$x['ID']] = $x['guid'];
    }

    $prodRows = []; $priceRows = []; $catRows = []; $attrRows = []; $mediaRows = [];
    foreach ($ids as $pid) {
        $pm = $meta[$pid] ?? [];
        $post = $posts[$pid] ?? null;
        if (!$post) continue;
        $sku = $pm['_sku'] ?? null;
        $stock = isset($pm['_stock']) ? (int)$pm['_stock'] : 0;
        $stockStatus = $pm['_stock_status'] ?? 'instock';
        $manages = isset($pm['_manage_stock']) && $pm['_manage_stock'] === 'yes' ? 1 : 0;
        $weight = $pm['_weight'] ?? null;
        $minQty = isset($pm['_min_order_qty']) ? (int)$pm['_min_order_qty'] : 1;
        $price = $pm['_price'] ?? $pm['_regular_price'] ?? 0;

        $image = null;
        if (!empty($pm['_thumbnail_id']) && isset($guidMap[(int)$pm['_thumbnail_id']])) $image = $guidMap[(int)$pm['_thumbnail_id']];
        $gallery = [];
        if (!empty($pm['_product_image_gallery'])) {
            foreach (explode(',', $pm['_product_image_gallery']) as $g) {
                $g = (int)$g;
                if ($g && isset($guidMap[$g]) && !in_array($guidMap[$g], $gallery, true)) $gallery[] = $guidMap[$g];
            }
        }
        if (!$image && $gallery) $image = $gallery[0];
        if (!$image) $noImage++;

        $prodRows[] = [$pid, $sku, $post['post_name'], $post['post_title'], $post['post_content'], 'publish', $stock, $stockStatus, $manages, $weight, $minQty, $image, $post['post_date'], $post['post_date']];

        $priceRows[] = [$pid, 'retail', (float)$price, 'CHF'];
        $priceCount++;
        $ws = null;
        if (isset($pm['_wholesale_price']) && is_numeric($pm['_wholesale_price']) && $pm['_wholesale_price'] > 0) $ws = (float)$pm['_wholesale_price'];
        else { foreach ($pm as $k => $v) { if (preg_match('/wholesale.*price/i', $k) && is_numeric($v) && $v > 0) { $ws = (float)$v; break; } } }
        if ($ws !== null) { $priceRows[] = [$pid, 'wholesale', $ws, 'CHF']; $priceCount++; }

        if (isset($prodCats[$pid])) {
            foreach ($prodCats[$pid] as $c) if (isset($catMap[$c])) $catRows[] = [$pid, $catMap[$c]];
        }
        if (isset($prodAttrs[$pid])) {
            foreach ($prodAttrs[$pid] as $a) if (isset($attrMap[$a])) $attrRows[] = [$pid, $attrMap[$a]];
        }
        $imgs = [];
        if ($image) $imgs[] = $image;
        foreach ($gallery as $gi) if (!in_array($gi, $imgs, true)) $imgs[] = $gi;
        foreach ($imgs as $img) { $mediaRows[] = [$pid, $img, 'image', $post['post_title']]; $mediaCount++; }
        $prodCount++;
    }

    $dst->beginTransaction();
    try {
        batchInsert($dst, 'ft_products', ['id','sku','slug','name','description','status','stock','stock_status','manages_stock','weight','min_order_qty','image','created_at','updated_at'], $prodRows);
        batchInsert($dst, 'ft_product_prices', ['product_id','customer_group','price','currency'], $priceRows);
        batchInsert($dst, 'ft_product_categories', ['product_id','category_id'], $catRows);
        batchInsert($dst, 'ft_product_attributes', ['product_id','attribute_value_id'], $attrRows);
        batchInsert($dst, 'ft_media', ['product_id','file_path','mime','alt'], $mediaRows);
        $dst->commit();
    } catch (\Throwable $e) {
        $dst->rollBack();
        echo "CHUNK $chunkIdx FAILED: " . $e->getMessage() . "\n";
        throw $e;
    }
    echo "chunk $chunkIdx done (products so far: $prodCount)\n";
}

echo "=== Site settings ===\n";
$opts = $q($src, "SELECT option_name, option_value FROM {$P}options WHERE option_name IN
                ('blogname','blogdescription','home','siteurl','woocommerce_currency','woocommerce_default_country','permalink_structure')")->fetchAll(PDO::FETCH_ASSOC);
foreach ($opts as $o) {
    $q($dst, "INSERT INTO ft_site_settings (name,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=?", [$o['option_name'], $o['option_value'], $o['option_value']]);
}
echo "settings: " . count($opts) . "\n";
echo "DONE. products=$prodCount media=$mediaCount prices=$priceCount products_without_image=$noImage\n";
