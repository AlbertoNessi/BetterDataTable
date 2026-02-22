<?php

declare(strict_types=1);

namespace App\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

final class BetterDataTableDemoController
{
    public function index(): Response
    {
        $html = <<<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Symfony 5 + BetterDataTable</title>
    <link rel="stylesheet" href="/better-data-table/styles/better-data-table.css" />
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f7fb; color: #122030; }
      main { max-width: 1080px; margin: 2rem auto; padding: 0 1rem 2rem; }
      h1 { margin: 0 0 .5rem; font-size: 1.8rem; }
      p { margin: 0 0 1.25rem; color: #3d4f66; }
      #table-host { background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 12px 32px rgba(18, 32, 48, .08); }
    </style>
  </head>
  <body>
    <main>
      <h1>BetterDataTable in Symfony 5</h1>
      <p>Data is served by Symfony routes and rendered by BetterDataTable.</p>
      <div id="table-host"></div>
    </main>
    <script type="module">
      import { BetterDataTable } from "/better-data-table/src/index.js";

      async function boot() {
        const response = await fetch("/api/players");
        const data = await response.json();

        new BetterDataTable("#table-host", {
          caption: "Football players",
          state: { enabled: true, key: "symfony5-demo-table" },
          pagination: { enabled: true, pageSize: 5, pageSizes: [5, 10, 20] },
          virtualization: { enabled: true, height: 260, rowHeight: 40, overscan: 3 },
          columns: [
            { id: "id", header: "ID", accessor: "id", width: "80px" },
            { id: "name", header: "Name", accessor: "name" },
            { id: "club", header: "Club", accessor: "club.name" },
            { id: "position", header: "Position", accessor: "position" },
            { id: "age", header: "Age", accessor: "age", width: "90px" }
          ],
          data
        });
      }

      boot();
    </script>
  </body>
</html>
HTML;

        return new Response($html);
    }

    public function players(): JsonResponse
    {
        return new JsonResponse($this->playersData());
    }

    public function playersServer(Request $request): JsonResponse
    {
        $rows = $this->playersData();
        $search = mb_strtolower(trim((string) $request->query->get('search', '')));
        $page = max(0, (int) $request->query->get('page', 0));
        $pageSize = max(1, (int) $request->query->get('pageSize', 5));
        $sortRules = $this->parseSortRules((string) $request->query->get('sort', '[]'));

        $filtered = [];
        foreach ($rows as $index => $row) {
            if ($search !== '') {
                $haystack = mb_strtolower(sprintf('%s %s %s', $row['name'], $row['club']['name'], $row['position']));
                if (mb_strpos($haystack, $search) === false) {
                    continue;
                }
            }

            $filtered[] = ['row' => $row, 'index' => $index];
        }

        if ($sortRules !== []) {
            usort($filtered, function (array $left, array $right) use ($sortRules): int {
                foreach ($sortRules as $rule) {
                    $a = $this->extractSortValue($left['row'], $rule['id']);
                    $b = $this->extractSortValue($right['row'], $rule['id']);

                    if ($a === $b) {
                        continue;
                    }

                    $dir = $rule['direction'] === 'desc' ? -1 : 1;
                    if (is_numeric($a) && is_numeric($b)) {
                        return ((float) $a <=> (float) $b) * $dir;
                    }

                    return strcmp((string) $a, (string) $b) * $dir;
                }

                return $left['index'] <=> $right['index'];
            });
        }

        $rowsOnly = array_map(static fn (array $entry): array => $entry['row'], $filtered);
        $filteredCount = count($rowsOnly);
        $offset = $page * $pageSize;

        return new JsonResponse([
            'rows' => array_slice($rowsOnly, $offset, $pageSize),
            'filteredCount' => $filteredCount,
            'totalCount' => count($rows),
        ]);
    }

    /**
     * @return array<int, array{id:int,name:string,club:array{name:string},position:string,age:int}>
     */
    private function playersData(): array
    {
        return [
            ['id' => 1, 'name' => 'Lamine Yamal', 'club' => ['name' => 'Barcelona'], 'position' => 'RW', 'age' => 18],
            ['id' => 2, 'name' => 'Pedri', 'club' => ['name' => 'Barcelona'], 'position' => 'CM', 'age' => 23],
            ['id' => 3, 'name' => 'Frenkie de Jong', 'club' => ['name' => 'Barcelona'], 'position' => 'CM', 'age' => 29],
            ['id' => 4, 'name' => 'Jude Bellingham', 'club' => ['name' => 'Real Madrid'], 'position' => 'CAM', 'age' => 23],
            ['id' => 5, 'name' => 'Vinicius Junior', 'club' => ['name' => 'Real Madrid'], 'position' => 'LW', 'age' => 26],
            ['id' => 6, 'name' => 'Federico Valverde', 'club' => ['name' => 'Real Madrid'], 'position' => 'CM', 'age' => 28],
            ['id' => 7, 'name' => 'Bukayo Saka', 'club' => ['name' => 'Arsenal'], 'position' => 'RW', 'age' => 25],
            ['id' => 8, 'name' => 'Martin Odegaard', 'club' => ['name' => 'Arsenal'], 'position' => 'CAM', 'age' => 27],
            ['id' => 9, 'name' => 'Declan Rice', 'club' => ['name' => 'Arsenal'], 'position' => 'CDM', 'age' => 27],
            ['id' => 10, 'name' => 'Vitinha', 'club' => ['name' => 'Paris Saint-Germain'], 'position' => 'CM', 'age' => 26],
            ['id' => 11, 'name' => 'Warren Zaire-Emery', 'club' => ['name' => 'Paris Saint-Germain'], 'position' => 'CM', 'age' => 20],
            ['id' => 12, 'name' => 'Ousmane Dembele', 'club' => ['name' => 'Paris Saint-Germain'], 'position' => 'RW', 'age' => 29],
            ['id' => 13, 'name' => 'Florian Wirtz', 'club' => ['name' => 'Bayer Leverkusen'], 'position' => 'CAM', 'age' => 23],
            ['id' => 14, 'name' => 'Jamal Musiala', 'club' => ['name' => 'Bayern Munich'], 'position' => 'CAM', 'age' => 23],
            ['id' => 15, 'name' => 'Phil Foden', 'club' => ['name' => 'Manchester City'], 'position' => 'LW', 'age' => 26],
        ];
    }

    /**
     * @return array<int, array{id:string,direction:string}>
     */
    private function parseSortRules(string $raw): array
    {
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $rules = [];
        foreach ($decoded as $rule) {
            if (!is_array($rule)) {
                continue;
            }

            $id = isset($rule['id']) ? (string) $rule['id'] : '';
            if ($id === '') {
                continue;
            }

            $direction = (isset($rule['direction']) && $rule['direction'] === 'desc') ? 'desc' : 'asc';
            $rules[] = ['id' => $id, 'direction' => $direction];
        }

        return $rules;
    }

    /**
     * @param array<string, mixed> $row
     * @return mixed
     */
    private function extractSortValue(array $row, string $columnId)
    {
        if ($columnId === 'club') {
            return $row['club']['name'] ?? '';
        }

        return $row[$columnId] ?? null;
    }
}
