<?php

declare(strict_types=1);

use App\Kernel;
use Symfony\Component\HttpFoundation\Request;

require dirname(__DIR__).'/vendor/autoload.php';

$path = $argv[1] ?? '/';
$queryRaw = $argv[2] ?? '';

parse_str($queryRaw, $queryParams);

$kernel = new Kernel('test', true);
$request = Request::create($path, 'GET', $queryParams);
$response = $kernel->handle($request);
$kernel->terminate($request, $response);

echo json_encode([
    'status' => $response->getStatusCode(),
    'headers' => $response->headers->all(),
    'body' => $response->getContent(),
], JSON_THROW_ON_ERROR);
