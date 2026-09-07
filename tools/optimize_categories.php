<?php
$mapFile = __DIR__ . '/_dl.json';
if (!is_file($mapFile)) { echo "No _dl.json found. Run build_cat_images.js first.\n"; exit(1); }
$map = json_decode(file_get_contents($mapFile), true);

$outDir = __DIR__ . '/../assets/img/categories';
if (!is_dir($outDir)) mkdir($outDir, 0777, true);

$pdo = new PDO('mysql:host=127.0.0.1;port=3306;dbname=ferry_local;charset=utf8mb4', 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

$size = 300; $quality = 82;
$done = 0; $skip = 0; $fail = 0;

foreach ($map as $slug => $info) {
    $tmp = __DIR__ . '/_tmp/' . $info['tmp'];
    if (!is_file($tmp) || filesize($tmp) < 100) { $skip++; echo "SKIP (no file) $slug\n"; continue; }
    $ext = strtolower(pathinfo($tmp, PATHINFO_EXTENSION));
    $src = $ext === 'png' ? @imagecreatefrompng($tmp) : @imagecreatefromjpeg($tmp);
    if (!$src) { $skip++; echo "SKIP (bad img) $slug\n"; continue; }

    $sw = imagesx($src); $sh = imagesy($src);
    $scale = max($size / $sw, $size / $sh);
    $dw = (int)round($sw * $scale); $dh = (int)round($sh * $scale);
    $canvas = imagecreatetruecolor($size, $size);
    $white = imagecolorallocate($canvas, 255, 255, 255);
    imagefill($canvas, 0, 0, $white);
    $dx = (int)round(($size - $dw) / 2);
    $dy = (int)round(($size - $dh) / 2);
    imagecopyresampled($canvas, $src, $dx, $dy, 0, 0, $dw, $dh, $sw, $sh);

    $rel = 'assets/img/categories/' . $slug . '.webp';
    $dest = __DIR__ . '/../' . $rel;
    if (!imagewebp($canvas, $dest, $quality)) { $fail++; echo "FAIL webp $slug\n"; imagedestroy($src); imagedestroy($canvas); continue; }
    imagedestroy($src); imagedestroy($canvas);

    $pdo->prepare("UPDATE ft_categories SET image=? WHERE slug=?")->execute([$rel, $slug]);
    $done++;
    if ($done % 50 === 0) echo "  ...$done\n";
}
echo "DONE. optimized=$done skip=$skip fail=$fail\n";
