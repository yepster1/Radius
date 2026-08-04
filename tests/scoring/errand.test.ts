import { describe, expect, it } from 'vitest';
import { errandScore, fifteenMinuteBreakdown } from '@/lib/scoring/errand';
import type { Amenity, CategoryId } from '@/lib/report/types';

const at = (category: CategoryId, distanceM: number, id = 1): Amenity => ({
  id, name: 'Test', category, lat: 0, lon: 0, distanceM,
});

describe('errandScore', () => {
  it('is 0 with no amenities', () => {
    expect(errandScore([])).toBe(0);
  });

  it('is 100 when all nine categories are within 1200m', () => {
    const all: Amenity[] = (
      ['grocery','dining','cafe','retail','errands','parks','schools','culture','fitness'] as CategoryId[]
    ).map((c, i) => at(c, 500, i));
    expect(errandScore(all)).toBe(100);
  });

  it('counts each category once regardless of how many instances', () => {
    const five = [1, 2, 3, 4, 5].map((i) => at('cafe', 300, i));
    expect(errandScore(five)).toBe(errandScore([at('cafe', 300)]));
  });

  it('excludes categories only reachable beyond 1200m', () => {
    expect(errandScore([at('grocery', 1300)])).toBe(0);
  });
});

describe('fifteenMinuteBreakdown', () => {
  it('splits categories into met and missing', () => {
    const { met, missing } = fifteenMinuteBreakdown([
      at('grocery', 400, 1),
      at('cafe', 600, 2),
    ]);
    expect(met).toEqual(['grocery', 'cafe']);
    expect(missing).toContain('schools');
    expect(met.length + missing.length).toBe(9);
  });

  it('reports everything missing for an empty dataset', () => {
    const { met, missing } = fifteenMinuteBreakdown([]);
    expect(met).toEqual([]);
    expect(missing).toHaveLength(9);
  });
});
