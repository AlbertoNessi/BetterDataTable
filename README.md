# BetterDataTable

`BetterDataTable` is a modern, dependency-free rewrite of the classic jQuery-style datatable model.

## Tech stack

- Only Vanilla JavaScript only (ES modules)

## Authorship

This initial implementation in this repository was developed by **ChatGPT Codex 5.3**, based on project requirements and iterative user direction.
Please keep this attribution when sharing or extending this specific project baseline.

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

## Install and run tests

```bash
npm test
```

## Compatibility verification

Compatibility is validated by automated tests in `test/jquery-compat.test.js`.

Current verified matrix:

- jQuery `4.0.0` (latest stable)
- jQuery `3.7.1` (latest 3.x)

The test suite checks:

- plugin install and initialization via `$.fn.betterDataTable`
- jQuery chainability
- instance retrieval (`instance`)
- method dispatch (`setSearch`)
- teardown (`destroy`)

## How to import this library

`./src/index.js` is only for contributors working inside this repository.

If you are using this library in another project, install it first:

```bash
npm install github:AlbertoNessi/BetterDataTable
```

Then import it by package name:

```js
import { BetterDataTable } from "better-data-table";
import "better-data-table/styles";
```

If you are developing inside this repository, use:

```js
import { BetterDataTable } from "./src/index.js";
```

## Usage (with bundler)

```js
import { BetterDataTable } from "better-data-table";
import "better-data-table/styles";

const table = new BetterDataTable("#table", {
  data: [{ id: 1, name: "Ada" }, { id: 2, name: "Lin" }],
  columns: [
    { id: "id", header: "ID", accessor: "id", width: "90px" },
    { id: "name", header: "Name", accessor: "name" }
  ]
});
```

## Usage (plain browser, no bundler)

```html
<link rel="stylesheet" href="/node_modules/better-data-table/styles/better-data-table.css" />
<script type="module">
  import { BetterDataTable } from "/node_modules/better-data-table/src/index.js";

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
- `scroll`: `{ x, y, minColumnWidth }`
- `theme`: color tokens for instant visual customization
- `icons`: icon/label settings for pager and sort buttons
- `state`: persistent state (`localStorage`) with custom key
- `server`: async query mode using `fetch(query)`
- `security`: `{ allowUnsafeHtml, sanitizer }`
- `layout`: tokenized control placement:
  - `topStart`, `topEnd`, `bottomStart`, `bottomEnd`
  - tokens: `search`, `pageSize`, `info`, `pager`

## Super simple customization

You can customize colors and icons directly in the constructor.

```js
const table = new BetterDataTable("#table", {
  columns,
  data,
  theme: {
    background: "#f4f6f8",
    surface: "#ffffff",
    panelAlt: "#eef2f6",
    border: "#c7d0db",
    borderStrong: "#9eacbc",
    text: "#102133",
    textMuted: "#4a5b6d",
    accent: "#0b63ce",
    accentSoft: "#e7f0ff",
    focus: "#0b63ce",
    headerBackground: "#dde6f2",
    headerText: "#0f2740",
    rowAlt: "#f8fbff"
  },
  icons: {
    previous: { icon: "«", label: "Prev", position: "start" },
    next: { icon: "»", label: "Next", position: "end" },
    sortNone: "⇅",
    sortAsc: "▲",
    sortDesc: "▼"
  }
});
```

You can also use custom icon elements:

```js
icons: {
  next: {
    icon: () => {
      const el = document.createElement("span");
      el.textContent = "➜";
      return el;
    },
    label: "Next"
  }
}
```

If you prefer pure CSS theming, override variables on `.bdt`:

```css
#table .bdt {
  --bdt-accent: #0056b3;
  --bdt-header-bg: #e6edf5;
  --bdt-border: #c6d0dc;
}
```

## Wide tables and horizontal scroll

The table now supports many columns by default:

- horizontal scrolling is enabled on the table container
- columns get a default minimum width (`scroll.minColumnWidth`, default `128`)
- cells use `white-space: nowrap` so columns stay readable and rows keep stable height

Example:

```js
const table = new BetterDataTable("#table", {
  scroll: {
    x: true,
    minColumnWidth: 140
  },
  columns: [
    { id: "id", header: "ID", accessor: "id", width: "90px" },
    { id: "description", header: "Description", accessor: "description", wrap: true }
  ]
});
```

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
- wide-column demo: `http://localhost:4173/examples/wide-columns.html`
- FC Barcelona theme demo: `http://localhost:4173/examples/fc-barcelona-theme.html`
