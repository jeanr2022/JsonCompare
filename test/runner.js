/**
 * Minimal test runner compatible with Node 16+.
 * Provides describe/it/assert similar to node:test.
 */

let totalPassed = 0;
let totalFailed = 0;
const failures = [];
const queue = [];

export function describe(name, fn) {
  queue.push(async () => {
    console.log(`\n  ${name}`);
    await fn();
  });
}

export function it(name, fn) {
  queue.push(async () => {
    try {
      await fn();
      totalPassed++;
      console.log(`    ✓ ${name}`);
    } catch (err) {
      totalFailed++;
      console.log(`    ✗ ${name}`);
      console.log(`      ${err.message}`);
      failures.push({ name, error: err });
    }
  });
}

export async function summary() {
  for (const task of queue) {
    await task();
  }
  console.log(`\n  ${totalPassed} passing, ${totalFailed} failing\n`);
  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

export function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertOk(value, msg) {
  if (!value) {
    throw new Error(msg || `Expected truthy value, got ${JSON.stringify(value)}`);
  }
}

export function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(msg || `Expected ${b}, got ${a}`);
  }
}
