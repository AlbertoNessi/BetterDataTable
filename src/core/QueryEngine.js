import { parseAccessor, toText } from "./utils.js";

// Keep null and undefined at the end for ascending order.
// This avoids empty values jumping ahead of real data.
function compareValues(a, b, direction) {
  if (a === b) {
    return 0;
  }

  if (a === null || a === undefined) {
    return direction === "asc" ? 1 : -1;
  }

  if (b === null || b === undefined) {
    return direction === "asc" ? -1 : 1;
  }

  if (typeof a === "number" && typeof b === "number") {
    return direction === "asc" ? a - b : b - a;
  }

  const aText = toText(a);
  const bText = toText(b);
  const result = aText.localeCompare(bText, undefined, {
    sensitivity: "base",
    numeric: true
  });

  return direction === "asc" ? result : -result;
}

export class QueryEngine {
  // QueryEngine is pure by design: it computes row sets but never touches the DOM.
  constructor({ columns = [], caseSensitive = false } = {}) {
    this.caseSensitive = caseSensitive;
    this.setColumns(columns);
    this.rows = [];
  }

  setColumns(columns) {
    this.columns = columns.map((column, index) => {
      const id = column.id || column.accessor || `col_${index}`;
      return {
        ...column,
        id,
        getValue: parseAccessor(column.accessor),
        searchable: column.searchable !== false,
        sortable: column.sortable !== false
      };
    });

    this.columnById = new Map(this.columns.map((column) => [column.id, column]));
  }

  setRows(rows) {
    this.rows = Array.isArray(rows) ? rows : [];
  }

  run({
    search = "",
    sort = [],
    page = 0,
    pageSize = 25,
    pagination = true
  } = {}) {
    const searchableColumns = this.columns.filter((column) => column.searchable);
    const searchValue = this.caseSensitive ? toText(search) : toText(search).toLowerCase();

    // Keep the original index so we can preserve stable sort order later.
    const decorated = [];
    for (let index = 0; index < this.rows.length; index += 1) {
      const row = this.rows[index];

      if (searchValue) {
        const matches = searchableColumns.some((column) => {
          const raw = column.getValue(row);
          const text = this.caseSensitive ? toText(raw) : toText(raw).toLowerCase();
          return text.includes(searchValue);
        });

        if (!matches) {
          continue;
        }
      }

      decorated.push({ row, index });
    }

    const sortRules = Array.isArray(sort) ? sort : [];
    if (sortRules.length > 0) {
      decorated.sort((left, right) => {
        for (const rule of sortRules) {
          const column = this.columnById.get(rule.id);
          if (!column || !column.sortable) {
            continue;
          }

          const direction = rule.direction === "desc" ? "desc" : "asc";
          const result = compareValues(column.getValue(left.row), column.getValue(right.row), direction);
          if (result !== 0) {
            return result;
          }
        }

        // Stable sort fallback for deterministic UI.
        return left.index - right.index;
      });
    }

    const filteredRows = decorated.map((item) => item.row);
    const filteredCount = filteredRows.length;

    if (!pagination) {
      return {
        rows: filteredRows,
        filteredCount,
        totalCount: this.rows.length,
        totalPages: filteredCount === 0 ? 0 : 1,
        page: 0
      };
    }

    const safePageSize = Number(pageSize) > 0 ? Number(pageSize) : 25;
    const totalPages = filteredCount === 0 ? 0 : Math.ceil(filteredCount / safePageSize);
    const safePage = totalPages === 0 ? 0 : Math.min(Math.max(page, 0), totalPages - 1);
    const start = safePage * safePageSize;
    const end = start + safePageSize;

    return {
      rows: filteredRows.slice(start, end),
      filteredCount,
      totalCount: this.rows.length,
      totalPages,
      page: safePage
    };
  }
}
