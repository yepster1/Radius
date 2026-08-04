import { describe, expect, it } from 'vitest';
import { transitScore } from '@/lib/scoring/transit';
import type { TransitStop } from '@/lib/report/types';

const stop = (over: Partial<TransitStop>): TransitStop => ({
  id: 1, name: 'Stop', mode: 'bus', routeCount: 1, distanceM: 300, ...over,
});

describe('transitScore', () => {
  it('returns 0 with no stops', () => {
    expect(transitScore([])).toBe(0);
  });

  it('scores a rail station above a bus stop at the same distance', () => {
    expect(transitScore([stop({ mode: 'rail' })]))
      .toBeGreaterThan(transitScore([stop({ mode: 'bus' })]));
  });

  it('rewards more routes at one stop', () => {
    expect(transitScore([stop({ routeCount: 6 })]))
      .toBeGreaterThan(transitScore([stop({ routeCount: 1 })]));
  });

  it('rewards a closer stop', () => {
    expect(transitScore([stop({ distanceM: 150 })]))
      .toBeGreaterThan(transitScore([stop({ distanceM: 1400 })]));
  });

  it('ignores stops beyond 1500m', () => {
    expect(transitScore([stop({ distanceM: 1600 })])).toBe(0);
  });

  it('caps at 100 for a transit-saturated location', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      stop({ id: i, mode: 'rail', routeCount: 8, distanceM: 120 }),
    );
    expect(transitScore(many)).toBe(100);
  });
});
