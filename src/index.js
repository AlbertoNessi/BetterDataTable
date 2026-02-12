import { BetterDataTable } from "./core/BetterDataTable.js";

export { BetterDataTable };

export function createBetterDataTable(target, options) {
  return new BetterDataTable(target, options);
}
