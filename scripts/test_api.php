<?php
$base = dirname(__DIR__);
require $base . '/src/Core/Db.php';
require $base . '/src/Api/ProductsController.php';
require $base . '/src/Api/AttributesController.php';

try {
    $c = new App\Api\ProductsController();
    $r = $c->list([]);
    echo "PRODUCTS OK items=" . count($r['items']) . " total=" . $r['total'] . "\n";
} catch (\Throwable $e) {
    echo "PRODUCTS ERR: " . $e->getMessage() . "\n";
}

try {
    $c = new App\Api\AttributesController();
    $r = $c->list();
    echo "ATTR OK count=" . count($r) . "\n";
} catch (\Throwable $e) {
    echo "ATTR ERR: " . $e->getMessage() . "\n";
}
