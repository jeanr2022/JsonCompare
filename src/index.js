/**
 * json-compare — Zero-dependency side-by-side JSON diff module.
 *
 * Works in Node.js and browser environments.
 *
 * @module json-compare
 */

import { diffValues, deepEqual } from './diff.js';
import { alignLines, computeStats } from './align.js';
import { renderHTML } from './render.js';

/**
 * @typedef {Object} CompareOptions
 * @property {boolean} [sortKeys=false] - Sort object keys alphabetically.
 *   Default is false to preserve original file order.
 * @property {number} [foldThreshold=5] - Minimum consecutive equal lines before
 *   folding in HTML output. Set to 0 to fold all unchanged sections.
 *   Set to Infinity to disable folding entirely.
 * @property {boolean} [syntaxHighlight=true] - Enable JSON syntax highlighting
 *   in HTML output.
 */

/**
 * @typedef {import('./align.js').LinePair} LinePair
 */

/**
 * Compare two JSON values and produce aligned line pairs + diff tree.
 *
 * @param {string|object} a - Left JSON (string to parse, or already-parsed object)
 * @param {string|object} b - Right JSON (string to parse, or already-parsed object)
 * @param {CompareOptions} [options]
 * @returns {{ linePairs: LinePair[], diffTree: object, stats: { equal: number, added: number, removed: number, changed: number, total: number } }}
 */
export function compare(a, b, options = {}) {
  const sortKeys = options.sortKeys !== undefined ? options.sortKeys : false;

  const objA = typeof a === 'string' ? JSON.parse(a) : a;
  const objB = typeof b === 'string' ? JSON.parse(b) : b;

  const diffTree = diffValues(objA, objB, sortKeys);
  const linePairs = alignLines(diffTree);
  const stats = computeStats(linePairs);

  return { linePairs, diffTree, stats };
}

/**
 * Compare two JSON values and render a side-by-side HTML diff.
 * Convenience function combining compare() + renderHTML().
 *
 * @param {string|object} a - Left JSON
 * @param {string|object} b - Right JSON
 * @param {CompareOptions} [options]
 * @returns {{ html: string, linePairs: LinePair[], diffTree: object, stats: { equal: number, added: number, removed: number, changed: number, total: number } }}
 */
export function compareAndRender(a, b, options = {}) {
  const result = compare(a, b, options);
  const html = renderHTML(result.linePairs, {
    foldThreshold: options.foldThreshold,
    syntaxHighlight: options.syntaxHighlight
  });

  return { ...result, html };
}

// Re-export building blocks for advanced usage
export { diffValues, deepEqual } from './diff.js';
export { alignLines, computeStats } from './align.js';
export { renderHTML } from './render.js';
export { highlightLine, escapeHtml } from './syntax.js';
export { lcs } from './lcs.js';
