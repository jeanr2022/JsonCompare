/**
 * Virtual-scroll renderer for json-compare.
 *
 * Renders only the rows visible in the viewport, swapping DOM nodes as the user
 * scrolls. This keeps the DOM node count at ~100 regardless of whether the diff
 * has 50 or 50,000 lines. Framework-free, no dependencies.
 *
 * Browser-only (requires DOM). The core module (compare, renderHTML) is unaffected.
 *
 * Usage:
 *   import { VirtualScrollRenderer } from './virtual-scroll.js';
 *
 *   const renderer = new VirtualScrollRenderer(containerElement, {
 *     rowHeight: 20,
 *     overscan: 10,
 *     syntaxHighlight: true
 *   });
 *   renderer.setData(linePairs);
 *   // Later: renderer.destroy();
 */

import { highlightLine, escapeHtml } from './syntax.js';

/**
 * @typedef {Object} VScrollOptions
 * @property {number} [rowHeight=20] - Fixed row height in px (monospace makes this predictable)
 * @property {number} [overscan=20] - Extra rows rendered above/below viewport for smooth scrolling
 * @property {boolean} [syntaxHighlight=true] - Enable syntax highlighting
 */

export class VirtualScrollRenderer {
  /**
   * @param {HTMLElement} container - The element to render into
   * @param {VScrollOptions} [options]
   */
  constructor(container, options = {}) {
    this.container = container;
    this.rowHeight = options.rowHeight || 20;
    this.overscan = options.overscan || 20;
    this.syntaxHighlight = options.syntaxHighlight !== undefined ? options.syntaxHighlight : true;

    /** @type {import('./align.js').LinePair[]} */
    this.data = [];

    // Pre-compute line numbers (left/right independently)
    /** @type {{ left: number, right: number }[]} */
    this.lineNumbers = [];

    // Build DOM structure
    this._buildDOM();
    this._onScroll = this._onScroll.bind(this);
    this.scrollContainer.addEventListener('scroll', this._onScroll, { passive: true });

    this._rafId = 0;
    this._lastStart = -1;
    this._lastEnd = -1;
  }

  /** Build the static DOM skeleton */
  _buildDOM() {
    this.container.innerHTML = '';
    this.container.classList.add('jc-vscroll-host');

    // Scroll container (the element with overflow: auto)
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'jc-vscroll-scroll';
    this.scrollContainer.style.cssText = 'overflow:auto;height:100%;position:relative;';

    // Spacer (sets total scrollable height)
    this.spacer = document.createElement('div');
    this.spacer.className = 'jc-vscroll-spacer';
    this.spacer.style.cssText = 'position:relative;width:100%;';

    // Viewport (absolutely positioned, holds visible rows)
    this.viewport = document.createElement('div');
    this.viewport.className = 'jc-vscroll-viewport';
    this.viewport.style.cssText = 'position:absolute;left:0;right:0;width:100%;';

    // Table for visible rows
    this.table = document.createElement('table');
    this.table.className = 'jc-table';
    this.table.style.cssText = 'width:100%;border-collapse:collapse;table-layout:fixed;';

    const colgroup = document.createElement('colgroup');
    colgroup.innerHTML =
      '<col class="jc-col-num">' +
      '<col class="jc-col-content">' +
      '<col class="jc-col-gutter">' +
      '<col class="jc-col-num">' +
      '<col class="jc-col-content">';
    this.table.appendChild(colgroup);

    this.tbody = document.createElement('tbody');
    this.table.appendChild(this.tbody);

    this.viewport.appendChild(this.table);
    this.spacer.appendChild(this.viewport);
    this.scrollContainer.appendChild(this.spacer);
    this.container.appendChild(this.scrollContainer);
  }

  /**
   * Set the line pairs to display.
   * @param {import('./align.js').LinePair[]} linePairs
   */
  setData(linePairs) {
    this.data = linePairs;
    this._computeLineNumbers();
    this.spacer.style.height = (this.data.length * this.rowHeight) + 'px';
    this._lastStart = -1;
    this._lastEnd = -1;
    this._render();
  }

