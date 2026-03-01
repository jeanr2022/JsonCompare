/**
 * Regex-based JSON syntax highlighter.
 * Takes a single line of pretty-printed JSON and wraps tokens in <span> tags.
 *
 * CSS classes:
 *   .jc-key     — object keys
 *   .jc-string  — string values
 *   .jc-number  — numbers
 *   .jc-bool    — true / false
 *   .jc-null    — null
 *   .jc-brace   — { } [ ]
 *   .jc-comma   — commas and colons
 */

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Highlight a single line of JSON text with <span> wrappers.
 *
 * @param {string} line - A single line from pretty-printed JSON
 * @returns {string} HTML string with syntax-highlighted spans
 */
export function highlightLine(line) {
  // We process the line character by character to handle all JSON tokens correctly.
  // This avoids regex ordering issues.
  let result = '';
  let i = 0;
  const len = line.length;

  // Track whether the next string token is a key (followed by ':')
  while (i < len) {
    const ch = line[i];

    // Whitespace — preserve as-is
    if (ch === ' ' || ch === '\t') {
      result += ch;
      i++;
      continue;
    }

    // Braces and brackets
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      result += '<span class="jc-brace">' + escapeHtml(ch) + '</span>';
      i++;
      continue;
    }

    // Comma or colon
    if (ch === ',' || ch === ':') {
      result += '<span class="jc-comma">' + escapeHtml(ch) + '</span>';
      i++;
      // Preserve space after colon
      if (ch === ':' && i < len && line[i] === ' ') {
        result += ' ';
        i++;
      }
      continue;
    }

    // String (key or value)
    if (ch === '"') {
      const strStart = i;
      i++; // skip opening quote
      while (i < len) {
        if (line[i] === '\\') {
          i += 2; // skip escape sequence
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          i++;
        }
      }
      const raw = line.slice(strStart, i);

      // Determine if this is a key: look ahead for ':'
      let j = i;
      while (j < len && (line[j] === ' ' || line[j] === '\t')) j++;
      const isKey = j < len && line[j] === ':';

      const cls = isKey ? 'jc-key' : 'jc-string';
      result += '<span class="' + cls + '">' + escapeHtml(raw) + '</span>';
      continue;
    }

    // Number
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const numStart = i;
      if (ch === '-') i++;
      while (i < len && ((line[i] >= '0' && line[i] <= '9') || line[i] === '.' || line[i] === 'e' || line[i] === 'E' || line[i] === '+' || line[i] === '-')) {
        // Avoid consuming '-' if it's not after e/E
        if ((line[i] === '+' || line[i] === '-') && line[i - 1] !== 'e' && line[i - 1] !== 'E') break;
        i++;
      }
      const numStr = line.slice(numStart, i);
      result += '<span class="jc-number">' + escapeHtml(numStr) + '</span>';
      continue;
    }

    // Boolean: true
    if (line.slice(i, i + 4) === 'true') {
      result += '<span class="jc-bool">true</span>';
      i += 4;
      continue;
    }

    // Boolean: false
    if (line.slice(i, i + 5) === 'false') {
      result += '<span class="jc-bool">false</span>';
      i += 5;
      continue;
    }

    // Null
    if (line.slice(i, i + 4) === 'null') {
      result += '<span class="jc-null">null</span>';
      i += 4;
      continue;
    }

    // Fallback — emit as-is (shouldn't happen in valid JSON)
    result += escapeHtml(ch);
    i++;
  }

  return result;
}
