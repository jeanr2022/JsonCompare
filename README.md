# JsonCompare

Zero-dependency, side-by-side JSON diff module for Node.js and the browser.

Built for comparing Chromium diagnostic JSON exports (working vs. broken scenarios), but works with any JSON data.

## Features

- **Side-by-side view** — left/right panes with aligned lines
- **Empty lines for missing parts** — added items show a blank left side, removed items show a blank right side
- **LCS-based array diffing** — insertions and deletions detected cleanly, no index-shift noise
- **Structural key matching** — objects are compared by key name, not position
- **Preserves original key order** — display matches your source files (no sorting by default)
- **Syntax highlighting** — keys, strings, numbers, booleans, null in distinct colors
- **Line numbers** on both sides
- **Collapsible unchanged sections** — fold threshold configurable (including "fold everything")
- **Dark mode** — automatic via `prefers-color-scheme`
- **Dual output** — raw data structure for programmatic use + HTML string renderer
- **Summary stats** — equal/added/removed/changed line counts
- **Zero dependencies** — pure JavaScript, works everywhere

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

Convenience shorthand: calls `compare()` then `renderHTML()`.

**Returns:** `{ html, linePairs, diffTree, stats }`

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `sortKeys` | `boolean` | `false` | Sort object keys alphabetically. Default preserves original order. |
| `foldThreshold` | `number` | `5` | Consecutive equal lines before collapsing. `0` = fold all. `Infinity` = no folding. |
| `syntaxHighlight` | `boolean` | `true` | Color-code JSON tokens (keys, strings, numbers, etc.) |

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
  alignLines,    // Diff tree → line pairs
  computeStats,  // Line pairs → summary stats
  renderHTML,     // Line pairs → HTML string
  highlightLine, // Single line → syntax-highlighted HTML
  escapeHtml,    // HTML entity escaping
  lcs            // LCS algorithm (for arrays)
} from 'json-compare';
```

## Demo

Open `demo.html` in a browser to try it interactively. It comes pre-loaded with a Chromium config diff example.

## Project Structure

```
JsonCompare/
├── src/
│   ├── index.js    — Public API (compare, compareAndRender, re-exports)
│   ├── diff.js     — Recursive structural diff engine + deepEqual
│   ├── lcs.js      — LCS algorithm for array alignment
│   ├── align.js    — Diff tree → aligned line pairs
│   ├── render.js   — HTML table renderer (string output, no DOM)
│   └── syntax.js   — JSON syntax highlighter (regex-based tokenizer)
├── style/
│   └── json-compare.css — Diff colors, syntax colors, dark mode, fold styles
├── test/
│   ├── run-all.js  — Test suite (49 tests)
│   ├── runner.js   — Minimal test runner (Node 16+ compatible)
│   └── fixtures/   — Sample JSON pairs (Chromium configs, simple, arrays)
├── demo.html       — Interactive browser demo
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