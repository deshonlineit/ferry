<?php
$p = new PDO('mysql:host=127.0.0.1;port=3306;dbname=ferry_local;charset=utf8mb4','root','');
echo "cats with image: ".$p->query('SELECT COUNT(*) FROM ft_categories WHERE image IS NOT NULL AND image <> ""')->fetchColumn()."\n";
foreach ($p->query('SELECT slug,image FROM ft_categories WHERE image<>"" LIMIT 3') as $r) {
    echo $r['slug'].' -> '.$r['image']."\n";
}
