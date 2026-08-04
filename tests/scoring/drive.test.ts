import { describe, expect, it } from 'vitest';
import { driveScore } from '@/lib/scoring/drive';
import { walkScore } from '@/lib/scoring/walk';
import { CATEGORIES } from '@/lib/scoring/categories';
import type { Amenity } from '@/lib/report/types';

const amenity = (over: Partial<Amenity>): Amenity => ({
  id: 1, name: 'Test', category: 'grocery', lat: 0, lon: 0, distanceM: 100, ...over,
});

describe('driveScore', () => {
  it('returns 0 with no amenities', () => {
    expect(driveScore([])).toBe(0);
  });

  it('counts amenities that Walk Score ignores as too far', () => {
    const far = [
      amenity({ id: 1, category: 'grocery', distanceM: 5000 }),
      amenity({ id: 2, category: 'retail', distanceM: 6000 }),
      amenity({ id: 3, category: 'errands', distanceM: 4500 }),
    ];
    expect(walkScore(far)).toBe(0);
    expect(driveScore(far)).toBeGreaterThan(0);
  });

  it('ignores amenities beyond the 8km radius', () => {
    expect(driveScore([amenity({ distanceM: 9000 })])).toBe(0);
  });

  it('weights a cafe less than a supermarket', () => {
    const cafe = driveScore([amenity({ category: 'cafe', distanceM: 1000 })]);
    const grocery = driveScore([amenity({ category: 'grocery', distanceM: 1000 })]);
    expect(grocery).toBeGreaterThan(cafe);
  });

  it('returns exactly 100 only when every category is at the doorstep', () => {
    // Stressing one category cannot reach the ceiling — the top-3 slice and
    // that category's share of total weight both bound it. Use all nine.
    const everything = CATEGORIES.flatMap((c, ci) =>
      [0, 1, 2].map((k) => amenity({ id: ci * 3 + k, category: c.id, distanceM: 0 })),
    );
    expect(driveScore(everything)).toBe(100);
    expect(driveScore([amenity({ category: 'retail', distanceM: 500 })]))
      .toBeLessThan(20);
  });
});
