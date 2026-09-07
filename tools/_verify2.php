<?php
$p = new PDO('mysql:host=127.0.0.1;port=3306;dbname=ferry_local;charset=utf8mb4','root','');
$pid = $p->query("SELECT id FROM ft_categories WHERE slug='iphone-11-pro'")->fetchColumn();
$rows = $p->query("SELECT slug,name,image FROM ft_categories WHERE parent_id=".(int)$pid);
$n=0;$with=0;
foreach ($rows as $r) { $n++; if ($r['image']) $with++; echo $r['slug'].' | '.$r['name'].' | '.( $r['image']? 'IMG':'-')."\n"; }
echo "children=$n withImage=$with\n";
