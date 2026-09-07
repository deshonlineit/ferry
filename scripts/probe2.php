<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=ferry_local;charset=utf8mb4','root','');
$slugs = ['apple-parts','iphone','ipad','apple-watch','macbook-pro','imac','samsung-parts','huawei-parts','xiaomi-parts','google-parts','devices','accessoires','tools'];
foreach ($slugs as $s) {
    $r = $pdo->query("SELECT slug,name,parent_id FROM ft_categories WHERE slug='$s'")->fetch(PDO::FETCH_ASSOC);
    echo str_pad($s,16)." => ".(($r)? "[{$r['name']}] pid={$r['parent_id']}" : "MISSING")."\n";
}
echo "total categories: ".$pdo->query("SELECT COUNT(*) FROM ft_categories")->fetchColumn()."\n";
