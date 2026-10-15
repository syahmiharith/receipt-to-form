import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { score } from './score.mjs';
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const fixtures = read('./fixtures.json');
const mock = () => read('./mock-predictions.json');
test('authored mock mistake, missing labels and review policy produce known scores', () => {
  const result = score(fixtures, mock());
  assert.equal(result.overallFieldAccuracy, 29/30);
  assert.equal(result.totalAccuracy, 4/5);
  assert.equal(result.fieldAccuracy.totalAmount, 5/6);
  assert.equal(result.reviewRate, 2/6);
  assert.equal(result.exactReceiptAccuracy, 5/6);
  assert.deepEqual(result.latencyMs, { measuredCount: 0, mean: null });
  assert.deepEqual(result.costUsd, { measuredCount: 0, mean: null });
});
test('failures remain in denominator and require review', () => {
  const run = mock(); run.predictions[0] = { id: run.predictions[0].id, error: 'timeout' };
  const result = score(fixtures, run);
  assert.equal(result.overallFieldAccuracy, 24/30);
  assert.equal(result.reviewRate, 3/6);
});
test('rejects incomplete, duplicate, unknown and malformed predictions', () => {
  for (const mutate of [r => r.predictions.pop(), r => r.predictions.push(r.predictions[0]), r => r.predictions[0].id = 'unknown', r => delete r.predictions[0].extraction.date, r => r.predictions[0].extraction.totalAmount = '23.32']) {
    const run = mock(); mutate(run); assert.throws(() => score(fixtures, run));
  }
});
test('only explicit recorded measurements are aggregated with coverage', () => {
  const run = mock(); run.predictions[0].latencyMs = 100;
  assert.throws(() => score(fixtures, run));
  run.mode = 'live-recorded'; assert.throws(() => score(fixtures, run));
  run.model = 'test-only'; run.recordedAt = '2026-01-01T00:00:00Z';
  run.predictions[0].costUsd = 0;
  const result = score(fixtures, run);
  assert.deepEqual(result.latencyMs, { measuredCount: 1, mean: 100 });
  assert.deepEqual(result.costUsd, { measuredCount: 1, mean: 0 });
  run.predictions[0].latencyMs = -1; assert.throws(() => score(fixtures, run));
});
test('totals compare in hundredths without accepting a wrong subtotal', () => {
  const run = mock(); run.predictions[0].extraction.totalAmount = 23.32000001;
  assert.equal(score(fixtures, run).rows[0].matches.totalAmount, true);
  run.predictions[0].extraction.totalAmount = 22;
  assert.equal(score(fixtures, run).rows[0].matches.totalAmount, false);
});
