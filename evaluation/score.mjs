import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const fields = ['merchantName', 'receiptType', 'date', 'totalAmount', 'currency'];
export function needsReview(data) {
  return !(data.merchantName?.trim() && data.receiptType && data.currency?.trim() &&
    data.totalAmount !== null && data.totalAmount > 0 && data.date?.trim() && data.confidence !== 'low');
}

export function score(dataset, run) {
  if (!['mock', 'live-recorded'].includes(run.mode)) throw new Error('Declare mode: mock or live-recorded');
  if (run.mode === 'live-recorded' && (!run.model || !run.recordedAt)) throw new Error('Recorded runs require model and recordedAt');
  const fixtures = dataset.receipts;
  if (!fixtures.length || new Set(fixtures.map(x => x.id)).size !== fixtures.length) throw new Error('Empty or duplicate fixtures');
  const predictions = new Map();
  for (const row of run.predictions) {
    if (predictions.has(row.id) || !fixtures.some(x => x.id === row.id)) throw new Error(`Duplicate or unknown prediction: ${row.id}`);
    predictions.set(row.id, row);
  }
  if (predictions.size !== fixtures.length) throw new Error('Provide exactly one prediction per fixture, including failures');
  const counts = Object.fromEntries(fields.map(field => [field, 0]));
  let review = 0, exact = 0;
  const numericTotals = { correct: 0, count: 0 };
  const measurements = { latencyMs: [], costUsd: [] };
  const rows = fixtures.map(fixture => {
    const prediction = predictions.get(fixture.id);
    const extraction = prediction.extraction;
    if (!extraction && !prediction.error) throw new Error(`Missing extraction or error: ${fixture.id}`);
    if (extraction && prediction.error) throw new Error(`Ambiguous prediction: ${fixture.id}`);
    if (extraction && (!fields.every(f => Object.hasOwn(extraction, f)) ||
      !['low', 'medium', 'high'].includes(extraction.confidence) ||
      !fields.filter(f => f !== 'totalAmount').every(f => extraction[f] === null || typeof extraction[f] === 'string') ||
      !(extraction.totalAmount === null || (typeof extraction.totalAmount === 'number' && Number.isFinite(extraction.totalAmount))))) {
      throw new Error(`Invalid extraction: ${fixture.id}`);
    }
    const matches = Object.fromEntries(fields.map(field => {
      const expected = fixture.expected[field];
      const actual = extraction?.[field];
      // Strict strings, explicit null agreement, amounts rounded to hundredths (no relative tolerance).
      const match = !!extraction && (field === 'totalAmount' && expected !== null && actual !== null
        ? Math.round(expected * 100) === Math.round(actual * 100) : actual === expected);
      counts[field] += Number(match);
      return [field, match];
    }));
    const requiresReview = !extraction || needsReview(extraction);
    review += Number(requiresReview);
    exact += Number(Object.values(matches).every(Boolean));
    if (fixture.expected.totalAmount !== null) {
      numericTotals.count++;
      numericTotals.correct += Number(matches.totalAmount);
    }
    for (const key of Object.keys(measurements)) {
      const value = prediction[key];
      if (value !== undefined && value !== null) {
        if (run.mode === 'mock') throw new Error('Do not attach provider measurements to mock predictions');
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${key}`);
        measurements[key].push(value);
      }
    }
    return { id: fixture.id, matches, requiresReview, failed: !extraction };
  });
  const measurement = key => {
    const values = measurements[key];
    return { measuredCount: values.length, mean: values.length ? values.reduce((a,b) => a+b, 0) / values.length : null };
  };
  return {
    dataset: dataset.dataset, mode: run.mode, model: run.model ?? null, recordedAt: run.recordedAt ?? null,
    receiptCount: fixtures.length,
    fieldAccuracy: Object.fromEntries(fields.map(f => [f, counts[f] / fixtures.length])),
    overallFieldAccuracy: Object.values(counts).reduce((a,b) => a+b, 0) / (fixtures.length * fields.length),
    totalAccuracy: numericTotals.count ? numericTotals.correct / numericTotals.count : null,
    totalEvaluatedCount: numericTotals.count,
    exactReceiptAccuracy: exact / fixtures.length, reviewRate: review / fixtures.length,
    latencyMs: measurement('latencyMs'), costUsd: measurement('costUsd'), rows
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: node evaluation/score.mjs predictions.json');
  const dataset = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(score(dataset, JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2));
}
