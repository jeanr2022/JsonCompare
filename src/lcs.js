/**
 * Longest Common Subsequence (LCS) algorithm using dynamic programming.
 *
 * Given two arrays and an equality function, returns a list of match pairs
 * indicating which elements from array A align with which elements from array B.
 *
 * @param {any[]} a - First array
 * @param {any[]} b - Second array
 * @param {(a: any, b: any) => boolean} eq - Equality comparator
 * @returns {{ aIndex: number, bIndex: number }[]} Matched index pairs in order
 */
export function lcs(a, b, eq) {
  const m = a.length;
  const n = b.length;

  // Build DP table
  // dp[i][j] = length of LCS of a[0..i-1] and b[0..j-1]
  const dp = new Array(m + 1);
  for (let i = 0; i <= m; i++) {
    dp[i] = new Uint32Array(n + 1); // initialized to 0
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (eq(a[i - 1], b[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = dp[i - 1][j] > dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1];
      }
    }
  }

  // Backtrack to find the actual subsequence pairs
  const pairs = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (eq(a[i - 1], b[j - 1])) {
      pairs.push({ aIndex: i - 1, bIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  pairs.reverse();
  return pairs;
}
