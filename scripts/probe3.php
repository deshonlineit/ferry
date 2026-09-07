<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=ferry_local;charset=utf8mb4','root','');
$slugs = ['apple-parts','iphone','ipad','apple-watch','macbook-pro','imac','samsung-parts','huawei-parts','xiaomi-parts','google-parts','devices','accessoires','tools'];
foreach ($slugs as $s) {
    $c = $pdo->query("SELECT COUNT(*) FROM ft_product_categories pc JOIN ft_categories c ON c.id=pc.category_id WHERE c.slug='$s'")->fetchColumn();
    echo str_pad($s,16)." products in sample: $c\n";
}
echo "distinct categories used by sample: ".$pdo->query("SELECT COUNT(DISTINCT category_id) FROM ft_product_categories")->fetchColumn()."\n";
