import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diffValues, deepEqual } from '../src/diff.js';

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    assert.equal(deepEqual(1, 1), true);
    assert.equal(deepEqual('hello', 'hello'), true);
    assert.equal(deepEqual(true, true), true);
    assert.equal(deepEqual(null, null), true);
  });

  it('returns false for different primitives', () => {
    assert.equal(deepEqual(1, 2), false);
    assert.equal(deepEqual('a', 'b'), false);
    assert.equal(deepEqual(true, false), false);
    assert.equal(deepEqual(null, 0), false);
  });

  it('returns true for identical objects', () => {
    assert.equal(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
  });

  it('returns false for objects with different values', () => {
    assert.equal(deepEqual({ a: 1 }, { a: 2 }), false);
  });

  it('returns false for objects with different keys', () => {
    assert.equal(deepEqual({ a: 1 }, { b: 1 }), false);
  });

  it('returns true for identical arrays', () => {
    assert.equal(deepEqual([1, 2, 3], [1, 2, 3]), true);
  });

  it('returns false for arrays with different lengths', () => {
    assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
  });

  it('returns true for deeply nested equal structures', () => {
    const a = { x: [1, { y: [2, 3] }], z: null };
    const b = { x: [1, { y: [2, 3] }], z: null };
    assert.equal(deepEqual(a, b), true);
  });

  it('returns false for different types', () => {
    assert.equal(deepEqual(1, '1'), false);
    assert.equal(deepEqual([], {}), false);
    assert.equal(deepEqual(null, undefined), false);
  });
});

describe('diffValues', () => {
  it('detects equal values', () => {
    const result = diffValues(42, 42);
    assert.equal(result.type, 'equal');
    assert.equal(result.valueA, 42);
  });

  it('detects changed primitives', () => {
    const result = diffValues('hello', 'world');
    assert.equal(result.type, 'changed');
    assert.equal(result.valueA, 'hello');
    assert.equal(result.valueB, 'world');
  });

  it('detects type changes', () => {
    const result = diffValues(42, 'forty-two');
    assert.equal(result.type, 'typeChanged');
  });

  it('detects added object keys', () => {
    const result = diffValues({ a: 1 }, { a: 1, b: 2 });
    assert.equal(result.type, 'object');
    assert.equal(result.children.length, 2);
    assert.equal(result.children[0].key, 'a');
    assert.equal(result.children[0].diff.type, 'equal');
    assert.equal(result.children[1].key, 'b');
    assert.equal(result.children[1].diff.type, 'added');
  });

  it('detects removed object keys', () => {
    const result = diffValues({ a: 1, b: 2 }, { a: 1 });
    assert.equal(result.type, 'object');
    const removed = result.children.find(c => c.key === 'b');
    assert.equal(removed.diff.type, 'removed');
  });

  it('detects changed object values', () => {
    const result = diffValues({ a: 1 }, { a: 2 });
    assert.equal(result.type, 'object');
    assert.equal(result.children[0].diff.type, 'changed');
  });

  it('preserves key order from left side', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { z: 1, a: 2, m: 3 };
    const result = diffValues(a, b);
    assert.equal(result.type, 'equal');
  });

  it('sorts keys when sortKeys is true', () => {
    const a = { z: 1, a: 2 };
    const b = { z: 10, a: 2 };
    const result = diffValues(a, b, true);
    assert.equal(result.children[0].key, 'a');
    assert.equal(result.children[1].key, 'z');
  });

  it('diffs arrays using LCS — insertion detected', () => {
    const result = diffValues([1, 2, 3], [1, 99, 2, 3]);
    assert.equal(result.type, 'array');

    // 1 is equal, 99 is added, 2 is equal, 3 is equal
    const types = result.children.map(c => c.diff.type);
    assert.deepEqual(types, ['equal', 'added', 'equal', 'equal']);
  });

  it('diffs arrays using LCS — deletion detected', () => {
    const result = diffValues([1, 2, 3], [1, 3]);
    assert.equal(result.type, 'array');
    const types = result.children.map(c => c.diff.type);
    assert.deepEqual(types, ['equal', 'removed', 'equal']);
  });

  it('handles nested differences in objects', () => {
    const a = { outer: { inner: 1 } };
    const b = { outer: { inner: 2 } };
    const result = diffValues(a, b);
    assert.equal(result.type, 'object');
    const outerDiff = result.children[0].diff;
    assert.equal(outerDiff.type, 'object');
    assert.equal(outerDiff.children[0].diff.type, 'changed');
  });

  it('handles empty objects', () => {
    const result = diffValues({}, {});
    assert.equal(result.type, 'equal');
  });

  it('handles empty arrays', () => {
    const result = diffValues([], []);
    assert.equal(result.type, 'equal');
  });

  it('handles null values', () => {
    const result = diffValues(null, null);
    assert.equal(result.type, 'equal');
  });

  it('detects null to value change', () => {
    const result = diffValues(null, 42);
    assert.equal(result.type, 'typeChanged');
  });
});
