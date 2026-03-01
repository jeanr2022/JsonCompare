# JsonCompare

Zero-dependency, side-by-side JSON diff module for Node.js and the browser.

Built for comparing Chromium diagnostic JSON exports (working vs. broken scenarios), but works with any JSON data.

## Features

- **Side-by-side view**: left/right panes with aligned lines
- **Empty lines for missing parts**: added items show a blank left side, removed items show a blank right side
- **LCS-based array diffing**: insertions and deletions detected cleanly, no index-shift noise
- **Similarity pairing**: similar array elements are recursed into, not shown as full remove+add blocks
- **Structural key matching**: objects are compared by key name, not position
- **Preserves original key order**: display matches your source files (no sorting by default)
- **Syntax highlighting**: keys, strings, numbers, booleans, null in distinct colors
- **Line numbers** on both sides
- **Collapsible unchanged sections**: fold threshold is configurable (including "fold everything")
- **Virtual scrolling**: renders only visible rows, handles 50,000+ line diffs without DOM bloat
- **Web Worker support**: optional off-main-thread computation for large files
- **Dark mode**: automatic via `prefers-color-scheme`
- **Dual output**: raw data structure for programmatic use + HTML string renderer
- **Summary stats**: equal/added/removed/changed line counts
- **Zero dependencies**: pure JavaScript, works everywhere

## How It Works

### Comparison Pipeline

```
JSON A ──┐                                              ┌── LinePair[] (data)
         ├─→ parse → diffValues() → diffTree → alignLines() ─┤
JSON B ──┘                                              └── renderHTML() → HTML string
```

1. **Parse**: JSON strings are parsed into objects (or passed through if already parsed).
2. **Diff**: `diffValues()` recursively compares the two values and produces a structural diff tree.
   - **Objects** are compared by key name (not position). Keys from side A are walked first to preserve original order, then keys only in B are appended.
   - **Arrays** are aligned using LCS (Longest Common Subsequence). A hash-based optimization maps elements to numeric IDs for O(1) equality checks. For very large arrays (>1M DP cells), a greedy hash-map match is used instead of full DP.
   - **Similarity pairing**: after LCS, unmatched array elements are scored for structural similarity (shared keys, recursive overlap). Pairs above a 0.3 threshold are recursed into rather than shown as full red/green blocks. This means changing one field inside a large object shows only that field highlighted yellow, not the entire object as removed+added.
   - **Primitives** are compared by value and type (`===`).
3. **Align**: `alignLines()` flattens the diff tree into `LinePair[]`, one entry per display row, including `{`/`}` bracket lines, indentation, and trailing commas. Each pair has `left`, `right`, and `type` (`equal`/`added`/`removed`/`changed`).
4. **Render**: `renderHTML()` converts line pairs into a side-by-side HTML table with syntax highlighting, line numbers, and collapsible unchanged sections.

### Stats Counting

Stats (`equal`, `added`, `removed`, `changed`, `total`) count **display lines**, not semantic values. For example, removing one array element like:

```json
{
  "count": 3,
  "high": 11666,
  "low": 10460
}
```

counts as **5 removed** lines (`{`, three properties, `}`), not 3. This keeps the numbers consistent with what you see on screen: every red/green/yellow row in the output contributes exactly 1 to the count.

### Performance

For large JSON files (2.5MB+), two optional browser-only modules prevent UI freezing:

- **Web Worker** (`src/worker.js`): runs `compare()` off the main thread via `postMessage`. The demo falls back to main-thread execution if module workers are not supported.
- **Virtual Scrolling** (`src/virtual-scroll.js`): renders only the ~50-100 rows visible in the viewport, swapping DOM nodes on scroll. Total DOM node count stays constant regardless of diff size.

## Install

```bash
# From a local path
npm install /path/to/JsonCompare

# Or copy src/ and style/ into your project
```

## Quick Start

### Browser

```html
<link rel="stylesheet" href="json-compare/style/json-compare.css">
<div id="diff-output"></div>

<script type="module">
  import { compareAndRender } from './json-compare/src/index.js';

  const a = '{"browser":"Chrome","version":"120.0.6099.130"}';
  const b = '{"browser":"Chrome","version":"120.0.6099.131","newFlag":true}';

  const { html, stats } = compareAndRender(a, b);

  document.getElementById('diff-output').innerHTML = html;
  console.log(`${stats.changed} changes found out of ${stats.total} lines`);
</script>
```

