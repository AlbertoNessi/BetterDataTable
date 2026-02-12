# BetterDataTable

`BetterDataTable` is a modern, dependency-free rewrite of the classic jQuery-style datatable model.

## Project goal

The goal of this project is to provide a faster, safer, and more predictable alternative to legacy datatable patterns by default.
It is built to reduce DOM churn, make lifecycle behavior explicit, support keyboard-first accessibility, and simplify configuration for real-world applications.

## Who this is for

This project is for:

- frontend and full-stack engineers building data-heavy UIs
- teams migrating from jQuery/DataTables-style integrations to modern ESM workflows
- projects that need large-table performance without complex setup
- teams that want safer default rendering and clearer lifecycle hooks

It is designed to directly address common pain points found in DataTables usage:

- less DOM churn through row windowing (virtualization)
- explicit lifecycle hooks (`beforeQuery`, `afterQuery`, `beforeRender`, `afterRender`)
- keyboard-first table interactions
- safer cell rendering defaults (text by default, raw HTML opt-in)
- declarative layout tokens instead of legacy layout strings
- optional jQuery adapter for incremental migration

## Why this exists

DataTables is powerful, but large apps often hit rough edges around redraw lifecycle, configuration complexity, and performance at scale.
The design here was aligned against DataTables manual concepts and lifecycle terms while simplifying the API:

- [DataTables manual](https://datatables.net/manual/)
- [Server-side processing](https://datatables.net/manual/server-side)
- [Events](https://datatables.net/manual/events)
- [DataTables 2 notes](https://datatables.net/new/2)

This project exists to give teams a practical path to keep the strengths of table tooling while improving developer experience, accessibility, and performance defaults.

## Authorship

This initial implementation in this repository was developed by **ChatGPT Codex 5.3**, based on project requirements and iterative user direction.
Please keep this attribution when sharing or extending this specific project baseline.

## Install and run tests

```bash
npm test
```

## Usage

```html
<link rel="stylesheet" href="./styles/better-data-table.css" />
<script type="module">
  import { BetterDataTable } from "./src/index.js";

  const table = new BetterDataTable("#table", {
    data: [{ id: 1, name: "Ada" }, { id: 2, name: "Lin" }],
    columns: [
      { id: "id", header: "ID", accessor: "id", width: "90px" },
      { id: "name", header: "Name", accessor: "name" }
    ]
  });
</script>
```

## Key options

- `columns`: column definitions (`id`, `header`, `accessor`, `sortable`, `searchable`, `render`)
- `pagination`: `{ enabled, pageSize, pageSizes }`
- `virtualization`: `{ enabled, height, rowHeight, overscan }`
- `state`: persistent state (`localStorage`) with custom key
- `server`: async query mode using `fetch(query)`
- `security`: `{ allowUnsafeHtml, sanitizer }`
- `layout`: tokenized control placement:
  - `topStart`, `topEnd`, `bottomStart`, `bottomEnd`
  - tokens: `search`, `pageSize`, `info`, `pager`

## Lifecycle events

```js
table.on("beforeQuery", (payload) => {});
table.on("afterQuery", (payload) => {});
table.on("beforeRender", (payload) => {});
table.on("afterRender", (payload) => {});
table.on("stateChange", (payload) => {});
table.on("error", (payload) => {});
```

## Safe rendering

By default, rendered values are inserted as text.

```js
{
  id: "name",
  render: (value) => ({ text: value })
}
```

Raw HTML is blocked unless explicitly enabled:

```js
security: {
  allowUnsafeHtml: true,
  sanitizer: (html) => DOMPurify.sanitize(html)
}
```

## jQuery bridge

```js
import { installBetterDataTablejQueryAdapter } from "./src/adapters/jquery.js";

installBetterDataTablejQueryAdapter(window.jQuery);
$("#table").betterDataTable({ columns, data });
```

## Example

Do not open the demo with `file://...` (browser blocks module imports).

Run a local server from project root:

```bash
npm run demo
```

Then open:

- `http://localhost:4173/` (defaults to the demo page)
- or `http://localhost:4173/examples/index.html`
