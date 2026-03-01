import { readFileSync } from 'node:fs';
import { describe, it, summary, assertEqual, assertOk, assertDeepEqual } from './runner.js';
import { diffValues, deepEqual } from '../src/diff.js';
import { alignLines, computeStats } from '../src/align.js';
import { renderHTML } from '../src/render.js';
import { compare, compareAndRender } from '../src/index.js';

// ===== deepEqual tests =====

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    assertEqual(deepEqual(1, 1), true);
    assertEqual(deepEqual('hello', 'hello'), true);
    assertEqual(deepEqual(true, true), true);
    assertEqual(deepEqual(null, null), true);
  });

  it('returns false for different primitives', () => {
    assertEqual(deepEqual(1, 2), false);
    assertEqual(deepEqual('a', 'b'), false);
    assertEqual(deepEqual(true, false), false);
    assertEqual(deepEqual(null, 0), false);
  });

  it('returns true for identical objects', () => {
    assertEqual(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
  });

  it('returns false for objects with different values', () => {
    assertEqual(deepEqual({ a: 1 }, { a: 2 }), false);
  });

  it('returns false for objects with different keys', () => {
    assertEqual(deepEqual({ a: 1 }, { b: 1 }), false);
  });

  it('returns true for identical arrays', () => {
    assertEqual(deepEqual([1, 2, 3], [1, 2, 3]), true);
  });

  it('returns false for arrays with different lengths', () => {
    assertEqual(deepEqual([1, 2], [1, 2, 3]), false);
  });

  it('returns true for deeply nested equal structures', () => {
    const a = { x: [1, { y: [2, 3] }], z: null };
    const b = { x: [1, { y: [2, 3] }], z: null };
    assertEqual(deepEqual(a, b), true);
  });

  it('returns false for different types', () => {
    assertEqual(deepEqual(1, '1'), false);
    assertEqual(deepEqual([], {}), false);
  });
});

// ===== diffValues tests =====

describe('diffValues', () => {
  it('detects equal values', () => {
    const result = diffValues(42, 42);
    assertEqual(result.type, 'equal');
    assertEqual(result.valueA, 42);
  });

  it('detects changed primitives', () => {
    const result = diffValues('hello', 'world');
    assertEqual(result.type, 'changed');
    assertEqual(result.valueA, 'hello');
    assertEqual(result.valueB, 'world');
  });

  it('detects type changes', () => {
    const result = diffValues(42, 'forty-two');
    assertEqual(result.type, 'typeChanged');
  });

  it('detects added object keys', () => {
    const result = diffValues({ a: 1 }, { a: 1, b: 2 });
    assertEqual(result.type, 'object');
    assertEqual(result.children.length, 2);
    assertEqual(result.children[0].key, 'a');
    assertEqual(result.children[0].diff.type, 'equal');
    assertEqual(result.children[1].key, 'b');
    assertEqual(result.children[1].diff.type, 'added');
  });

  it('detects removed object keys', () => {
    const result = diffValues({ a: 1, b: 2 }, { a: 1 });
    assertEqual(result.type, 'object');
    const removed = result.children.find(c => c.key === 'b');
    assertEqual(removed.diff.type, 'removed');
  });

  it('detects changed object values', () => {
    const result = diffValues({ a: 1 }, { a: 2 });
    assertEqual(result.type, 'object');
    assertEqual(result.children[0].diff.type, 'changed');
  });

  it('preserves key order from left side', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { z: 1, a: 2, m: 3 };
    const result = diffValues(a, b);
    assertEqual(result.type, 'equal');
  });

  it('sorts keys when sortKeys is true', () => {
    const a = { z: 1, a: 2 };
    const b = { z: 10, a: 2 };
    const result = diffValues(a, b, true);
    assertEqual(result.children[0].key, 'a');
    assertEqual(result.children[1].key, 'z');
  });

  it('diffs arrays using LCS — insertion detected', () => {
    const result = diffValues([1, 2, 3], [1, 99, 2, 3]);
    assertEqual(result.type, 'array');
    const types = result.children.map(c => c.diff.type);
    assertDeepEqual(types, ['equal', 'added', 'equal', 'equal']);
  });

  it('diffs arrays using LCS — deletion detected', () => {
    const result = diffValues([1, 2, 3], [1, 3]);
    assertEqual(result.type, 'array');
    const types = result.children.map(c => c.diff.type);
    assertDeepEqual(types, ['equal', 'removed', 'equal']);
  });

  it('handles nested differences in objects', () => {
    const result = diffValues({ outer: { inner: 1 } }, { outer: { inner: 2 } });
    assertEqual(result.type, 'object');
    const outerDiff = result.children[0].diff;
    assertEqual(outerDiff.type, 'object');
    assertEqual(outerDiff.children[0].diff.type, 'changed');
  });

  it('handles empty objects', () => {
    const result = diffValues({}, {});
    assertEqual(result.type, 'equal');
  });

  it('handles empty arrays', () => {
    const result = diffValues([], []);
    assertEqual(result.type, 'equal');
  });

  it('handles null values', () => {
    const result = diffValues(null, null);
    assertEqual(result.type, 'equal');
  });

  it('detects null to value change', () => {
    const result = diffValues(null, 42);
    assertEqual(result.type, 'typeChanged');
  });
});

