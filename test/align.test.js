import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diffValues } from '../src/diff.js';
import { alignLines, computeStats } from '../src/align.js';

describe('alignLines', () => {
  it('produces equal lines for identical values', () => {
    const diff = diffValues({ a: 1, b: 2 }, { a: 1, b: 2 });
    const lines = alignLines(diff);

    // All lines should be equal
    for (const line of lines) {
      assert.equal(line.type, 'equal');
      assert.equal(line.left, line.right);
      assert.notEqual(line.left, null);
    }
  });

  it('produces changed lines for different primitive values', () => {
    const diff = diffValues({ a: 1 }, { a: 2 });
    const lines = alignLines(diff);

    const changed = lines.filter(l => l.type === 'changed');
    assert.equal(changed.length, 1);
    assert.ok(changed[0].left.includes('1'));
    assert.ok(changed[0].right.includes('2'));
  });

  it('produces null left for added keys', () => {
    const diff = diffValues({ a: 1 }, { a: 1, b: 2 });
    const lines = alignLines(diff);

    const added = lines.filter(l => l.type === 'added');
    assert.ok(added.length > 0);
    for (const line of added) {
      assert.equal(line.left, null);
      assert.notEqual(line.right, null);
    }
  });

  it('produces null right for removed keys', () => {
    const diff = diffValues({ a: 1, b: 2 }, { a: 1 });
    const lines = alignLines(diff);

    const removed = lines.filter(l => l.type === 'removed');
    assert.ok(removed.length > 0);
    for (const line of removed) {
      assert.notEqual(line.left, null);
      assert.equal(line.right, null);
    }
  });

  it('aligns array insertions correctly', () => {
    const diff = diffValues([1, 2, 3], [1, 99, 2, 3]);
    const lines = alignLines(diff);

    const added = lines.filter(l => l.type === 'added');
    assert.equal(added.length, 1);
    assert.ok(added[0].right.includes('99'));
    assert.equal(added[0].left, null);
  });

  it('handles bracket/brace alignment for containers', () => {
    const diff = diffValues({ x: [1] }, { x: [1] });
    const lines = alignLines(diff);

    // Every line should be equal (identical structure)
    for (const line of lines) {
      assert.equal(line.type, 'equal');
    }

    // Should contain { } [ ] characters
    const allText = lines.map(l => l.left).join('\n');
    assert.ok(allText.includes('{'));
    assert.ok(allText.includes('}'));
    assert.ok(allText.includes('['));
    assert.ok(allText.includes(']'));
  });

  it('handles indentation correctly', () => {
    const diff = diffValues({ a: { b: 1 } }, { a: { b: 2 } });
    const lines = alignLines(diff);

    // The changed line for "b" should be indented
    const changed = lines.find(l => l.type === 'changed');
    assert.ok(changed);
    // Should have leading spaces for nesting
    const leadingSpaces = changed.left.match(/^(\s*)/)[1].length;
    assert.ok(leadingSpaces >= 2, `Expected at least 2 spaces of indentation, got ${leadingSpaces}`);
  });

  it('produces valid JSON-like output on each side', () => {
    const a = { name: 'Alice', settings: { theme: 'dark', font: 14 } };
    const b = { name: 'Bob', settings: { theme: 'light', font: 14 } };

    const diff = diffValues(a, b);
    const lines = alignLines(diff);

    // Reconstruct left side (skipping null lines)
    const leftText = lines
      .filter(l => l.left !== null)
      .map(l => l.left)
      .join('\n');

    // Should be parseable as JSON
    const parsed = JSON.parse(leftText);
    assert.equal(parsed.name, 'Alice');
  });

  it('handles type changes (object → array)', () => {
    const diff = diffValues({ a: { x: 1 } }, { a: [1, 2] });
    const lines = alignLines(diff);

    // Should have changed/added/removed lines for the type change
    const nonEqual = lines.filter(l => l.type !== 'equal');
    assert.ok(nonEqual.length > 0);
  });
});

describe('computeStats', () => {
  it('counts line types correctly', () => {
    const diff = diffValues({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, d: 4 });
    const lines = alignLines(diff);
    const stats = computeStats(lines);

    assert.ok(stats.equal > 0);
    assert.ok(stats.changed > 0);
    assert.ok(stats.removed > 0);
    assert.ok(stats.added > 0);
    assert.equal(stats.total, lines.length);
    assert.equal(stats.equal + stats.added + stats.removed + stats.changed, stats.total);
  });
});
