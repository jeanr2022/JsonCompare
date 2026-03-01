import { highlightLine, escapeHtml } from './syntax.js';

/**
 * @typedef {Object} RenderOptions
 * @property {number} [foldThreshold=5] - Minimum consecutive equal lines before folding.
 *   Set to 0 to fold all unchanged sections. Set to Infinity to disable folding.
 * @property {boolean} [syntaxHighlight=true] - Enable JSON syntax highlighting.
 */

/**
 * Render an array of line pairs into a side-by-side HTML table string.
 *
 * The output is a self-contained HTML fragment (no external DOM dependencies)
 * that works in both Node.js (as a string for SSR) and browser (innerHTML).
 *
 * @param {import('./align.js').LinePair[]} linePairs
 * @param {RenderOptions} [options]
 * @returns {string} HTML string
 */
export function renderHTML(linePairs, options = {}) {
  const foldThreshold = options.foldThreshold !== undefined ? options.foldThreshold : 5;
  const syntaxHighlight = options.syntaxHighlight !== undefined ? options.syntaxHighlight : true;

  // Group consecutive equal lines for folding
  const groups = groupLines(linePairs, foldThreshold);

  let html = '<div class="jc-container">\n';
  html += '<table class="jc-table">\n';
  html += '<colgroup>';
  html += '<col class="jc-col-num">';
  html += '<col class="jc-col-content">';
  html += '<col class="jc-col-gutter">';
  html += '<col class="jc-col-num">';
  html += '<col class="jc-col-content">';
  html += '</colgroup>\n';

  let leftLineNum = 1;
  let rightLineNum = 1;

  for (const group of groups) {
    if (group.folded) {
      // Render as a collapsible section
      const count = group.pairs.length;
      html += '<tr class="jc-fold-row">';
      html += '<td colspan="5" class="jc-fold-cell">';
      html += '<details>';
      html += '<summary class="jc-fold-summary">' + escapeHtml(count + ' unchanged lines') + '</summary>';
      html += '<table class="jc-table jc-fold-inner">';
      html += '<colgroup>';
      html += '<col class="jc-col-num">';
      html += '<col class="jc-col-content">';
      html += '<col class="jc-col-gutter">';
      html += '<col class="jc-col-num">';
      html += '<col class="jc-col-content">';
      html += '</colgroup>';

      for (const pair of group.pairs) {
        html += renderRow(pair, leftLineNum, rightLineNum, syntaxHighlight);
        if (pair.left !== null) leftLineNum++;
        if (pair.right !== null) rightLineNum++;
      }

      html += '</table>';
      html += '</details>';
      html += '</td>';
      html += '</tr>\n';
    } else {
      for (const pair of group.pairs) {
        html += renderRow(pair, leftLineNum, rightLineNum, syntaxHighlight);
        if (pair.left !== null) leftLineNum++;
        if (pair.right !== null) rightLineNum++;
      }
    }
  }

  html += '</table>\n';
  html += '</div>';

  return html;
}

/**
 * Render a single table row for one line pair.
 *
 * @param {import('./align.js').LinePair} pair
 * @param {number} leftNum
 * @param {number} rightNum
 * @param {boolean} syntaxHighlight
 * @returns {string}
 */
function renderRow(pair, leftNum, rightNum, syntaxHighlight) {
  const leftContent = pair.left !== null
    ? (syntaxHighlight ? highlightLine(pair.left) : escapeHtml(pair.left))
    : '';
  const rightContent = pair.right !== null
    ? (syntaxHighlight ? highlightLine(pair.right) : escapeHtml(pair.right))
    : '';

  const leftClass = pair.left !== null ? 'jc-' + pair.type : 'jc-empty';
  const rightClass = pair.right !== null ? 'jc-' + pair.type : 'jc-empty';

  const leftNumStr = pair.left !== null ? String(leftNum) : '';
  const rightNumStr = pair.right !== null ? String(rightNum) : '';

  let row = '<tr class="jc-row jc-row-' + pair.type + '">';
  row += '<td class="jc-line-num">' + leftNumStr + '</td>';
  row += '<td class="jc-content ' + leftClass + '"><pre>' + leftContent + '</pre></td>';
  row += '<td class="jc-gutter"></td>';
  row += '<td class="jc-line-num">' + rightNumStr + '</td>';
  row += '<td class="jc-content ' + rightClass + '"><pre>' + rightContent + '</pre></td>';
  row += '</tr>\n';

  return row;
}

/**
 * Group line pairs into foldable and non-foldable segments.
 *
 * @param {import('./align.js').LinePair[]} pairs
 * @param {number} foldThreshold
 * @returns {{ folded: boolean, pairs: import('./align.js').LinePair[] }[]}
 */
function groupLines(pairs, foldThreshold) {
  if (foldThreshold === Infinity || pairs.length === 0) {
    return [{ folded: false, pairs }];
  }

  const groups = [];
  let currentEqual = [];
  let currentOther = [];

  function flushEqual() {
    if (currentEqual.length === 0) return;
    // foldThreshold of 0 means fold everything unchanged
    if (currentEqual.length > foldThreshold) {
      groups.push({ folded: true, pairs: currentEqual });
    } else {
      groups.push({ folded: false, pairs: currentEqual });
    }
    currentEqual = [];
  }

  function flushOther() {
    if (currentOther.length === 0) return;
    groups.push({ folded: false, pairs: currentOther });
    currentOther = [];
  }

  for (const pair of pairs) {
    if (pair.type === 'equal') {
      flushOther();
      currentEqual.push(pair);
    } else {
      flushEqual();
      currentOther.push(pair);
    }
  }

  flushEqual();
  flushOther();

  return groups;
}
