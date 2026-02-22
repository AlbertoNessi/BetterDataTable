import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { JSDOM } from "jsdom";

import { BetterDataTable } from "../src/index.js";

const execFile = promisify(execFileCb);
const SYMFONY_DIR = "/Users/albertonessi/2_DEV/Projects/BetterDataTable/symfony5-integration";

function installDomGlobals(window) {
  const names = [
    "window",
    "document",
    "Node",
    "HTMLElement",
    "location",
    "requestAnimationFrame",
    "cancelAnimationFrame"
  ];
  const previous = new Map();

  for (const name of names) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  }
  Object.defineProperty(globalThis, "window", { value: window, configurable: true, writable: true });
  Object.defineProperty(globalThis, "document", { value: window.document, configurable: true, writable: true });
  Object.defineProperty(globalThis, "Node", { value: window.Node, configurable: true, writable: true });
  Object.defineProperty(globalThis, "HTMLElement", { value: window.HTMLElement, configurable: true, writable: true });
  Object.defineProperty(globalThis, "location", { value: window.location, configurable: true, writable: true });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    value: (callback) => setTimeout(() => callback(Date.now()), 0),
    configurable: true,
    writable: true
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    value: (id) => clearTimeout(id),
    configurable: true,
    writable: true
  });
  return () => {
    for (const [name, descriptor] of previous.entries()) {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, name);
      }
    }
  };
}

async function requestSymfony(path, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }

  const { stdout } = await execFile("php", ["tools/request.php", path, params.toString()], {
    cwd: SYMFONY_DIR,
    maxBuffer: 1024 * 1024
  });

  return JSON.parse(stdout);
}

async function requestSymfonyJson(path, query = {}) {
  const response = await requestSymfony(path, query);
  assert.equal(response.status, 200, `${path} should respond with 200`);
  return JSON.parse(response.body);
}

