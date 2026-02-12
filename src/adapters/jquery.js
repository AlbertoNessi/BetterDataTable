import { BetterDataTable } from "../core/BetterDataTable.js";

const INSTANCES = new WeakMap();

export function installBetterDataTablejQueryAdapter($) {
  if (!$ || !$.fn) {
    throw new Error("installBetterDataTablejQueryAdapter requires a jQuery instance");
  }

  $.fn.betterDataTable = function betterDataTable(optionsOrMethod, ...args) {
    if (typeof optionsOrMethod === "string") {
      const methodName = optionsOrMethod;

      if (methodName === "instance") {
        return this.length > 0 ? INSTANCES.get(this[0]) || null : null;
      }

      this.each(function each() {
        const instance = INSTANCES.get(this);
        if (!instance || typeof instance[methodName] !== "function") {
          throw new Error(`betterDataTable: method ${methodName} is not available`);
        }

        instance[methodName](...args);
      });

      return this;
    }

    const options = optionsOrMethod || {};

    this.each(function each() {
      const existing = INSTANCES.get(this);
      if (existing) {
        existing.destroy();
      }

      INSTANCES.set(this, new BetterDataTable(this, options));
    });

    return this;
  };
}
