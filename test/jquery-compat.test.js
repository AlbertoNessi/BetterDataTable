import test from "node:test";
import assert from "node:assert/strict";

import { JSDOM } from "jsdom";

import { installBetterDataTablejQueryAdapter } from "../src/adapters/jquery.js";

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

async function loadJQuery(packageName, window) {
  const mod = await import(packageName);
  const exported = mod.default ?? mod;

  if (typeof exported === "function" && exported.fn && exported.fn.jquery) {
    return exported;
  }

  if (typeof exported === "function") {
    return exported(window);
  }

  throw new Error(`Could not load jQuery from ${packageName}`);
}

async function runAdapterSmoke(packageName) {
  const dom = new JSDOM(`<!doctype html><html><body><div id=\"table\"></div></body></html>`, {
    url: "http://localhost/"
  });

  const restoreGlobals = installDomGlobals(dom.window);

  try {
    const $ = await loadJQuery(packageName, dom.window);
    dom.window.jQuery = $;
    dom.window.$ = $;

    installBetterDataTablejQueryAdapter($);

    const chainResult = $("#table").betterDataTable({
      state: { enabled: false },
      virtualization: { enabled: false },
      pagination: { enabled: true, pageSize: 10, pageSizes: [10] },
      columns: [
        { id: "id", header: "ID", accessor: "id" },
        { id: "name", header: "Name", accessor: "name" }
      ],
      data: [
        { id: 1, name: "Ada" },
        { id: 2, name: "Lin" }
      ]
    });
    assert.equal(chainResult.jquery, $.fn.jquery, "plugin should return a jQuery object for chaining");

    await new Promise((resolve) => setTimeout(resolve, 5));

    const instance = $("#table").betterDataTable("instance");
    assert.ok(instance, "adapter should expose instance()");
    assert.equal(typeof instance.setSearch, "function");

    $("#table").betterDataTable("setSearch", "Ada");
    await new Promise((resolve) => setTimeout(resolve, 5));

    assert.equal(instance.getRows().length, 1, "search should filter rows through adapter method dispatch");

    $("#table").betterDataTable("destroy");
    assert.equal(dom.window.document.querySelector("#table").children.length, 0, "foy should clear host content");

    assert.throws(
      () => $("#table").betterDataTable("unknownMethod"),
      /method unknownMethod is not available/,
      "unknown method calls should fail loudly"
    );
  } finally {
    restoreGlobals();
    dom.window.close();
  }
}

test("jQuery adapter works with latest jQuery 4", async () => {
  await runAdapterSmoke("jquery4");
});

test("jQuery adapter works with latest jQuery 3", async () => {
  await runAdapterSmoke("jquery3");
});
