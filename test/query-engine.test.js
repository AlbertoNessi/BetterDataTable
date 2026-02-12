import test from "node:test";
import assert from "node:assert/strict";

import { QueryEngine } from "../src/core/QueryEngine.js";

function createEngine(rows) {
  const engine = new QueryEngine({
    columns: [
      { id: "id", accessor: "id" },
      { id: "name", accessor: "name" },
      { id: "score", accessor: "score" }
    ]
  });

  engine.setRows(rows);
  return engine;
}

test("search is case-insensitive by default", () => {
  const engine = createEngine([
    { id: 1, name: "Alpha" },
    { id: 2, name: "beta" },
    { id: 3, name: "Gamma" }
  ]);

  const result = engine.run({ search: "BETA", pagination: false });

  assert.equal(result.filteredCount, 1);
  assert.equal(result.rows[0].id, 2);
});

test("sort is stable across equal keys", () => {
  const engine = createEngine([
    { id: 1, name: "A", score: 10 },
    { id: 2, name: "B", score: 10 },
    { id: 3, name: "C", score: 5 }
  ]);

  const result = engine.run({
    sort: [{ id: "score", direction: "desc" }],
    pagination: false
  });

  assert.deepEqual(
    result.rows.map((row) => row.id),
    [1, 2, 3]
  );
});

test("page clamps to last page when value is out of range", () => {
  const engine = createEngine([
    { id: 1, name: "A" },
    { id: 2, name: "B" },
    { id: 3, name: "C" }
  ]);

  const result = engine.run({ page: 99, pageSize: 2, pagination: true });

  assert.equal(result.page, 1);
  assert.deepEqual(
    result.rows.map((row) => row.id),
    [3]
  );
});
