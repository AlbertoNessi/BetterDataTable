import { EventBus } from "./EventBus.js";
import { QueryEngine } from "./QueryEngine.js";
import { StateStore } from "./StateStore.js";
import { clamp, debounce, deepMerge, isDomNode, parseAccessor, toText, uniqueId } from "./utils.js";

const DEFAULT_OPTIONS = {
  columns: [],
  data: [],
  caption: "",
  rowKey: null,
  emptyMessage: "No rows found",
  layout: {
    topStart: ["search"],
    topEnd: ["pageSize"],
    bottomStart: ["info"],
    bottomEnd: ["pager"]
  },
  pagination: {
    enabled: true,
    pageSize: 25,
    pageSizes: [10, 25, 50, 100]
  },
  filtering: {
    caseSensitive: false,
    debounceMs: 150
  },
  sorting: {
    multi: true,
    initial: []
  },
  virtualization: {
    enabled: true,
    height: 420,
    rowHeight: 40,
    overscan: 8
  },
  state: {
    enabled: true,
    key: null
  },
  a11y: {
    keyboard: true,
    announce: true,
    label: "Data table"
  },
  security: {
    allowUnsafeHtml: false,
    sanitizer: null
  },
  server: {
    enabled: false,
    fetch: null
  },
  hooks: {}
};

function normalizeColumns(columns) {
  return (columns || []).map((column, index) => {
    const id = column.id || column.accessor || `col_${index}`;
    return {
      ...column,
      id,
      header: column.header || id,
      getValue: parseAccessor(column.accessor)
    };
  });
}

function resolveElement(target) {
  if (typeof target === "string") {
    const element = document.querySelector(target);
    if (!element) {
      throw new Error(`BetterDataTable: target not found for selector \"${target}\"`);
    }
    return element;
  }

  if (!target || !(target instanceof HTMLElement)) {
    throw new Error("BetterDataTable: target must be a DOM element or a selector string");
  }

  return target;
}

export class BetterDataTable {
  constructor(target, options = {}) {
    this.root = resolveElement(target);

    this.options = deepMerge(DEFAULT_OPTIONS, options);
    this.options.columns = normalizeColumns(this.options.columns);
    const statePath = typeof location === "undefined" ? "memory" : location.pathname;
    this.options.state.key =
      this.options.state.key ||
      this.root.getAttribute("data-bdt-state-key") ||
      `${statePath}::${this.root.id || uniqueId("table")}`;

    if (this.options.server.enabled && typeof this.options.server.fetch !== "function") {
      throw new Error("BetterDataTable: options.server.fetch must be a function in server mode");
    }

    this.events = new EventBus();
    this.store = new StateStore(this.options.state);
    this.queryEngine = new QueryEngine({
      columns: this.options.columns,
      caseSensitive: this.options.filtering.caseSensitive
    });

    this.data = [];
    this.serverSnapshot = {
      rows: [],
      totalCount: 0,
      filteredCount: 0
    };

    this.state = this.store.load({
      search: "",
      sort: [...this.options.sorting.initial],
      page: 0,
      pageSize: this.options.pagination.pageSize,
      scrollTop: 0
    });

    this.renderResult = {
      totalCount: 0,
      filteredCount: 0,
      pageRows: [],
      visibleRows: [],
      page: 0,
      totalPages: 0,
      startRowIndex: 0,
      endRowIndex: 0,
      topPad: 0,
      bottomPad: 0
    };

    this.lastFocusedCell = null;
    this.needsDomFocus = false;
    this.renderToken = null;
    this.pendingReasons = new Set();
    this.requestToken = 0;
    this.listeners = [];
    this.cellDelegates = [];

    this.#init();
  }

  #init() {
    this.#emit("beforeInit", { table: this });

    this.root.classList.add("bdt-host");
    this.root.replaceChildren();

    this.#buildShell();
    this.#renderHeader();
    this.#attachCoreListeners();

