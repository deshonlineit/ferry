<?php
$p = new PDO('mysql:host=127.0.0.1;port=3306;dbname=ferry_local;charset=utf8mb4','root','');
echo "=== ft_categories schema ===\n";
foreach ($p->query('DESCRIBE ft_categories') as $row) {
    echo $row['Field'].' '.$row['Type']."\n";
}
echo "total=".$p->query('SELECT COUNT(*) FROM ft_categories')->fetchColumn()."\n";
echo "=== sample ===\n";
foreach ($p->query('SELECT id,slug,name,parent_id FROM ft_categories LIMIT 20') as $row) {
    echo $row['id'].' | '.$row['slug'].' | '.$row['name'].' | p='.$row['parent_id']."\n";
}