async function waitFor(assertion, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    if (assertion()) {
      return;
    }
    await delay(20);
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

test("Symfony integration page and API are wired for BetterDataTable", async () => {
  const page = await requestSymfony("/");
  assert.equal(page.status, 200);
  assert.match(page.body, /better-data-table/i);

  const payload = await requestSymfonyJson("/api/players");
  assert.ok(Array.isArray(payload));
  assert.ok(payload.length >= 12);
});

test("core BetterDataTable features work with Symfony dataset", async () => {
  const rows = await requestSymfonyJson("/api/players");

  const dom = new JSDOM(`<!doctype html><html><body><div id="table"></div></body></html>`, {
    url: "http://localhost/compat-client"
  });
  const restoreGlobals = installDomGlobals(dom.window);

  try {
    const securityEvents = [];

    const table = new BetterDataTable("#table", {
      data: rows,
      columns: [
        { id: "id", header: "ID", accessor: "id", width: "90px" },
        { id: "name", header: "Name", accessor: "name", render: (value) => ({ html: `<strong>${value}</strong>` }) },
        { id: "club", header: "Club", accessor: "club.name", wrap: true },
        { id: "age", header: "Age", accessor: "age" }
      ],
      pagination: {
        enabled: true,
        pageSize: 5,
        pageSizes: [5, 10]
      },
      virtualization: {
        enabled: true,
        height: 120,
        rowHeight: 24,
        overscan: 1
      },
      scroll: {
        x: true,
        y: true,
        minColumnWidth: 180
      },
      state: {
        enabled: true,
        key: "symfony5-client-compat"
      },
      layout: {
        topStart: ["search"],
        topEnd: ["pageSize"],
        bottomStart: ["info"],
        bottomEnd: ["pager"]
      },
      theme: {
        accent: "#185adb",
        headerBackground: "#f2f6ff"
      },
      icons: {
        previous: { icon: "«", label: "Prev", position: "start" },
        next: { icon: "»", label: "Next", position: "end" },
        sortNone: "⇅",
        sortAsc: "▲",
        sortDesc: "▼"
      },
      security: {
        allowUnsafeHtml: false
      },
      hooks: {
        error: (payload) => securityEvents.push(payload)
      }
    });

    await delay(15);

    assert.equal(table.getRows().length, 5);
    assert.ok(table.getVisibleRows().length <= 5);
    assert.equal(dom.window.document.querySelector(".bdt").style.getPropertyValue("--bdt-accent"), "#185adb");
    assert.equal(dom.window.document.querySelector(".bdt").style.getPropertyValue("--bdt-col-min-width"), "180px");
    assert.equal(dom.window.document.querySelectorAll(".bdt__select option").length, 2);

    const firstNameCell = dom.window.document.querySelector("tbody tr td:nth-child(2)");
    assert.ok(firstNameCell.textContent.includes("<strong>"), "unsafe html should render as text when blocked");
    assert.ok(
      securityEvents.some((event) => event.type === "security"),
      "security hook should receive blocked html events"
    );

    table.setSearch("Madrid");
    await delay(20);
    assert.ok(table.getRows().length > 0);
    assert.ok(table.getRows().every((row) => row.club.name.includes("Madrid")));

    table.setSort("age", "desc");
    await delay(20);
    const sortedRows = table.getRows();
    assert.ok(sortedRows[0].age >= sortedRows[1].age);

    table.setPageSize(10);
    await delay(20);
    assert.equal(table.getRows().length, 3);

    table.setSearch("Paris");
    await delay(20);
    assert.equal(table.getState().search, "Paris");

    table.destroy();
    const restored = new BetterDataTable("#table", {
      data: rows,
      columns: [
        { id: "id", header: "ID", accessor: "id" },
        { id: "name", header: "Name", accessor: "name" }
      ],
      pagination: { enabled: true, pageSize: 5, pageSizes: [5, 10] },
      virtualization: { enabled: false },
      state: { enabled: true, key: "symfony5-client-compat" }
    });
    await delay(15);
    assert.equal(restored.getState().search, "Paris");
    restored.destroy();
  } finally {
    restoreGlobals();
    dom.window.close();
  }
});

test("server mode works against Symfony API endpoint", async () => {
  const dom = new JSDOM(`<!doctype html><html><body><div id="table"></div></body></html>`, {
    url: "http://localhost/compat-server"
  });
  const restoreGlobals = installDomGlobals(dom.window);

  try {
    const events = {
      beforeQuery: 0,
      afterQuery: 0,
      beforeRender: 0,
      afterRender: 0
    };

    const table = new BetterDataTable("#table", {
      columns: [
        { id: "id", header: "ID", accessor: "id" },
        { id: "name", header: "Name", accessor: "name" },
        { id: "club", header: "Club", accessor: "club.name" },
        { id: "age", header: "Age", accessor: "age" }
      ],
      virtualization: { enabled: false },
      pagination: { enabled: true, pageSize: 4, pageSizes: [4, 8] },
      state: { enabled: false },
      server: {
        enabled: true,
        fetch: async (query) => {
          return requestSymfonyJson("/api/players/server", {
            search: query.search ?? "",
            page: query.page ?? 0,
            pageSize: query.pageSize ?? 4,
            sort: JSON.stringify(query.sort ?? [])
          });
        }
      },
      hooks: {
        beforeQuery: () => {
          events.beforeQuery += 1;
        },
        afterQuery: () => {
          events.afterQuery += 1;
        },
        beforeRender: () => {
          events.beforeRender += 1;
        },
        afterRender: () => {
          events.afterRender += 1;
        }
      }
    });

    await waitFor(() => table.getRows().length === 4, 2000);
    assert.equal(table.getRows().length, 4);
    assert.ok(events.beforeQuery >= 1);
    assert.ok(events.afterQuery >= 1);
    assert.ok(events.beforeRender >= 1);
    assert.ok(events.afterRender >= 1);

    table.setSearch("Arsenal");
    await waitFor(
      () => table.getRows().length > 0 && table.getRows().every((row) => row.club.name.includes("Arsenal")),
      2000
    );
    assert.ok(table.getRows().every((row) => row.club.name.includes("Arsenal")));

    table.setSort("age", "desc");
    await waitFor(() => {
      const currentRows = table.getRows();
      return currentRows.length >= 2 && currentRows[0].age >= currentRows[1].age;
    }, 2000);
    const rows = table.getRows();
    assert.ok(rows[0].age >= rows[1].age);

    table.destroy();
  } finally {
    restoreGlobals();
    dom.window.close();
  }
});