    if (Array.isArray(this.options.data)) {
      this.setData(this.options.data, { preservePage: true, emitEvent: false });
    } else {
      this.queryEngine.setRows([]);
      this.requestRender("init-empty");
    }

    if (this.options.server.enabled) {
      this.reload({ preservePage: true });
    }

    this.#emit("afterInit", { table: this });
  }

  #buildShell() {
    this.container = document.createElement("section");
    this.container.className = "bdt";
    this.container.setAttribute("aria-label", this.options.a11y.label);

    this.controls = this.#createControls();

    this.top = this.#createBar(this.options.layout.topStart, this.options.layout.topEnd, "top");
    this.bottom = this.#createBar(this.options.layout.bottomStart, this.options.layout.bottomEnd, "bottom");

    this.tableWrap = document.createElement("div");
    this.tableWrap.className = "bdt__table-wrap";
    this.tableWrap.tabIndex = 0;

    if (this.options.virtualization.enabled) {
      this.tableWrap.style.maxHeight = `${this.options.virtualization.height}px`;
      this.tableWrap.style.overflow = "auto";
    }

    this.table = document.createElement("table");
    this.table.className = "bdt__table";
    this.table.setAttribute("role", "grid");

    if (this.options.caption) {
      const caption = document.createElement("caption");
      caption.textContent = this.options.caption;
      this.table.append(caption);
    }

    this.head = document.createElement("thead");
    this.body = document.createElement("tbody");

    this.table.append(this.head, this.body);
    this.tableWrap.append(this.table);

    this.liveRegion = document.createElement("p");
    this.liveRegion.className = "bdt__sr-only";
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");

    this.container.append(this.top, this.tableWrap, this.bottom, this.liveRegion);
    this.root.append(this.container);
  }

  #createControls() {
    const searchWrap = document.createElement("label");
    searchWrap.className = "bdt__control bdt__control--search";

    const searchLabel = document.createElement("span");
    searchLabel.className = "bdt__label";
    searchLabel.textContent = "Search";

    this.searchInput = document.createElement("input");
    this.searchInput.type = "search";
    this.searchInput.className = "bdt__input";
    this.searchInput.placeholder = "Type to filter rows";
    this.searchInput.autocomplete = "off";

    searchWrap.append(searchLabel, this.searchInput);

    const pageSizeWrap = document.createElement("label");
    pageSizeWrap.className = "bdt__control bdt__control--size";

    const sizeLabel = document.createElement("span");
    sizeLabel.className = "bdt__label";
    sizeLabel.textContent = "Rows";

    this.pageSizeSelect = document.createElement("select");
    this.pageSizeSelect.className = "bdt__select";

    const sizes = this.options.pagination.pageSizes || [];
    for (const size of sizes) {
      const option = document.createElement("option");
      option.value = String(size);
      option.textContent = String(size);
      this.pageSizeSelect.append(option);
    }

    pageSizeWrap.append(sizeLabel, this.pageSizeSelect);

    this.info = document.createElement("p");
    this.info.className = "bdt__info";

    this.pager = document.createElement("nav");
    this.pager.className = "bdt__pager";
    this.pager.setAttribute("aria-label", "Pagination");

    this.prevPageButton = document.createElement("button");
    this.prevPageButton.type = "button";
    this.prevPageButton.className = "bdt__btn";
    this.prevPageButton.textContent = "Previous";
    this.prevPageButton.setAttribute("data-bdt-page", "prev");

    this.pageStatus = document.createElement("span");
    this.pageStatus.className = "bdt__page-status";

    this.nextPageButton = document.createElement("button");
    this.nextPageButton.type = "button";
    this.nextPageButton.className = "bdt__btn";
    this.nextPageButton.textContent = "Next";
    this.nextPageButton.setAttribute("data-bdt-page", "next");

    this.pager.append(this.prevPageButton, this.pageStatus, this.nextPageButton);

    return {
      search: searchWrap,
      pageSize: pageSizeWrap,
      info: this.info,
      pager: this.pager
    };
  }

  #createBar(startTokens = [], endTokens = [], position) {
    const bar = document.createElement("div");
    bar.className = `bdt__bar bdt__bar--${position}`;

    const start = document.createElement("div");
    start.className = "bdt__slot bdt__slot--start";

    const end = document.createElement("div");
    end.className = "bdt__slot bdt__slot--end";

    for (const token of startTokens || []) {
      const control = this.controls[token];
      if (control) {
        start.append(control);
      }
    }

    for (const token of endTokens || []) {
      const control = this.controls[token];
      if (control) {
        end.append(control);
      }
    }

    bar.append(start, end);
    return bar;
  }

  #renderHeader() {
    const row = document.createElement("tr");

    for (const column of this.options.columns) {
      const th = document.createElement("th");
      th.scope = "col";
      th.setAttribute("data-bdt-col-id", column.id);

      if (column.width) {
        th.style.width = column.width;
      }

      if (column.sortable === false) {
        th.textContent = column.header;
        th.setAttribute("aria-sort", "none");
      } else {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "bdt__sort-btn";
        button.textContent = column.header;
        button.setAttribute("data-bdt-sort", column.id);
        button.setAttribute("aria-label", `${column.header}, activate to sort ascending`);
        th.setAttribute("aria-sort", "none");
        th.append(button);
      }

      row.append(th);
    }

    this.head.replaceChildren(row);
    this.#updateSortA11y();
  }

  #attachCoreListeners() {
    const onSearch = debounce((event) => {
      this.setSearch(event.target.value);
    }, this.options.filtering.debounceMs);

    this.#listen(this.searchInput, "input", onSearch);

    this.#listen(this.pageSizeSelect, "change", (event) => {
      this.setPageSize(Number(event.target.value));
    });

    this.#listen(this.pager, "click", (event) => {
      const button = event.target.closest("button[data-bdt-page]");
      if (!button) {
        return;
      }

      const dir = button.getAttribute("data-bdt-page");
      if (dir === "prev") {
        this.setPage(this.state.page - 1);
      }
      if (dir === "next") {
        this.setPage(this.state.page + 1);
      }
    });

    this.#listen(this.head, "click", (event) => {
      const button = event.target.closest("button[data-bdt-sort]");
      if (!button) {
        return;
      }

      const columnId = button.getAttribute("data-bdt-sort");
      this.toggleSort(columnId, { add: event.shiftKey && this.options.sorting.multi });
    });

    this.#listen(this.body, "focusin", (event) => {
      const cell = event.target.closest("td[data-row-index][data-col-index]");
      if (!cell) {
        return;
      }

      this.lastFocusedCell = {
        row: Number(cell.dataset.rowIndex),
        col: Number(cell.dataset.colIndex)
      };
      this.#applyCellTabStops();
    });

    this.#listen(this.body, "click", (event) => {
      const cell = event.target.closest("td[data-row-index][data-col-index]");
      if (!cell) {
        return;
      }

      this.lastFocusedCell = {
        row: Number(cell.dataset.rowIndex),
        col: Number(cell.dataset.colIndex)
      };
      this.needsDomFocus = true;
      this.#applyCellTabStops();
    });

    if (this.options.a11y.keyboard) {
      this.#listen(this.body, "keydown", (event) => this.#handleGridKeyboard(event));
    }

    if (this.options.virtualization.enabled) {
      this.#listen(this.tableWrap, "scroll", () => {
        this.state.scrollTop = this.tableWrap.scrollTop;
        this.requestRender("scroll");
      });
    }
  }

  #listen(element, eventName, handler, options = undefined) {
    element.addEventListener(eventName, handler, options);
    this.listeners.push(() => element.removeEventListener(eventName, handler, options));
  }

  #computeRenderResult() {
    if (this.options.server.enabled) {
      const pageRows = this.serverSnapshot.rows;
      const filteredCount = this.serverSnapshot.filteredCount;
      const totalCount = this.serverSnapshot.totalCount;
      const safePageSize = Math.max(1, Number(this.state.pageSize) || 1);
      const totalPages = this.options.pagination.enabled
        ? filteredCount === 0
          ? 0
          : Math.ceil(filteredCount / safePageSize)
        : filteredCount === 0
          ? 0
          : 1;

      return {
        pageRows,
        filteredCount,
        totalCount,
        totalPages,
        page: clamp(this.state.page, 0, Math.max(0, totalPages - 1))
      };
    }

    const query = this.queryEngine.run({
      search: this.state.search,
      sort: this.state.sort,
      page: this.state.page,
      pageSize: this.state.pageSize,
      pagination: this.options.pagination.enabled
    });

    return {
      pageRows: query.rows,
      filteredCount: query.filteredCount,
      totalCount: query.totalCount,
      totalPages: query.totalPages,
      page: query.page
    };
  }

  #computeVirtualWindow(pageRows) {
    if (!this.options.virtualization.enabled) {
      return {
        visibleRows: pageRows,
        startRowIndex: 0,
        endRowIndex: pageRows.length,
        topPad: 0,
        bottomPad: 0
      };
    }

    const rowHeight = Math.max(24, this.options.virtualization.rowHeight);
    const overscan = Math.max(1, this.options.virtualization.overscan);
    const viewportHeight = Math.max(rowHeight, this.options.virtualization.height);
    const rowsPerViewport = Math.ceil(viewportHeight / rowHeight);

    const maxStart = Math.max(0, pageRows.length - rowsPerViewport);
    const startRowIndex = clamp(Math.floor(this.state.scrollTop / rowHeight) - overscan, 0, maxStart);
    const endRowIndex = clamp(startRowIndex + rowsPerViewport + overscan * 2, 0, pageRows.length);

    return {
      visibleRows: pageRows.slice(startRowIndex, endRowIndex),
      startRowIndex,
      endRowIndex,
      topPad: startRowIndex * rowHeight,
      bottomPad: Math.max(0, (pageRows.length - endRowIndex) * rowHeight)
    };
  }

  #renderBody() {
    const {
      pageRows,
      visibleRows,
      startRowIndex,
      topPad,
      bottomPad
    } = this.renderResult;

    const fragment = document.createDocumentFragment();

    if (pageRows.length === 0) {
      const row = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = this.options.columns.length;
      td.className = "bdt__empty";
      td.textContent = this.options.emptyMessage;
      row.append(td);
      fragment.append(row);
      this.body.replaceChildren(fragment);
      return;
    }

    if (topPad > 0) {
      fragment.append(this.#createSpacerRow(topPad));
    }

    visibleRows.forEach((rowData, visibleIndex) => {
      const pageRowIndex = startRowIndex + visibleIndex;
      const tr = document.createElement("tr");
      tr.setAttribute("data-row-index", String(pageRowIndex));

      const rowKey = this.#resolveRowKey(rowData, pageRowIndex);
      tr.setAttribute("data-row-key", rowKey);

      this.options.columns.forEach((column, colIndex) => {
        const td = document.createElement("td");
        td.className = column.className || "";
        td.setAttribute("data-row-index", String(pageRowIndex));
        td.setAttribute("data-col-index", String(colIndex));
        td.tabIndex = -1;

        const value = column.getValue(rowData);
        this.#renderCellContent(td, column, value, rowData, pageRowIndex, colIndex);
        tr.append(td);
      });

      fragment.append(tr);
    });

    if (bottomPad > 0) {
      fragment.append(this.#createSpacerRow(bottomPad));
    }

    this.body.replaceChildren(fragment);
    this.#applyCellTabStops();

    if (this.needsDomFocus) {
      this.needsDomFocus = false;
      this.#focusCurrentCell();
    }
  }

  #resolveRowKey(rowData, rowIndex) {
    if (typeof this.options.rowKey === "function") {
      return toText(this.options.rowKey(rowData, rowIndex));
    }

    if (typeof this.options.rowKey === "string") {
      return toText(rowData?.[this.options.rowKey]);
    }

    return toText(rowIndex);
  }

  #createSpacerRow(height) {
    const tr = document.createElement("tr");
    tr.className = "bdt__spacer";
    tr.setAttribute("aria-hidden", "true");

    const td = document.createElement("td");
    td.colSpan = this.options.columns.length;
    td.style.height = `${height}px`;

    tr.append(td);
    return tr;
  }

  #renderCellContent(td, column, value, rowData, rowIndex, colIndex) {
    if (typeof column.render !== "function") {
      td.textContent = toText(value);
      return;
    }

    let rendered;
    try {
      rendered = column.render(value, rowData, {
        rowIndex,
        colIndex,
        column,
        table: this
      });
    } catch (error) {
      this.#emit("error", {
        type: "render",
        column: column.id,
        error
      });
      td.textContent = toText(value);
      return;
    }

    if (isDomNode(rendered)) {
      td.append(rendered);
      return;
    }

    if (rendered && typeof rendered === "object") {
      if (Object.prototype.hasOwnProperty.call(rendered, "text")) {
        td.textContent = toText(rendered.text);
        return;
      }

      if (Object.prototype.hasOwnProperty.call(rendered, "html")) {
        if (!this.options.security.allowUnsafeHtml) {
          td.textContent = toText(rendered.html);
          this.#emit("error", {
            type: "security",
            column: column.id,
            message: "Unsafe HTML rendering blocked. Enable security.allowUnsafeHtml to allow raw HTML."
          });
          return;
        }

        const unsafeHtml = toText(rendered.html);
        const sanitized =
          typeof this.options.security.sanitizer === "function"
            ? this.options.security.sanitizer(unsafeHtml, {
                rowData,
                rowIndex,
                colIndex,
                column
              })
            : unsafeHtml;

        td.innerHTML = sanitized;
        return;
      }
    }

    td.textContent = toText(rendered);
  }

  #updateControls() {
    this.searchInput.value = this.state.search;
    this.pageSizeSelect.value = String(this.state.pageSize);

    const {
      filteredCount,
      totalCount,
      page,
      totalPages,
      pageRows,
      startRowIndex,
      endRowIndex
    } = this.renderResult;

    if (pageRows.length === 0) {
      this.info.textContent = `Showing 0 rows`;
    } else {
      const safePageSize = Math.max(1, Number(this.state.pageSize) || 1);
      const pageOffset = this.options.pagination.enabled ? page * safePageSize : 0;
      const start = pageOffset + (this.options.virtualization.enabled ? startRowIndex + 1 : 1);
      const end = pageOffset + (this.options.virtualization.enabled ? endRowIndex : pageRows.length);
      this.info.textContent = `Showing ${start}-${end} of ${filteredCount} rows (${totalCount} total)`;
    }

    this.pageStatus.textContent = totalPages === 0 ? "Page 0 of 0" : `Page ${page + 1} of ${totalPages}`;

    const atStart = page <= 0;
    const atEnd = totalPages === 0 || page >= totalPages - 1;

    this.prevPageButton.disabled = atStart;
    this.nextPageButton.disabled = atEnd;
  }

  #updateSortA11y() {
    const sortMap = new Map(this.state.sort.map((item) => [item.id, item.direction]));

    for (const th of this.head.querySelectorAll("th[data-bdt-col-id]")) {
      const columnId = th.getAttribute("data-bdt-col-id");
      const direction = sortMap.get(columnId) || "none";

      const ariaSort = direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
      th.setAttribute("aria-sort", ariaSort);

      const button = th.querySelector("button[data-bdt-sort]");
      if (!button) {
        continue;
      }

      const next = direction === "asc" ? "descending" : "ascending";
      button.setAttribute("aria-label", `${button.textContent}, activate to sort ${next}`);
      button.dataset.sortDirection = direction;
    }
  }

  #applyCellTabStops() {
    const cells = this.body.querySelectorAll("td[data-row-index][data-col-index]");
    if (cells.length === 0) {
      return;
    }

    for (const cell of cells) {
      cell.tabIndex = -1;
    }

    let target = null;
    if (this.lastFocusedCell) {
      target = this.body.querySelector(
        `td[data-row-index=\"${this.lastFocusedCell.row}\"][data-col-index=\"${this.lastFocusedCell.col}\"]`
      );
    }

    if (!target) {
      target = cells[0];
      this.lastFocusedCell = {
        row: Number(target.dataset.rowIndex),
        col: Number(target.dataset.colIndex)
      };
    }

    target.tabIndex = 0;
  }

  #focusCurrentCell() {
    if (!this.lastFocusedCell) {
      return;
    }

    const target = this.body.querySelector(
      `td[data-row-index=\"${this.lastFocusedCell.row}\"][data-col-index=\"${this.lastFocusedCell.col}\"]`
    );

    if (target) {
      target.focus();
    }
  }

  #handleGridKeyboard(event) {
    const cell = event.target.closest("td[data-row-index][data-col-index]");
    if (!cell) {
      return;
    }

    const row = Number(cell.dataset.rowIndex);
    const col = Number(cell.dataset.colIndex);
    const lastRow = this.renderResult.pageRows.length - 1;
    const lastCol = this.options.columns.length - 1;

    let nextRow = row;
    let nextCol = col;

    switch (event.key) {
      case "ArrowUp":
        nextRow = Math.max(0, row - 1);
        break;
      case "ArrowDown":
        nextRow = Math.min(lastRow, row + 1);
        break;
      case "ArrowLeft":
        nextCol = Math.max(0, col - 1);
        break;
      case "ArrowRight":
        nextCol = Math.min(lastCol, col + 1);
        break;
      case "Home":
        nextCol = 0;
        break;
      case "End":
        nextCol = lastCol;
        break;
      default:
        return;
    }

    event.preventDefault();

    this.lastFocusedCell = { row: nextRow, col: nextCol };
    this.needsDomFocus = true;

    if (this.options.virtualization.enabled) {
      const rowHeight = Math.max(24, this.options.virtualization.rowHeight);
      const topVisible = Math.floor(this.state.scrollTop / rowHeight);
      const rowsVisible = Math.ceil(this.options.virtualization.height / rowHeight);
      const bottomVisible = topVisible + rowsVisible;

      if (nextRow < topVisible || nextRow > bottomVisible) {
        this.state.scrollTop = nextRow * rowHeight;
        this.tableWrap.scrollTop = this.state.scrollTop;
      }
    }

    this.requestRender("keyboard-nav");
  }

  #announce() {
    if (!this.options.a11y.announce) {
      return;
    }

    const { pageRows, page, totalPages, filteredCount } = this.renderResult;
    if (pageRows.length === 0) {
      this.liveRegion.textContent = "No rows found";
      return;
    }

    this.liveRegion.textContent = `Loaded page ${page + 1} of ${Math.max(totalPages, 1)}. ${filteredCount} rows available.`;
  }

  #render(reason = "unknown") {
    const startTime = performance.now();
    this.#emit("beforeRender", { reason, state: this.getState() });

    const baseResult = this.#computeRenderResult();

    this.state.page = baseResult.page;
    this.#persistState();

    const virtualWindow = this.#computeVirtualWindow(baseResult.pageRows);
    this.renderResult = {
      ...baseResult,
      ...virtualWindow
    };

    this.#updateSortA11y();
    this.#renderBody();
    this.#updateControls();
    this.#announce();

    const duration = performance.now() - startTime;
    this.#emit("afterRender", {
      reason,
      duration,
      rowsRendered: this.renderResult.visibleRows.length,
      totalRows: this.renderResult.filteredCount
    });
  }

  #persistState() {
    this.store.save({
      search: this.state.search,
      sort: this.state.sort,
      page: this.state.page,
      pageSize: this.state.pageSize,
      scrollTop: this.state.scrollTop
    });
  }

  #emit(eventName, payload) {
    this.events.emit(eventName, payload);

    const hook = this.options.hooks?.[eventName];
    if (typeof hook === "function") {
      hook(payload);
    }
  }

  #shouldQueryServer(reason) {
    return this.options.server.enabled && ["search", "sort", "page", "page-size", "reload"].includes(reason);
  }

  #buildServerQuery() {
    return {
      search: this.state.search,
      sort: this.state.sort,
      page: this.state.page,
      pageSize: this.state.pageSize
    };
  }

  requestRender(reason = "manual") {
    this.pendingReasons.add(reason);
    if (this.renderToken !== null) {
      return;
    }

    this.renderToken = requestAnimationFrame(() => {
      this.renderToken = null;
      const reasons = [...this.pendingReasons];
      this.pendingReasons.clear();
      this.#render(reasons.join(", "));
    });
  }

  setData(rows, { preservePage = true, emitEvent = true } = {}) {
    this.data = Array.isArray(rows) ? rows : [];
    this.queryEngine.setRows(this.data);

    if (!preservePage) {
      this.state.page = 0;
      this.state.scrollTop = 0;
      this.tableWrap.scrollTop = 0;
    }

    if (emitEvent) {
      this.#emit("dataLoaded", {
        rows: this.data.length,
        source: "client"
      });
    }

    this.requestRender("set-data");
  }

  async reload({ preservePage = true } = {}) {
    if (!preservePage) {
      this.state.page = 0;
    }

    if (!this.options.server.enabled) {
      this.requestRender("reload");
      return;
    }

    const query = this.#buildServerQuery();
    const token = ++this.requestToken;

    this.#emit("beforeQuery", { query, token });

    try {
      const result = await this.options.server.fetch(query, {
        table: this,
        state: this.getState()
      });

      if (token !== this.requestToken) {
        return;
      }

      const rows = Array.isArray(result?.rows) ? result.rows : [];
      const filteredCount = Number(result?.filteredCount ?? rows.length);
      const totalCount = Number(result?.totalCount ?? filteredCount);

      this.serverSnapshot = {
        rows,
        filteredCount,
        totalCount
      };

      this.#emit("afterQuery", {
        query,
        token,
        result: {
          rows: rows.length,
          filteredCount,
          totalCount
        }
      });

      this.requestRender("reload");
    } catch (error) {
      this.#emit("error", {
        type: "query",
        token,
        query,
        error
      });
    }
  }

  setSearch(search) {
    this.state.search = toText(search);
    this.state.page = 0;
    this.state.scrollTop = 0;
    this.tableWrap.scrollTop = 0;
    this.#persistState();
    this.#emit("stateChange", { reason: "search", state: this.getState() });

    if (this.#shouldQueryServer("search")) {
      this.reload({ preservePage: true });
      return;
    }

    this.requestRender("search");
  }

  setPage(page) {
    this.state.page = Math.max(0, Number(page) || 0);
    this.state.scrollTop = 0;
    this.tableWrap.scrollTop = 0;
    this.#persistState();
    this.#emit("stateChange", { reason: "page", state: this.getState() });

    if (this.#shouldQueryServer("page")) {
      this.reload({ preservePage: true });
      return;
    }

    this.requestRender("page");
  }

  setPageSize(pageSize) {
    const nextSize = Number(pageSize) > 0 ? Number(pageSize) : this.options.pagination.pageSize;
    this.state.pageSize = nextSize;
    this.state.page = 0;
    this.state.scrollTop = 0;
    this.tableWrap.scrollTop = 0;
    this.#persistState();
    this.#emit("stateChange", { reason: "page-size", state: this.getState() });

    if (this.#shouldQueryServer("page-size")) {
      this.reload({ preservePage: true });
      return;
    }

    this.requestRender("page-size");
  }

  setSort(columnId, direction = "asc", { add = false } = {}) {
    const normalized = direction === "desc" ? "desc" : "asc";

    if (!add || !this.options.sorting.multi) {
      this.state.sort = [{ id: columnId, direction: normalized }];
    } else {
      const existing = this.state.sort.findIndex((rule) => rule.id === columnId);
      if (existing >= 0) {
        this.state.sort[existing] = { id: columnId, direction: normalized };
      } else {
        this.state.sort.push({ id: columnId, direction: normalized });
      }
    }

    this.state.page = 0;
    this.#persistState();
    this.#emit("stateChange", { reason: "sort", state: this.getState() });

    if (this.#shouldQueryServer("sort")) {
      this.reload({ preservePage: true });
      return;
    }

    this.requestRender("sort");
  }

  toggleSort(columnId, { add = false } = {}) {
    const existing = this.state.sort.find((rule) => rule.id === columnId);

    if (!existing) {
      this.setSort(columnId, "asc", { add });
      return;
    }

    if (existing.direction === "asc") {
      this.setSort(columnId, "desc", { add });
      return;
    }

    this.state.sort = this.state.sort.filter((rule) => rule.id !== columnId);
    if (!add || !this.options.sorting.multi) {
      this.state.sort = [];
    }

    this.state.page = 0;
    this.#persistState();
    this.#emit("stateChange", { reason: "sort", state: this.getState() });

    if (this.#shouldQueryServer("sort")) {
      this.reload({ preservePage: true });
      return;
    }

    this.requestRender("sort");
  }

  clearState() {
    this.store.clear();
    this.state = {
      search: "",
      sort: [...this.options.sorting.initial],
      page: 0,
      pageSize: this.options.pagination.pageSize,
      scrollTop: 0
    };

    this.searchInput.value = "";
    this.tableWrap.scrollTop = 0;

    if (this.options.server.enabled) {
      this.reload({ preservePage: true });
      return;
    }

    this.requestRender("clear-state");
  }

  getState() {
    return {
      search: this.state.search,
      sort: [...this.state.sort],
      page: this.state.page,
      pageSize: this.state.pageSize,
      scrollTop: this.state.scrollTop
    };
  }

  getRows() {
    return [...this.renderResult.pageRows];
  }

  getVisibleRows() {
    return [...this.renderResult.visibleRows];
  }

  on(eventName, handler) {
    return this.events.on(eventName, handler);
  }

  off(eventName, handler) {
    this.events.off(eventName, handler);
  }

  onCell(eventName, selector, handler) {
    const listener = (event) => {
      const match = event.target.closest(selector);
      if (!match || !this.body.contains(match)) {
        return;
      }

      const cell = match.closest("td[data-row-index][data-col-index]");
      const rowIndex = cell ? Number(cell.dataset.rowIndex) : -1;
      const colIndex = cell ? Number(cell.dataset.colIndex) : -1;
      const rowData = this.renderResult.pageRows[rowIndex];
      handler({
        event,
        match,
        cell,
        rowIndex,
        colIndex,
        rowData,
        table: this
      });
    };

    this.body.addEventListener(eventName, listener);
    const destroy = () => this.body.removeEventListener(eventName, listener);
    this.cellDelegates.push(destroy);
    return destroy;
  }

  destroy() {
    if (this.renderToken !== null) {
      cancelAnimationFrame(this.renderToken);
      this.renderToken = null;
    }

    for (const cleanup of this.listeners) {
      cleanup();
    }
    this.listeners = [];

    for (const cleanup of this.cellDelegates) {
      cleanup();
    }
    this.cellDelegates = [];

    this.events.clear();

    this.root.replaceChildren();
    this.root.classList.remove("bdt-host");
  }
}
