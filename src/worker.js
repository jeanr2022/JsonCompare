/**
 * Web Worker entry point for json-compare.
 *
 * Runs compare() off the main thread to avoid "page not responding" on large files.
 * Communicates via postMessage.
 *
 * Message IN:  { jsonA: string, jsonB: string, options?: CompareOptions }
 * Message OUT: { linePairs, stats, error? }
 *
 * Usage (browser-only, optional):
 *   const worker = new Worker('./src/worker.js', { type: 'module' });
 *   worker.postMessage({ jsonA, jsonB, options });
 *   worker.onmessage = (e) => { /* e.data.linePairs, e.data.stats */ };
 */

import { compare } from './index.js';

self.onmessage = function (e) {
  const { jsonA, jsonB, options } = e.data;

  try {
    const result = compare(jsonA, jsonB, options || {});

    // Post back linePairs + stats (not diffTree — it can be huge and isn't needed for rendering)
    self.postMessage({
      linePairs: result.linePairs,
      stats: result.stats
    });
  } catch (err) {
    self.postMessage({
      error: err.message || String(err)
    });
  }
};
