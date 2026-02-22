import test from "node:test";
import assert from "node:assert/strict";

import { JSDOM } from "jsdom";

import { BetterDataTable } from "../src/index.js";

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

function removeMethod(target, methodName) {
  const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
  if (descriptor) {
    Reflect.deleteProperty(target, methodName);
  }

  return () => {
    if (descriptor) {
      Object.defineProperty(target, methodName, descriptor);
    }
  };
}

test("table still works when replaceChildren is unavailable", async () => {
  const dom = new JSDOM(`<!doctype html><html><body><div id="table"></div></body></html>`, {
    url: "http://localhost/"
  });
  const restoreGlobals = installDomGlobals(dom.window);
  const restoreReplaceChildren = removeMethod(dom.window.Element.prototype, "replaceChildren");

  try {
    const table = new BetterDataTable("#table", {
      state: { enabled: false },
      virtualization: { enabled: false },
      columns: [{ id: "name", header: "Name", accessor: "name" }],
      data: [{ name: "Ada" }]
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    assert.equal(
      dom.window.document.querySelectorAll("#table tbody tr").length,
      1,
      "table should render rows without replaceChildren"
    );

    table.destroy();
    assert.equal(dom.window.document.querySelector("#table").children.length, 0, "destroy should clear host content");
  } finally {
    restoreReplaceChildren();
    restoreGlobals();
    dom.window.close();
  }
});
