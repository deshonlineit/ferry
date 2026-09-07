<?php
$p = new PDO('mysql:host=127.0.0.1;port=3306;dbname=ferry_local;charset=utf8mb4','root','');
foreach (['case','audio','charger','screen','holder','cable','battery'] as $kw) {
    $rows = $p->query("SELECT slug,image FROM ft_categories WHERE name LIKE '%$kw%' LIMIT 4");
    foreach ($rows as $r) echo str_pad($kw,9).' '.$r['slug'].' -> '.( $r['image']?'IMG':'-')."\n";
}
echo "TOTAL with image: ".$p->query("SELECT COUNT(*) FROM ft_categories WHERE image<>'' AND image IS NOT NULL")->fetchColumn()."\n";
