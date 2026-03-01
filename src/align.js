/**
 * @typedef {Object} LinePair
 * @property {string|null} left  - Left-side text (null = empty/missing line)
 * @property {string|null} right - Right-side text (null = empty/missing line)
 * @property {'equal'|'added'|'removed'|'changed'} type
 */

/**
 * Convert any JSON-compatible value to pretty-printed lines.
 * Each line is a string like:  '  "key": "value",'
 *
 * @param {*} value
 * @param {string} indent - Current indentation prefix
 * @param {boolean} trailingComma - Whether to append a comma to the last line
 * @returns {string[]}
 */
function valueToLines(value, indent, trailingComma) {
  const comma = trailingComma ? ',' : '';

  if (value === null) {
    return [indent + 'null' + comma];
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return [indent + String(value) + comma];
  }

  if (typeof value === 'string') {
    return [indent + JSON.stringify(value) + comma];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [indent + '[]' + comma];
    }
    const lines = [indent + '['];
    const childIndent = indent + '  ';
    for (let i = 0; i < value.length; i++) {
      const childLines = valueToLines(value[i], childIndent, i < value.length - 1);
      lines.push(...childLines);
    }
    lines.push(indent + ']' + comma);
    return lines;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return [indent + '{}' + comma];
    }
    const lines = [indent + '{'];
    const childIndent = indent + '  ';
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const isLast = i === keys.length - 1;
      const childComma = !isLast;

      const childVal = value[k];
      // For primitive values, emit key: value on one line
      if (childVal === null || typeof childVal !== 'object') {
        const valStr = childVal === null ? 'null'
          : typeof childVal === 'string' ? JSON.stringify(childVal)
          : String(childVal);
        lines.push(childIndent + JSON.stringify(k) + ': ' + valStr + (childComma ? ',' : ''));
      } else {
        // For objects/arrays, emit key: then the nested structure
        const nested = valueToLines(childVal, childIndent, childComma);
        // Merge the opening brace/bracket onto the key line
        const opener = nested[0].trimStart(); // '{' or '['
        lines.push(childIndent + JSON.stringify(k) + ': ' + opener);
        for (let n = 1; n < nested.length; n++) {
          lines.push(nested[n]);
        }
      }
    }
    lines.push(indent + '}' + comma);
    return lines;
  }

  return [indent + String(value) + comma];
}

/**
 * Walk a diff tree produced by diffValues() and emit aligned line pairs.
 *
 * @param {import('./diff.js').DiffNode} node
 * @param {string} indent
 * @param {boolean} trailingComma
 * @param {LinePair[]} out - Accumulator
 */
