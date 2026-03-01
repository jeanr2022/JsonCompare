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
 * Produce a canonical JSON string for a value (keys always sorted).
 * Used for hashing / fast equality during LCS — computed once per element.
 * @param {*} value
 * @returns {string}
 */
function canonicalStringify(value) {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(value[k])).join(',') + '}';
}

/**
 * Greedy forward-matching by hash ID for large arrays.
 * O(N+M) instead of O(N*M) — used when full LCS DP table would be too expensive.
 *
 * @param {number[]} idA - Numeric IDs for each element in A
 * @param {number[]} idB - Numeric IDs for each element in B
 * @returns {{ aIndex: number, bIndex: number }[]}
 */
function hashMapMatch(idA, idB) {
  // Build a map of id → list of positions in B
  const bPositions = new Map();
  for (let i = 0; i < idB.length; i++) {
    if (!bPositions.has(idB[i])) bPositions.set(idB[i], []);
    bPositions.get(idB[i]).push(i);
  }

  // Track next available position per ID in B
  const bCursors = new Map();
  for (const [id, positions] of bPositions) {
    bCursors.set(id, 0);
  }

  const matches = [];
  let lastB = -1;

  for (let i = 0; i < idA.length; i++) {
    const positions = bPositions.get(idA[i]);
    if (!positions) continue;

    let cursor = bCursors.get(idA[i]);
    // Find the first position in B after lastB
    while (cursor < positions.length && positions[cursor] <= lastB) {
      cursor++;
    }
    if (cursor < positions.length) {
      const bIdx = positions[cursor];
      matches.push({ aIndex: i, bIndex: bIdx });
      lastB = bIdx;
      bCursors.set(idA[i], cursor + 1);
    }
  }

  return matches;
}

/**
 * Compute a structural similarity score between two values (0..1).
 * Used to decide whether to pair unmatched array elements and recurse,
 * or treat them as fully removed + added.
 *
 * @param {*} a
 * @param {*} b
 * @returns {number} 0 = completely different, 1 = identical
 */
function similarity(a, b) {
  if (a === b) return 1;
  if (a === null || b === null) return 0;
  if (typeof a !== typeof b) return 0;
  if (typeof a !== 'object') return 0; // different primitives of same type

  if (Array.isArray(a) !== Array.isArray(b)) return 0;

  if (Array.isArray(a)) {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    // Quick check: compare lengths as a rough proxy
    return Math.min(a.length, b.length) / maxLen;
  }

  // Objects: check key overlap + shallow value equality
  const keysA = new Set(Object.keys(a));
  const keysB = new Set(Object.keys(b));
  const allKeys = new Set([...keysA, ...keysB]);
  if (allKeys.size === 0) return 1;

  let score = 0;
  for (const key of allKeys) {
    if (keysA.has(key) && keysB.has(key)) {
      // Both have this key
      const va = a[key];
      const vb = b[key];
      if (va === vb) {
        score += 1; // identical primitive
      } else if (typeof va === typeof vb) {
        score += 0.3; // same type, different value (partial credit)
      }
      // different types: 0 credit
    }
    // key only on one side: 0 credit
  }

  return score / allKeys.size;
}

/** Minimum similarity score to pair unmatched array elements */
const SIMILARITY_THRESHOLD = 0.3;

/** Max DP table cells before falling back to hash-map matching */
const LCS_MAX_CELLS = 1_000_000;

/**
 * Pair unmatched elements from a gap between LCS anchors using similarity.
 * Elements that are similar enough get paired and recursed into (→ yellow "changed").
 * Elements with no good match stay as removed/added (→ red/green).
 *
 * @param {any[]} gapA - Unmatched elements from the left side
 * @param {any[]} gapB - Unmatched elements from the right side
 * @param {boolean} sortKeys
 * @param {{ key: string, diff: DiffNode }[]} children - Accumulator
 * @param {number} baseIndex - Starting index for key labels
 */
function pairGap(gapA, gapB, sortKeys, children, baseIndex) {
  if (gapA.length === 0 && gapB.length === 0) return;

  if (gapA.length === 0) {
    // All added
    for (let i = 0; i < gapB.length; i++) {
      children.push({ key: String(baseIndex + i), diff: { type: 'added', valueB: gapB[i] } });
    }
    return;
  }

  if (gapB.length === 0) {
    // All removed
    for (let i = 0; i < gapA.length; i++) {
      children.push({ key: String(baseIndex + i), diff: { type: 'removed', valueA: gapA[i] } });
    }
    return;
  }

  // Index-based pairing: walk both sides in parallel
  const minLen = Math.min(gapA.length, gapB.length);
  for (let i = 0; i < minLen; i++) {
    const sim = similarity(gapA[i], gapB[i]);
    if (sim >= SIMILARITY_THRESHOLD) {
      // Similar enough — recurse to get fine-grained diff (yellow highlighting)
      children.push({ key: String(baseIndex + i), diff: diffValues(gapA[i], gapB[i], sortKeys) });
    } else {
      // Too different — show as removed + added
      children.push({ key: String(baseIndex + i), diff: { type: 'removed', valueA: gapA[i] } });
      children.push({ key: String(baseIndex + i), diff: { type: 'added', valueB: gapB[i] } });
    }
  }

  // Remaining unpaired items
  for (let i = minLen; i < gapA.length; i++) {
    children.push({ key: String(baseIndex + i), diff: { type: 'removed', valueA: gapA[i] } });
  }
  for (let i = minLen; i < gapB.length; i++) {
    children.push({ key: String(baseIndex + i), diff: { type: 'added', valueB: gapB[i] } });
  }
}

/**
 * Diff two arrays using hash-optimized LCS alignment with similarity pairing.
 *
 * Three-step approach:
 * 1. Canonicalize each element to a string, assign numeric IDs (computed once)
 * 2. Run LCS on numeric IDs (O(1) per comparison) — or hash-map match for large arrays
 * 3. Between LCS anchors, pair unmatched elements by structural similarity and recurse
 *
 * @param {any[]} a
 * @param {any[]} b
 * @param {boolean} sortKeys
 * @returns {DiffNode}
 */
function diffArrays(a, b, sortKeys) {
  // Step 1: Compute canonical strings and assign numeric IDs for fast comparison
  const strA = a.map(canonicalStringify);
  const strB = b.map(canonicalStringify);

  const idMap = new Map();
  let nextId = 0;
  const idA = strA.map(s => {
    if (!idMap.has(s)) idMap.set(s, nextId++);
    return idMap.get(s);
  });
  const idB = strB.map(s => {
    if (!idMap.has(s)) idMap.set(s, nextId++);
    return idMap.get(s);
  });

  // Step 2: Find exact matches via LCS (or hash-map for large arrays)
  const cells = a.length * b.length;
  const matches = cells > LCS_MAX_CELLS
    ? hashMapMatch(idA, idB)
    : lcs(idA, idB, (x, y) => x === y);

  // Step 3: Walk matches and pair gaps by similarity
  const children = [];
  let ai = 0;
  let bi = 0;

  for (const match of matches) {
    // Collect the gap before this match
    const gapA = a.slice(ai, match.aIndex);
    const gapB = b.slice(bi, match.bIndex);
    pairGap(gapA, gapB, sortKeys, children, ai);

    // Exact match — emit as equal
    children.push({ key: String(match.aIndex), diff: { type: 'equal', valueA: a[match.aIndex] } });
    ai = match.aIndex + 1;
    bi = match.bIndex + 1;
  }

  // Final gap after last match
  const gapA = a.slice(ai);
  const gapB = b.slice(bi);
  pairGap(gapA, gapB, sortKeys, children, ai);

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
