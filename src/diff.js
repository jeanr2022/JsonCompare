import { lcs } from './lcs.js';

/**
 * @typedef {Object} DiffNode
 * @property {'equal'|'changed'|'added'|'removed'|'object'|'array'|'typeChanged'} type
 * @property {*} [valueA] - Value from the left side
 * @property {*} [valueB] - Value from the right side
 * @property {{ key: string, diff: DiffNode }[]} [children] - Child diffs for object/array containers
 */

/**
 * Deep-equal check for two JSON-compatible values.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Determine the JSON type of a value.
 * @param {*} val
 * @returns {'null'|'boolean'|'number'|'string'|'array'|'object'}
 */
function jsonType(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val; // 'boolean', 'number', 'string', 'object'
}

/**
 * Diff two objects by their keys.
 * Key order follows the left side (A) first, then any keys only in B appended at
 * the position they appear in B — preserving original file order for engineers.
 *
 * @param {Object} a
 * @param {Object} b
 * @param {boolean} sortKeys
 * @returns {DiffNode}
 */
function diffObjects(a, b, sortKeys) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  let orderedKeys;
  if (sortKeys) {
    const all = new Set([...keysA, ...keysB]);
    orderedKeys = [...all].sort();
  } else {
    // Preserve A's order, then append B-only keys in their B order
    const setA = new Set(keysA);
    orderedKeys = [...keysA];
    for (const k of keysB) {
      if (!setA.has(k)) {
        orderedKeys.push(k);
      }
    }
  }

  const children = [];
  for (const key of orderedKeys) {
    const inA = Object.prototype.hasOwnProperty.call(a, key);
    const inB = Object.prototype.hasOwnProperty.call(b, key);

    if (inA && inB) {
      children.push({ key, diff: diffValues(a[key], b[key], sortKeys) });
    } else if (inA) {
      children.push({ key, diff: { type: 'removed', valueA: a[key] } });
    } else {
      children.push({ key, diff: { type: 'added', valueB: b[key] } });
    }
  }

  return { type: 'object', children };
}

/**
 * Diff two arrays using LCS alignment.
 * @param {any[]} a
 * @param {any[]} b
 * @param {boolean} sortKeys
 * @returns {DiffNode}
 */
function diffArrays(a, b, sortKeys) {
  const matches = lcs(a, b, deepEqual);

  const children = [];
  let ai = 0;
  let bi = 0;

  for (const match of matches) {
    // Items before this match in A are removed
    while (ai < match.aIndex) {
      children.push({ key: String(ai), diff: { type: 'removed', valueA: a[ai] } });
      ai++;
    }
    // Items before this match in B are added
    while (bi < match.bIndex) {
      children.push({ key: String(bi), diff: { type: 'added', valueB: b[bi] } });
      bi++;
    }
    // The matched pair – recurse to find inner differences
    children.push({ key: String(ai), diff: diffValues(a[ai], b[bi], sortKeys) });
    ai++;
    bi++;
  }

  // Remaining items after last match
  while (ai < a.length) {
    children.push({ key: String(ai), diff: { type: 'removed', valueA: a[ai] } });
    ai++;
  }
  while (bi < b.length) {
    children.push({ key: String(bi), diff: { type: 'added', valueB: b[bi] } });
    bi++;
  }

  return { type: 'array', children };
}

/**
 * Recursively diff two JSON-compatible values.
 *
 * @param {*} a - Left value
 * @param {*} b - Right value
 * @param {boolean} [sortKeys=false] - Whether to sort object keys
 * @returns {DiffNode}
 */
export function diffValues(a, b, sortKeys = false) {
  const typeA = jsonType(a);
  const typeB = jsonType(b);

  // Identical values
  if (deepEqual(a, b)) {
    return { type: 'equal', valueA: a };
  }

  // Different JSON types → type changed
  if (typeA !== typeB) {
    return { type: 'typeChanged', valueA: a, valueB: b };
  }

  // Both objects
  if (typeA === 'object') {
    return diffObjects(a, b, sortKeys);
  }

  // Both arrays
  if (typeA === 'array') {
    return diffArrays(a, b, sortKeys);
  }

  // Same primitive type but different value
  return { type: 'changed', valueA: a, valueB: b };
}