function walkDiff(node, indent, trailingComma, out) {
  const comma = trailingComma ? ',' : '';

  switch (node.type) {
    case 'equal': {
      const lines = valueToLines(node.valueA, indent, trailingComma);
      for (const line of lines) {
        out.push({ left: line, right: line, type: 'equal' });
      }
      break;
    }

    case 'changed': {
      // Both are primitives with different values
      const leftStr = node.valueA === null ? 'null'
        : typeof node.valueA === 'string' ? JSON.stringify(node.valueA)
        : String(node.valueA);
      const rightStr = node.valueB === null ? 'null'
        : typeof node.valueB === 'string' ? JSON.stringify(node.valueB)
        : String(node.valueB);
      out.push({
        left: indent + leftStr + comma,
        right: indent + rightStr + comma,
        type: 'changed'
      });
      break;
    }

    case 'added': {
      const lines = valueToLines(node.valueB, indent, trailingComma);
      for (const line of lines) {
        out.push({ left: null, right: line, type: 'added' });
      }
      break;
    }

    case 'removed': {
      const lines = valueToLines(node.valueA, indent, trailingComma);
      for (const line of lines) {
        out.push({ left: line, right: null, type: 'removed' });
      }
      break;
    }

    case 'typeChanged': {
      // Completely different types: show left as removed, right as added
      const leftLines = valueToLines(node.valueA, indent, trailingComma);
      const rightLines = valueToLines(node.valueB, indent, trailingComma);

      // Pair them up side-by-side as "changed" where both exist
      const maxLen = Math.max(leftLines.length, rightLines.length);
      for (let i = 0; i < maxLen; i++) {
        const l = i < leftLines.length ? leftLines[i] : null;
        const r = i < rightLines.length ? rightLines[i] : null;
        if (l !== null && r !== null) {
          out.push({ left: l, right: r, type: 'changed' });
        } else if (l !== null) {
          out.push({ left: l, right: null, type: 'removed' });
        } else {
          out.push({ left: null, right: r, type: 'added' });
        }
      }
      break;
    }

    case 'object': {
      const children = node.children;
      if (children.length === 0) {
        out.push({ left: indent + '{}' + comma, right: indent + '{}' + comma, type: 'equal' });
        break;
      }

      // Opening brace
      out.push({ left: indent + '{', right: indent + '{', type: 'equal' });

      const childIndent = indent + '  ';
      for (let i = 0; i < children.length; i++) {
        const { key, diff } = children[i];
        const isLast = i === children.length - 1;
        const childComma = !isLast;
        const keyPrefix = childIndent + JSON.stringify(key) + ': ';

        // For container diffs (object/array), we need to emit the key on the
        // opening brace line and recurse for the contents.
        if (diff.type === 'object' || diff.type === 'array') {
          emitContainerChild(key, diff, childIndent, childComma, out);
        } else if (diff.type === 'equal') {
          // Equal value: emit key: value on both sides
          const valLines = valueToLines(diff.valueA, '', false);
          if (valLines.length === 1) {
            const line = keyPrefix + valLines[0].trimStart() + (childComma ? ',' : '');
            out.push({ left: line, right: line, type: 'equal' });
          } else {
            // Complex equal value (nested object/array that is fully equal)
            const opener = valLines[0].trimStart();
            const fullLine = keyPrefix + opener;
            out.push({ left: fullLine, right: fullLine, type: 'equal' });
            for (let n = 1; n < valLines.length - 1; n++) {
              const innerLine = childIndent + valLines[n].trimStart();
              out.push({ left: innerLine, right: innerLine, type: 'equal' });
            }
            const closerLine = childIndent + valLines[valLines.length - 1].trimStart();
            const finalLine = closerLine.replace(/,?\s*$/, '') + (childComma ? ',' : '');
            out.push({ left: finalLine, right: finalLine, type: 'equal' });
          }
        } else if (diff.type === 'changed') {
          const leftVal = diff.valueA === null ? 'null'
            : typeof diff.valueA === 'string' ? JSON.stringify(diff.valueA)
            : String(diff.valueA);
          const rightVal = diff.valueB === null ? 'null'
            : typeof diff.valueB === 'string' ? JSON.stringify(diff.valueB)
            : String(diff.valueB);
          out.push({
            left: keyPrefix + leftVal + (childComma ? ',' : ''),
            right: keyPrefix + rightVal + (childComma ? ',' : ''),
            type: 'changed'
          });
        } else if (diff.type === 'added') {
          const valLines = valueToLines(diff.valueB, '', false);
          if (valLines.length === 1) {
            out.push({
              left: null,
              right: keyPrefix + valLines[0].trimStart() + (childComma ? ',' : ''),
              type: 'added'
            });
          } else {
            const opener = valLines[0].trimStart();
            out.push({ left: null, right: keyPrefix + opener, type: 'added' });
            for (let n = 1; n < valLines.length - 1; n++) {
              out.push({ left: null, right: childIndent + valLines[n].trimStart(), type: 'added' });
            }
            const closer = childIndent + valLines[valLines.length - 1].trimStart();
            out.push({ left: null, right: closer.replace(/,?\s*$/, '') + (childComma ? ',' : ''), type: 'added' });
          }
        } else if (diff.type === 'removed') {
          const valLines = valueToLines(diff.valueA, '', false);
          if (valLines.length === 1) {
            out.push({
              left: keyPrefix + valLines[0].trimStart() + (childComma ? ',' : ''),
              right: null,
              type: 'removed'
            });
          } else {
            const opener = valLines[0].trimStart();
            out.push({ left: keyPrefix + opener, right: null, type: 'removed' });
            for (let n = 1; n < valLines.length - 1; n++) {
              out.push({ left: childIndent + valLines[n].trimStart(), right: null, type: 'removed' });
            }
            const closer = childIndent + valLines[valLines.length - 1].trimStart();
            out.push({ left: closer.replace(/,?\s*$/, '') + (childComma ? ',' : ''), right: null, type: 'removed' });
          }
        } else if (diff.type === 'typeChanged') {
          // Type changed: render left as removed, right as added for the keyed property
          const leftLines = valueToLines(diff.valueA, '', false);
          const rightLines = valueToLines(diff.valueB, '', false);

          // Emit with key prefix on first line
          const leftFirst = keyPrefix + leftLines[0].trimStart();
          const rightFirst = keyPrefix + rightLines[0].trimStart();

          if (leftLines.length === 1 && rightLines.length === 1) {
            out.push({
              left: leftFirst + (childComma ? ',' : ''),
              right: rightFirst + (childComma ? ',' : ''),
              type: 'changed'
            });
          } else {
            const maxLen = Math.max(leftLines.length, rightLines.length);
            for (let n = 0; n < maxLen; n++) {
              let l = null;
              let r = null;
              if (n === 0) {
                l = leftLines.length > 0 ? leftFirst : null;
                r = rightLines.length > 0 ? rightFirst : null;
              } else {
                l = n < leftLines.length ? childIndent + leftLines[n].trimStart() : null;
                r = n < rightLines.length ? childIndent + rightLines[n].trimStart() : null;
              }
              // Add comma on last line of each side
              const isLastLeft = n === leftLines.length - 1;
              const isLastRight = n === rightLines.length - 1;
              if (l !== null && isLastLeft) {
                l = l.replace(/,?\s*$/, '') + (childComma ? ',' : '');
              }
              if (r !== null && isLastRight) {
                r = r.replace(/,?\s*$/, '') + (childComma ? ',' : '');
              }

              const type = l !== null && r !== null ? 'changed'
                : l !== null ? 'removed' : 'added';
              out.push({ left: l, right: r, type });
            }
          }
        }
      }

      // Closing brace
      out.push({ left: indent + '}' + comma, right: indent + '}' + comma, type: 'equal' });
      break;
    }

    case 'array': {
      const children = node.children;
      if (children.length === 0) {
        out.push({ left: indent + '[]' + comma, right: indent + '[]' + comma, type: 'equal' });
        break;
      }

      // Opening bracket
      out.push({ left: indent + '[', right: indent + '[', type: 'equal' });

      const childIndent = indent + '  ';

      // We need to figure out trailing commas. The tricky part is that added/removed
      // items affect the visible child count on each side independently.
      // However for alignment simplicity, we treat list length as the children array length.
      for (let i = 0; i < children.length; i++) {
        const { diff } = children[i];
        const isLast = i === children.length - 1;
        const childComma = !isLast;

        if (diff.type === 'object' || diff.type === 'array') {
          walkDiff(diff, childIndent, childComma, out);
        } else {
          walkDiff(diff, childIndent, childComma, out);
        }
      }

      // Closing bracket
      out.push({ left: indent + ']' + comma, right: indent + ']' + comma, type: 'equal' });
      break;
    }
  }
}

