import { describe, expect, it } from 'vitest';
import { isExtractionComplete, receiptExtractionSchema } from '@/lib/receipt';
import predictions from '../../evaluation/mock-predictions.json';
// @ts-expect-error The dependency-free offline scorer is native JavaScript.
import { needsReview } from '../../evaluation/score.mjs';

describe('offline evaluation review policy', () => {
  it('agrees with application completeness rules for fixtures and edge cases', () => {
    const examples = predictions.predictions.map(row => row.extraction);
    const complete = examples[0];
    const cases = [...examples, ...[null, '', ' '].flatMap(value =>
      ['merchantName', 'receiptType', 'currency', 'date'].map(field => ({ ...complete, [field]: value }))),
      ...[null, 0, -1].map(totalAmount => ({ ...complete, totalAmount })),
      ...['low', 'medium', 'high'].map(confidence => ({ ...complete, confidence }))];
    for (const sample of cases) {
      // Invalid enum strings are tested only against the application's completeness predicate.
      const extraction = { ...receiptExtractionSchema.parse(complete), ...sample };
      expect(needsReview(extraction)).toBe(!isExtractionComplete(extraction as Parameters<typeof isExtractionComplete>[0]));
    }
  });
});