// ===== alignLines tests =====

describe('alignLines', () => {
  it('produces equal lines for identical values', () => {
    const diff = diffValues({ a: 1, b: 2 }, { a: 1, b: 2 });
    const lines = alignLines(diff);
    for (const line of lines) {
      assertEqual(line.type, 'equal');
      assertEqual(line.left, line.right);
      assertOk(line.left !== null);
    }
  });

  it('produces changed lines for different primitive values', () => {
    const diff = diffValues({ a: 1 }, { a: 2 });
    const lines = alignLines(diff);
    const changed = lines.filter(l => l.type === 'changed');
    assertEqual(changed.length, 1);
    assertOk(changed[0].left.includes('1'));
    assertOk(changed[0].right.includes('2'));
  });

  it('produces null left for added keys', () => {
    const diff = diffValues({ a: 1 }, { a: 1, b: 2 });
    const lines = alignLines(diff);
    const added = lines.filter(l => l.type === 'added');
    assertOk(added.length > 0);
    for (const line of added) {
      assertEqual(line.left, null);
      assertOk(line.right !== null);
    }
  });

  it('produces null right for removed keys', () => {
    const diff = diffValues({ a: 1, b: 2 }, { a: 1 });
    const lines = alignLines(diff);
    const removed = lines.filter(l => l.type === 'removed');
    assertOk(removed.length > 0);
    for (const line of removed) {
      assertOk(line.left !== null);
      assertEqual(line.right, null);
    }
  });

  it('aligns array insertions correctly', () => {
    const diff = diffValues([1, 2, 3], [1, 99, 2, 3]);
    const lines = alignLines(diff);
    const added = lines.filter(l => l.type === 'added');
    assertEqual(added.length, 1);
    assertOk(added[0].right.includes('99'));
    assertEqual(added[0].left, null);
  });

  it('handles bracket/brace alignment for containers', () => {
    const diff = diffValues({ x: [1] }, { x: [1] });
    const lines = alignLines(diff);
    for (const line of lines) {
      assertEqual(line.type, 'equal');
    }
    const allText = lines.map(l => l.left).join('\n');
    assertOk(allText.includes('{'));
    assertOk(allText.includes('}'));
    assertOk(allText.includes('['));
    assertOk(allText.includes(']'));
  });

  it('handles indentation correctly', () => {
    const diff = diffValues({ a: { b: 1 } }, { a: { b: 2 } });
    const lines = alignLines(diff);
    const changed = lines.find(l => l.type === 'changed');
    assertOk(changed, 'Expected a changed line');
    const leadingSpaces = changed.left.match(/^(\s*)/)[1].length;
    assertOk(leadingSpaces >= 2, `Expected at least 2 spaces of indentation, got ${leadingSpaces}`);
  });

  it('handles type changes (object → array)', () => {
    const diff = diffValues({ a: { x: 1 } }, { a: [1, 2] });
    const lines = alignLines(diff);
    const nonEqual = lines.filter(l => l.type !== 'equal');
    assertOk(nonEqual.length > 0);
  });
});

// ===== computeStats tests =====

describe('computeStats', () => {
  it('counts line types correctly', () => {
    const diff = diffValues({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, d: 4 });
    const lines = alignLines(diff);
    const stats = computeStats(lines);
    assertOk(stats.equal > 0);
    assertOk(stats.changed > 0);
    assertOk(stats.removed > 0);
    assertOk(stats.added > 0);
    assertEqual(stats.total, lines.length);
    assertEqual(stats.equal + stats.added + stats.removed + stats.changed, stats.total);
  });
});

// ===== renderHTML tests =====

