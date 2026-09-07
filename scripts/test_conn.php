<?php
function tryConn($dsn, $u, $p) {
    try {
        $c = new PDO($dsn, $u, $p, [PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT, PDO::ATTR_TIMEOUT => 5]);
        $v = $c->query("SELECT 1")->fetchColumn();
        return "OK ($v)";
    } catch (Throwable $e) {
        return "FAIL: " . $e->getMessage();
    }
}
echo "source 3308: " . tryConn('mysql:host=127.0.0.1;port=3308;dbname=ferrytelecomde_wp_dxjvg;charset=utf8mb4', 'ferrytelecomde_wp_xjtol', 'G*B%kVa4I19ZPUq3') . "\n";
echo "dest   3307: " . tryConn('mysql:host=127.0.0.1;port=3307;dbname=ferry_local;charset=utf8mb4', 'root', '') . "\n";
