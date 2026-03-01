import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diffValues } from '../src/diff.js';
import { alignLines } from '../src/align.js';
import { renderHTML } from '../src/render.js';
import { compare, compareAndRender } from '../src/index.js';

describe('renderHTML', () => {
  it('returns a string containing the container div', () => {
    const diff = diffValues({ a: 1 }, { a: 2 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);

    assert.ok(html.includes('class="jc-container"'));
    assert.ok(html.includes('class="jc-table"'));
  });

  it('contains line numbers', () => {
    const diff = diffValues({ a: 1, b: 2 }, { a: 1, b: 3 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);

    assert.ok(html.includes('class="jc-line-num"'));
    // Should contain line number "1"
    assert.ok(html.includes('>1<'));
  });

  it('marks changed cells with jc-changed class', () => {
    const diff = diffValues({ a: 1 }, { a: 2 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);

    assert.ok(html.includes('jc-changed'));
  });

  it('marks added cells with jc-added class', () => {
    const diff = diffValues({ a: 1 }, { a: 1, b: 2 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);

    assert.ok(html.includes('jc-added'));
  });

  it('marks removed cells with jc-removed class', () => {
    const diff = diffValues({ a: 1, b: 2 }, { a: 1 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);

    assert.ok(html.includes('jc-removed'));
  });

  it('marks empty cells with jc-empty class', () => {
    const diff = diffValues({ a: 1 }, { a: 1, b: 2 });
    const lines = alignLines(diff);
    const html = renderHTML(lines);

    assert.ok(html.includes('jc-empty'));
  });

  it('includes syntax highlighting spans', () => {
    const diff = diffValues({ name: 'test' }, { name: 'test' });
    const lines = alignLines(diff);
    const html = renderHTML(lines);

    assert.ok(html.includes('jc-key'));
    assert.ok(html.includes('jc-string'));
  });

  it('disables syntax highlighting when option is false', () => {
    const diff = diffValues({ a: 1 }, { a: 1 });
    const lines = alignLines(diff);
    const html = renderHTML(lines, { syntaxHighlight: false });

    assert.ok(!html.includes('jc-key'));
    assert.ok(!html.includes('jc-string'));
  });

  it('folds long equal sections', () => {
    // Create a structure with many identical keys
    const obj = {};
    for (let i = 0; i < 20; i++) {
      obj['key' + i] = 'value' + i;
    }
    const diff = diffValues(obj, { ...obj, extra: 'new' });
    const lines = alignLines(diff);
    const html = renderHTML(lines, { foldThreshold: 5 });

    assert.ok(html.includes('<details>'));
    assert.ok(html.includes('unchanged lines'));
  });

  it('does not fold when threshold is Infinity', () => {
    const obj = {};
    for (let i = 0; i < 20; i++) {
      obj['key' + i] = 'value' + i;
    }
    const diff = diffValues(obj, { ...obj, extra: 'new' });
    const lines = alignLines(diff);
    const html = renderHTML(lines, { foldThreshold: Infinity });

    assert.ok(!html.includes('<details>'));
  });

  it('folds everything when threshold is 0', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const diff = diffValues(obj, { ...obj, d: 4 });
    const lines = alignLines(diff);
    const html = renderHTML(lines, { foldThreshold: 0 });

    // All equal sections should be folded
    assert.ok(html.includes('<details>'));
  });
});

describe('compare (public API)', () => {
  it('accepts JSON strings', () => {
    const result = compare('{"a": 1}', '{"a": 2}');
    assert.ok(result.linePairs.length > 0);
    assert.ok(result.diffTree);
    assert.ok(result.stats);
    assert.ok(result.stats.changed > 0);
  });

  it('accepts parsed objects', () => {
    const result = compare({ a: 1 }, { a: 2 });
    assert.ok(result.linePairs.length > 0);
  });

  it('returns correct stats', () => {
    const result = compare({ a: 1, b: 2 }, { a: 1, b: 3 });
    assert.equal(result.stats.total, result.linePairs.length);
    assert.ok(result.stats.equal > 0);
    assert.ok(result.stats.changed > 0);
  });
});

describe('compareAndRender (public API)', () => {
  it('returns html along with data', () => {
    const result = compareAndRender({ x: 1 }, { x: 2 });
    assert.ok(result.html.includes('jc-container'));
    assert.ok(result.linePairs.length > 0);
    assert.ok(result.diffTree);
    assert.ok(result.stats);
  });

  it('works with Chromium diagnostic fixture files', () => {
    const a = readFileSync(new URL('./fixtures/chromium-working.json', import.meta.url), 'utf8');
    const b = readFileSync(new URL('./fixtures/chromium-broken.json', import.meta.url), 'utf8');

    const result = compareAndRender(a, b, { foldThreshold: 3 });

    // Should detect multiple differences
    assert.ok(result.stats.changed > 0, 'Should have changed lines');
    assert.ok(result.stats.added > 0, 'Should have added lines');
    assert.ok(result.stats.removed > 0, 'Should have removed lines');

    // HTML should be valid
    assert.ok(result.html.includes('jc-container'));
    assert.ok(result.html.includes('<details>'), 'Should have folded sections');

    // Specific diffs we expect:
    // - version changed
    // - driver changed
    // - hardware-acceleration changed
    // - extensions differ
    // - network settings differ
    // - experiments section added
    console.log(`  Chromium fixture: ${result.stats.total} lines, ` +
      `${result.stats.equal} equal, ${result.stats.changed} changed, ` +
      `${result.stats.added} added, ${result.stats.removed} removed`);
  });
});