### Node.js

```js
import { compare, renderHTML } from 'json-compare';
import { readFileSync, writeFileSync } from 'fs';

const a = readFileSync('working.json', 'utf8');
const b = readFileSync('broken.json', 'utf8');

// Data only
const { linePairs, stats } = compare(a, b);
console.log(stats); // { equal: 45, added: 3, removed: 1, changed: 2, total: 51 }

// Or generate HTML
const html = renderHTML(linePairs, { foldThreshold: 5 });
writeFileSync('diff.html', `
  <link rel="stylesheet" href="node_modules/json-compare/style/json-compare.css">
  ${html}
`);
```

## API

### `compare(a, b, options?)`

Compare two JSON values. Accepts JSON strings or parsed objects.

**Returns:** `{ linePairs, diffTree, stats }`

| Field | Type | Description |
|---|---|---|
| `linePairs` | `LinePair[]` | Aligned line pairs for side-by-side display |
| `diffTree` | `DiffNode` | Structural diff tree (for advanced use) |
| `stats` | `object` | `{ equal, added, removed, changed, total }` |

### `renderHTML(linePairs, options?)`

Render line pairs into a side-by-side HTML table string.

**Returns:** `string` (HTML)

### `compareAndRender(a, b, options?)`

Convenience shorthand that calls `compare()` then `renderHTML()`.

**Returns:** `{ html, linePairs, diffTree, stats }`

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `sortKeys` | `boolean` | `false` | Sort object keys alphabetically before comparing. When `false` (default), keys appear in the same order as your source file. When `true`, both sides are sorted so structurally identical objects always align the same way regardless of key order in the original JSON. |
| `foldThreshold` | `number` | `5` | Consecutive equal lines before collapsing. `0` = fold all unchanged sections. `Infinity` = no folding. |
| `syntaxHighlight` | `boolean` | `true` | Color-code JSON tokens in the output: keys are bold blue, strings are dark blue, numbers are blue, booleans are red, and `null` is italic gray. When `false`, all text is rendered in a single plain color. |

### `LinePair` Object

Each line pair represents one row in the side-by-side view:

```js
{
  left: string | null,   // Left-side text (null = empty/missing line)
  right: string | null,  // Right-side text (null = empty/missing line)
  type: 'equal' | 'added' | 'removed' | 'changed'
}
```

### Advanced Exports

For custom pipelines, all building blocks are individually exported:

```js
import {
  diffValues,    // Recursive diff engine
  deepEqual,     // Deep equality check
  alignLines,    // Diff tree -> line pairs
  computeStats,  // Line pairs -> summary stats
  renderHTML,     // Line pairs -> HTML string
  highlightLine, // Single line -> syntax-highlighted HTML
  escapeHtml,    // HTML entity escaping
  lcs            // LCS algorithm (for arrays)
} from 'json-compare';
```

## Demo

```bash
npm start
# Opens at http://localhost:3000
```

The demo uses virtual scrolling and a Web Worker (with main-thread fallback). It includes prev/next change navigation (buttons or keyboard `↑`/`↓`/`j`/`k`) and a stats bar.

## Project Structure

```
JsonCompare/
├── src/
│   ├── index.js          Public API (compare, compareAndRender, re-exports)
│   ├── diff.js           Recursive structural diff engine + deepEqual + similarity pairing
│   ├── lcs.js            LCS algorithm for array alignment
│   ├── align.js          Diff tree -> aligned line pairs
│   ├── render.js         HTML table renderer (string output, no DOM needed)
│   ├── syntax.js         JSON syntax highlighter (regex-based tokenizer)
│   ├── virtual-scroll.js Virtual scroll renderer (browser-only, optional)
│   └── worker.js         Web Worker wrapper (browser-only, optional)
├── style/
│   └── json-compare.css  Diff colors, syntax colors, dark mode, fold styles, virtual scroll
├── test/
│   ├── run-all.js        Test suite (52 tests)
│   ├── runner.js         Minimal test runner (Node 16+ compatible)
│   └── fixtures/         Sample JSON pairs (Chromium configs, simple, arrays)
├── demo.html             Interactive browser demo (virtual scroll + worker + navigation)
├── server.js             Zero-dependency static file server for development
├── package.json
└── README.md
```

## Tests

```bash
npm test
# or
node test/run-all.js
```

## License

MIT