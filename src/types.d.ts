export type SortDirection = "asc" | "desc";

export interface SortRule {
  id: string;
  direction: SortDirection;
}

export interface RenderContext<Row> {
  rowIndex: number;
  colIndex: number;
  column: BetterDataTableColumn<Row>;
  table: BetterDataTable<Row>;
}

export type RenderResult =
  | string
  | number
  | null
  | undefined
  | Node
  | { text: string | number | null | undefined }
  | { html: string };

export interface BetterDataTableColumn<Row = Record<string, unknown>> {
  id?: string;
  header?: string;
  accessor?: keyof Row | string | ((row: Row) => unknown);
  sortable?: boolean;
  searchable?: boolean;
  className?: string;
  width?: string;
  wrap?: boolean;
  render?: (value: unknown, row: Row, context: RenderContext<Row>) => RenderResult;
}

export interface BetterDataTableOptions<Row = Record<string, unknown>> {
  columns: BetterDataTableColumn<Row>[];
  data?: Row[];
  caption?: string;
  rowKey?: keyof Row | string | ((row: Row, rowIndex: number) => string | number);
  emptyMessage?: string;
  pagination?: {
    enabled?: boolean;
    pageSize?: number;
    pageSizes?: number[];
  };
  filtering?: {
    caseSensitive?: boolean;
    debounceMs?: number;
  };
  sorting?: {
    multi?: boolean;
    initial?: SortRule[];
  };
  virtualization?: {
    enabled?: boolean;
    height?: number;
    rowHeight?: number;
    overscan?: number;
  };
  scroll?: {
    x?: boolean;
    y?: boolean;
    minColumnWidth?: number | string;
  };
  state?: {
    enabled?: boolean;
    key?: string;
  };
  a11y?: {
    keyboard?: boolean;
    announce?: boolean;
    label?: string;
  };
  security?: {
    allowUnsafeHtml?: boolean;
    sanitizer?: (html: string, context: { rowData: Row; rowIndex: number; colIndex: number; column: BetterDataTableColumn<Row> }) => string;
  };
  server?: {
    enabled?: boolean;
    fetch?: (query: { search: string; sort: SortRule[]; page: number; pageSize: number }) => Promise<{
      rows: Row[];
      totalCount?: number;
      filteredCount?: number;
    }>;
  };
  hooks?: Partial<Record<
    | "beforeInit"
    | "afterInit"
    | "beforeQuery"
    | "afterQuery"
    | "beforeRender"
    | "afterRender"
    | "error"
    | "stateChange"
    | "dataLoaded",
    (payload: unknown) => void
  >>;
  layout?: {
    topStart?: Array<"search" | "pageSize" | "info" | "pager">;
    topEnd?: Array<"search" | "pageSize" | "info" | "pager">;
    bottomStart?: Array<"search" | "pageSize" | "info" | "pager">;
    bottomEnd?: Array<"search" | "pageSize" | "info" | "pager">;
  };
}

export declare class BetterDataTable<Row = Record<string, unknown>> {
  constructor(target: HTMLElement | string, options: BetterDataTableOptions<Row>);

  setData(rows: Row[], options?: { preservePage?: boolean; emitEvent?: boolean }): void;
  reload(options?: { preservePage?: boolean }): Promise<void>;
  setSearch(search: string): void;
  setPage(page: number): void;
  setPageSize(pageSize: number): void;
  setSort(columnId: string, direction?: SortDirection, options?: { add?: boolean }): void;
  toggleSort(columnId: string, options?: { add?: boolean }): void;
  clearState(): void;
  getState(): {
    search: string;
    sort: SortRule[];
    page: number;
    pageSize: number;
    scrollTop: number;
  };
  getRows(): Row[];
  getVisibleRows(): Row[];
  on(eventName: string, handler: (payload: unknown) => void): () => void;
  off(eventName: string, handler: (payload: unknown) => void): void;
  onCell(
    eventName: string,
    selector: string,
    handler: (context: {
      event: Event;
      match: Element;
      cell: HTMLTableCellElement | null;
      rowIndex: number;
      colIndex: number;
      rowData: Row | undefined;
      table: BetterDataTable<Row>;
    }) => void
  ): () => void;
  destroy(): void;
}

export declare function createBetterDataTable<Row = Record<string, unknown>>(
  target: HTMLElement | string,
  options: BetterDataTableOptions<Row>
): BetterDataTable<Row>;
