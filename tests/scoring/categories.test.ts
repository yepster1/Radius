import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoryById } from '@/lib/scoring/categories';

describe('CATEGORIES', () => {
  it('defines exactly the nine categories from the spec', () => {
    expect(CATEGORIES).toHaveLength(9);
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      'grocery', 'dining', 'cafe', 'retail', 'errands',
      'parks', 'schools', 'culture', 'fitness',
    ]);
  });

  it('gives every category at least one OSM tag filter', () => {
    for (const category of CATEGORIES) {
      expect(category.tags.length).toBeGreaterThan(0);
    }
  });

  it('has walk weights summing to 15 as specified', () => {
    const total = CATEGORIES.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBe(15);
  });

  it('weights grocery highest for walking', () => {
    const grocery = categoryById('grocery');
    for (const other of CATEGORIES) {
      expect(grocery.weight).toBeGreaterThanOrEqual(other.weight);
    }
  });

  it('weights cafe lower for driving than for walking', () => {
    const cafe = categoryById('cafe');
    expect(cafe.driveWeight).toBeLessThan(cafe.weight);
  });
});

describe('categoryById', () => {
  it('throws on an unknown id rather than returning undefined', () => {
    // @ts-expect-error deliberately invalid at the type level
    expect(() => categoryById('nightlife')).toThrow(/unknown category/i);
  });
});
