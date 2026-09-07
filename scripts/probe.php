<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=ferry_local;charset=utf8mb4','root','');
$r = $pdo->query('SELECT id,sku,slug,name,image,stock,stock_status,(SELECT price FROM ft_product_prices WHERE product_id=p.id AND customer_group="retail" LIMIT 1) AS price FROM ft_products p LIMIT 4')->fetchAll(PDO::FETCH_ASSOC);
foreach ($r as $x) {
    echo 'IMG=['.$x['image']."] NAME=[".$x['name']."] PRICE=[".var_export($x['price'],true)."] STOCK=[".$x['stock_status']."]\n";
}
echo "--- groups ---\n";
$g = $pdo->query('SELECT customer_group,COUNT(*) c FROM ft_product_prices GROUP BY customer_group')->fetchAll(PDO::FETCH_ASSOC);
print_r($g);
echo "--- media sample ---\n";
$m = $pdo->query('SELECT file_path,alt FROM ft_media LIMIT 3')->fetchAll(PDO::FETCH_ASSOC);
print_r($m);
