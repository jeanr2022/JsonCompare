// Type definitions for json-compare

// --- Shared types ---

export interface Stats {
  equal: number;
  added: number;
  removed: number;
  changed: number;
  total: number;
}

export interface LinePair {
  /** Left-side text, or null if the line is missing/empty on the left */
  left: string | null;
  /** Right-side text, or null if the line is missing/empty on the right */
  right: string | null;
  /** Diff type for this line pair */
  type: 'equal' | 'added' | 'removed' | 'changed';
}

export interface DiffNode {
  type: 'equal' | 'added' | 'removed' | 'changed' | 'object' | 'array';
  [key: string]: unknown;
}

export interface CompareOptions {
  /** Sort object keys alphabetically. Default: false (preserves original order). */
  sortKeys?: boolean;
  /**
   * Consecutive equal lines before collapsing in HTML output.
   * 0 = fold all unchanged sections. Infinity = no folding. Default: 5.
   */
  foldThreshold?: number;
  /** Enable JSON syntax highlighting in HTML output. Default: true. */
  syntaxHighlight?: boolean;
}

export interface RenderOptions {
  /**
   * Consecutive equal lines before collapsing.
   * 0 = fold all. Infinity = no folding. Default: 5.
   */
  foldThreshold?: number;
  /** Enable JSON syntax highlighting. Default: true. */
  syntaxHighlight?: boolean;
}

export interface CompareResult {
  linePairs: LinePair[];
  diffTree: DiffNode;
  stats: Stats;
}

export interface CompareAndRenderResult extends CompareResult {
  html: string;
}

// --- Core API ---

/**
 * Compare two JSON values and produce aligned line pairs + diff tree.
 * Accepts JSON strings or already-parsed objects.
 */
export function compare(
  a: string | object,
  b: string | object,
  options?: CompareOptions
): CompareResult;

/**
 * Compare two JSON values and render a side-by-side HTML diff.
 * Convenience function combining compare() + renderHTML().
 */
export function compareAndRender(
  a: string | object,
  b: string | object,
  options?: CompareOptions & RenderOptions
): CompareAndRenderResult;

// --- Building blocks ---

/** Recursive structural diff engine. */
export function diffValues(a: unknown, b: unknown, sortKeys?: boolean): DiffNode;

/** Deep equality check for JSON-compatible values. */
export function deepEqual(a: unknown, b: unknown): boolean;

/** Convert a diff tree into aligned line pairs for side-by-side display. */
export function alignLines(diffTree: DiffNode): LinePair[];

/** Count line types from an array of line pairs. */
export function computeStats(linePairs: LinePair[]): Stats;

/** Render line pairs into a side-by-side HTML table string. */
export function renderHTML(linePairs: LinePair[], options?: RenderOptions): string;

/** Apply syntax highlighting to a single JSON text line. Returns HTML string. */
export function highlightLine(line: string): string;

/** Escape HTML special characters (&, <, >, ", '). */
export function escapeHtml(text: string): string;

/**
 * Longest Common Subsequence algorithm.
 * Returns an array of matched index pairs.
 */
export function lcs<T>(
  a: T[],
  b: T[],
  eq: (x: T, y: T) => boolean
): Array<{ aIndex: number; bIndex: number }>;

// --- Virtual Scroll (browser-only, optional) ---

export interface VScrollOptions {
  /** Fixed row height in px. Default: 20. */
  rowHeight?: number;
  /** Extra rows rendered above/below viewport. Default: 20. */
  overscan?: number;
  /** Enable syntax highlighting. Default: true. */
  syntaxHighlight?: boolean;
}

export class VirtualScrollRenderer {
  readonly rowHeight: number;
  readonly scrollContainer: HTMLDivElement;

  constructor(container: HTMLElement, options?: VScrollOptions);

  /** Set the line pairs to display and trigger initial render. */
  setData(linePairs: LinePair[]): void;

  /**
   * Scroll to the first line matching a given type after the specified index.
   * Returns the index scrolled to, or -1 if not found.
   */
  scrollToNextDiff(
    type?: 'added' | 'removed' | 'changed',
    afterIndex?: number
  ): number;

  /**
   * Scroll to the first difference of any type after the specified index.
   * Returns the index scrolled to, or -1 if not found.
   */
  scrollToNextChange(afterIndex?: number): number;

  /** Clean up event listeners and DOM. */
  destroy(): void;
}
