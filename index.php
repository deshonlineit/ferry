<?php
require __DIR__.'/src/Core/Db.php';
require __DIR__.'/src/Core/Router.php';

spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    if (str_starts_with($class, $prefix)) {
        $rel = substr($class, strlen($prefix));
        $file = __DIR__ . '/src/' . str_replace('\\', '/', $rel) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});

App\Core\Router::dispatch();
