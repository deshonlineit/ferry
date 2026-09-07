<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=ferry_local;charset=utf8mb4','root','');
echo "ft_product_categories rows: ".$pdo->query("SELECT COUNT(*) FROM ft_product_categories")->fetchColumn()."\n";
echo "ft_products rows: ".$pdo->query("SELECT COUNT(*) FROM ft_products")->fetchColumn()."\n";
echo "ft_categories rows: ".$pdo->query("SELECT COUNT(*) FROM ft_categories")->fetchColumn()."\n";
$slugs = ['iphone','apple-parts','samsung-parts','devices','ipad','huawei-parts','xiaomi-parts'];
foreach ($slugs as $s) {
    $c = $pdo->query("SELECT COUNT(*) FROM ft_product_categories pc JOIN ft_categories c ON c.id=pc.category_id WHERE c.slug='$s'")->fetchColumn();
    echo "  $s -> $c\n";
}
echo "top categories by product count:\n";
foreach ($pdo->query("SELECT c.slug, COUNT(*) n FROM ft_product_categories pc JOIN ft_categories c ON c.id=pc.category_id GROUP BY c.id ORDER BY n DESC LIMIT 10") as $r) {
    echo "  {$r['slug']} -> {$r['n']}\n";
}