/**
 * Emit a container child (object/array diff) with the key prefix on the opening brace line.
 *
 * @param {string} key
 * @param {import('./diff.js').DiffNode} diff
 * @param {string} childIndent
 * @param {boolean} childComma
 * @param {LinePair[]} out
 */
function emitContainerChild(key, diff, childIndent, childComma, out) {
  // Recurse into the container diff to get its line pairs
  const innerPairs = [];
  walkDiff(diff, childIndent, childComma, innerPairs);

  if (innerPairs.length === 0) return;

  // The first line pair should be the opening brace/bracket.
  // We prepend the key to it.
  const keyPrefix = JSON.stringify(key) + ': ';

  const first = innerPairs[0];
  out.push({
    left: first.left !== null
      ? childIndent + keyPrefix + first.left.trimStart()
      : null,
    right: first.right !== null
      ? childIndent + keyPrefix + first.right.trimStart()
      : null,
    type: first.type
  });

  // Emit the rest of the inner pairs, re-indenting them under the key
  for (let i = 1; i < innerPairs.length; i++) {
    const pair = innerPairs[i];
    out.push({
      left: pair.left !== null ? '  ' + pair.left : null,
      right: pair.right !== null ? '  ' + pair.right : null,
      type: pair.type
    });
  }
}

/**
 * Convert a diff tree into aligned line pairs for side-by-side display.
 *
 * @param {import('./diff.js').DiffNode} diffTree
 * @returns {LinePair[]}
 */
export function alignLines(diffTree) {
  const out = [];
  walkDiff(diffTree, '', false, out);
  return out;
}

/**
 * Return true when a line is purely a structural brace / bracket
 * (e.g. `{`, `}`, `[`, `]`, `},`) with no actual content.
 * These are excluded from "equal" counts so that two completely
 * different objects don't show misleading "2 equal" for the braces.
 */
function isStructuralLine(text) {
  if (!text) return false;
  return /^\s*[{}\[\]],?\s*$/.test(text);
}

/**
 * Compute summary statistics from line pairs.
 * Structural brace / bracket lines are excluded from the counts
 * so they don't inflate the "equal" number.
 *
 * @param {LinePair[]} linePairs
 * @returns {{ equal: number, added: number, removed: number, changed: number, total: number }}
 */
export function computeStats(linePairs) {
  const stats = { equal: 0, added: 0, removed: 0, changed: 0, total: 0 };
  for (const pair of linePairs) {
    if (pair.type === 'equal' && isStructuralLine(pair.left)) continue;
    stats[pair.type]++;
    stats.total++;
  }
  return stats;
}