describe('renderHTML', () => {
  it('returns a string containing the container div', () => {
    const diff = diffValues({ a: 1 }, { a: 2 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);
    assertOk(html.includes('class="jc-container"'));
    assertOk(html.includes('class="jc-table"'));
  });

  it('contains line numbers', () => {
    const diff = diffValues({ a: 1, b: 2 }, { a: 1, b: 3 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);
    assertOk(html.includes('class="jc-line-num"'));
    assertOk(html.includes('>1<'));
  });

  it('marks changed cells with jc-changed class', () => {
    const diff = diffValues({ a: 1 }, { a: 2 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);
    assertOk(html.includes('jc-changed'));
  });

  it('marks added cells with jc-added class', () => {
    const diff = diffValues({ a: 1 }, { a: 1, b: 2 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);
    assertOk(html.includes('jc-added'));
  });

  it('marks removed cells with jc-removed class', () => {
    const diff = diffValues({ a: 1, b: 2 }, { a: 1 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);
    assertOk(html.includes('jc-removed'));
  });

  it('marks empty cells with jc-empty class', () => {
    const diff = diffValues({ a: 1 }, { a: 1, b: 2 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);
    assertOk(html.includes('jc-empty'));
  });

  it('includes syntax highlighting spans', () => {
    const diff = diffValues({ name: 'test' }, { name: 'test' });
    const lines = alignLines(diff);
    const html = renderHTML(lines);
    assertOk(html.includes('jc-key'));
    assertOk(html.includes('jc-string'));
  });

  it('disables syntax highlighting when option is false', () => {
    const diff = diffValues({ a: 1 }, { a: 1 });
    const lines = alignLines(diff);
    const html = renderHTML(lines, { syntaxHighlight: false });
    assertOk(!html.includes('jc-key'));
    assertOk(!html.includes('jc-string'));
  });

  it('folds long equal sections', () => {
    const obj = {};
    for (let i = 0; i < 20; i++) obj['key' + i] = 'value' + i;
    const diff = diffValues(obj, { ...obj, extra: 'new' });
    const lines = alignLines(diff);
    const html = renderHTML(lines, { foldThreshold: 5 });
    assertOk(html.includes('<details>'));
    assertOk(html.includes('unchanged lines'));
  });

  it('does not fold when threshold is Infinity', () => {
    const obj = {};
    for (let i = 0; i < 20; i++) obj['key' + i] = 'value' + i;
    const diff = diffValues(obj, { ...obj, extra: 'new' });
    const lines = alignLines(diff);
    const html = renderHTML(lines, { foldThreshold: Infinity });
    assertOk(!html.includes('<details>'));
  });

  it('folds everything when threshold is 0', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const diff = diffValues(obj, { ...obj, d: 4 });
    const lines = alignLines(diff);
    const html = renderHTML(lines, { foldThreshold: 0 });
    assertOk(html.includes('<details>'));
  });
});

// ===== Public API tests =====

describe('compare (public API)', () => {
  it('accepts JSON strings', () => {
    const result = compare('{"a": 1}', '{"a": 2}');
    assertOk(result.linePairs.length > 0);
    assertOk(result.diffTree);
    assertOk(result.stats);
    assertOk(result.stats.changed > 0);
  });

  it('accepts parsed objects', () => {
    const result = compare({ a: 1 }, { a: 2 });
    assertOk(result.linePairs.length > 0);
  });

  it('returns correct stats', () => {
    const result = compare({ a: 1, b: 2 }, { a: 1, b: 3 });
    assertEqual(result.stats.total, result.linePairs.length);
    assertOk(result.stats.equal > 0);
    assertOk(result.stats.changed > 0);
  });
});

describe('compareAndRender (public API)', () => {
  it('returns html along with data', () => {
    const result = compareAndRender({ x: 1 }, { x: 2 });
    assertOk(result.html.includes('jc-container'));
    assertOk(result.linePairs.length > 0);
    assertOk(result.diffTree);
    assertOk(result.stats);
  });

  it('works with Chromium diagnostic fixture files', () => {
    const a = readFileSync(new URL('./fixtures/chromium-working.json', import.meta.url), 'utf8');
    const b = readFileSync(new URL('./fixtures/chromium-broken.json', import.meta.url), 'utf8');

    const result = compareAndRender(a, b, { foldThreshold: 3 });

    assertOk(result.stats.changed > 0, 'Should have changed lines');
    assertOk(result.stats.added > 0, 'Should have added lines');
    assertOk(result.stats.removed > 0, 'Should have removed lines');
    assertOk(result.html.includes('jc-container'));
    assertOk(result.html.includes('<details>'), 'Should have folded sections');

    console.log(`    Chromium fixture: ${result.stats.total} lines, ` +
      `${result.stats.equal} equal, ${result.stats.changed} changed, ` +
      `${result.stats.added} added, ${result.stats.removed} removed`);
  });
});

// Print summary
await summary();