  /** Pre-compute left/right line numbers for each row */
  _computeLineNumbers() {
    this.lineNumbers = [];
    let left = 1;
    let right = 1;
    for (const pair of this.data) {
      this.lineNumbers.push({
        left: pair.left !== null ? left : 0,
        right: pair.right !== null ? right : 0
      });
      if (pair.left !== null) left++;
      if (pair.right !== null) right++;
    }
  }

  /** Scroll event handler — requests a render on next animation frame */
  _onScroll() {
    if (this._rafId) return; // already scheduled
    this._rafId = requestAnimationFrame(() => {
      this._rafId = 0;
      this._render();
    });
  }

  /** Core render: compute visible range, update DOM if range changed */
  _render() {
    if (this.data.length === 0) {
      this.tbody.innerHTML = '';
      return;
    }

    const scrollTop = this.scrollContainer.scrollTop;
    const viewportHeight = this.scrollContainer.clientHeight;

    let startIdx = Math.floor(scrollTop / this.rowHeight) - this.overscan;
    let endIdx = Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + this.overscan;

    startIdx = Math.max(0, startIdx);
    endIdx = Math.min(this.data.length, endIdx);

    // Skip if range hasn't changed
    if (startIdx === this._lastStart && endIdx === this._lastEnd) return;

    this._lastStart = startIdx;
    this._lastEnd = endIdx;

    // Position the viewport div
    this.viewport.style.top = (startIdx * this.rowHeight) + 'px';

    // Build rows — using innerHTML for speed (one big string, one reflow)
    let html = '';
    for (let i = startIdx; i < endIdx; i++) {
      html += this._renderRow(i);
    }
    this.tbody.innerHTML = html;
  }

  /**
   * Render a single row as an HTML string.
   * @param {number} index
   * @returns {string}
   */
  _renderRow(index) {
    const pair = this.data[index];
    const nums = this.lineNumbers[index];

    const leftContent = pair.left !== null
      ? (this.syntaxHighlight ? highlightLine(pair.left) : escapeHtml(pair.left))
      : '';
    const rightContent = pair.right !== null
      ? (this.syntaxHighlight ? highlightLine(pair.right) : escapeHtml(pair.right))
      : '';

    const leftClass = pair.left !== null ? 'jc-' + pair.type : 'jc-empty';
    const rightClass = pair.right !== null ? 'jc-' + pair.type : 'jc-empty';

    const leftNum = nums.left > 0 ? String(nums.left) : '';
    const rightNum = nums.right > 0 ? String(nums.right) : '';

    return '<tr class="jc-row jc-row-' + pair.type + '" style="height:' + this.rowHeight + 'px">' +
      '<td class="jc-line-num">' + leftNum + '</td>' +
      '<td class="jc-content ' + leftClass + '"><pre>' + leftContent + '</pre></td>' +
      '<td class="jc-gutter"></td>' +
      '<td class="jc-line-num">' + rightNum + '</td>' +
      '<td class="jc-content ' + rightClass + '"><pre>' + rightContent + '</pre></td>' +
      '</tr>';
  }

  /**
   * Scroll to the first line matching a given type.
   * Useful for "jump to next change".
   *
   * @param {'added'|'removed'|'changed'} type
   * @param {number} [afterIndex=0] - Start searching after this index
   * @returns {number} The index scrolled to, or -1 if not found
   */
  scrollToNextDiff(type, afterIndex = 0) {
    for (let i = afterIndex; i < this.data.length; i++) {
      if (this.data[i].type === type || (type === undefined && this.data[i].type !== 'equal')) {
        this.scrollContainer.scrollTop = i * this.rowHeight;
        return i;
      }
    }
    return -1;
  }

  /**
   * Scroll to the first difference of any type.
   * @param {number} [afterIndex=0]
   * @returns {number}
   */
  scrollToNextChange(afterIndex = 0) {
    return this.scrollToNextDiff(undefined, afterIndex);
  }

  /** Clean up event listeners and DOM */
  destroy() {
    this.scrollContainer.removeEventListener('scroll', this._onScroll);
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.container.innerHTML = '';
  }
}
