import { describe, expect, it } from 'vitest';
import { walkScore } from '@/lib/scoring/walk';
import { CATEGORIES } from '@/lib/scoring/categories';
import { parseAmenityElements, type OverpassElement } from '@/lib/providers/overpass';
import type { Amenity } from '@/lib/report/types';
import denseUrban from '../fixtures/dense-urban.json';
import rural from '../fixtures/rural.json';
import carDependent from '../fixtures/car-dependent.json';

const DC = { lat: 38.8977, lon: -77.0365 };
const VT = { lat: 44.2159, lon: -73.274 }; // matches rural.json's recording origin
const TX = { lat: 33.081, lon: -96.718 }; // matches car-dependent.json's recording origin

const amenity = (over: Partial<Amenity>): Amenity => ({
  id: 1, name: 'Test', category: 'grocery', lat: 0, lon: 0, distanceM: 100, ...over,
});

describe('walkScore', () => {
  it('returns 0 when there are no amenities', () => {
    expect(walkScore([])).toBe(0);
  });

  it('scores a dense urban address highly', () => {
    const score = walkScore(parseAmenityElements(denseUrban.elements, DC));
    expect(score).toBeGreaterThan(65);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('does not saturate the 0-100 ceiling for a dense address', () => {
    // Regression test. An earlier formula scaled a value that ranged to 1.75 by
    // 100, so DC, Brookline and Plano all pinned to exactly 100 — a 0-point
    // spread across three very different places. The score must discriminate.
    const urban = walkScore(parseAmenityElements(denseUrban.elements, DC));
    expect(urban).toBeGreaterThan(65);
    expect(urban).toBeLessThan(100);
  });

  it('separates a dense city from a rural address by a wide margin', () => {
    const urban = walkScore(parseAmenityElements(denseUrban.elements, DC));
    // Cast needed: TS infers an overly-narrow literal-union type for this
    // small fixture's heterogeneous `tags` shapes (same issue documented in
    // tests/providers/overpass.test.ts).
    const country = walkScore(
      parseAmenityElements(rural.elements as unknown as OverpassElement[], VT),
    );
    expect(urban - country).toBeGreaterThan(50);
  });

  it('scores a car-dependent suburb well below a dense city', () => {
    // Measured: DC 78, Plano 30. The Plano fixture is a residential mid-block
    // point with no cafe or retail within 2 km — an earlier fixture sat in a
    // strip-mall car park and scored 78, which is why this assertion once failed.
    const urban = walkScore(parseAmenityElements(denseUrban.elements, DC));
    const suburb = walkScore(
      parseAmenityElements(carDependent.elements as unknown as OverpassElement[], TX),
    );
    expect(suburb).toBeLessThan(urban - 30);
  });

  it('scores a rural address low', () => {
    expect(
      walkScore(parseAmenityElements(rural.elements as unknown as OverpassElement[], VT)),
    ).toBeLessThan(15);
  });

  it('never exceeds 100 even with hundreds of adjacent amenities', () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      amenity({ id: i, category: 'dining', distanceM: 20 }),
    );
    expect(walkScore(many)).toBeLessThanOrEqual(100);
  });

  it('rewards a closer amenity over a further one', () => {
    const near = [amenity({ distanceM: 100 })];
    const far = [amenity({ distanceM: 1800 })];
    expect(walkScore(near)).toBeGreaterThan(walkScore(far));
  });

  it('rewards category variety over repetition of one category', () => {
    const varied: Amenity[] = [
      amenity({ id: 1, category: 'grocery', distanceM: 300 }),
      amenity({ id: 2, category: 'cafe', distanceM: 300 }),
      amenity({ id: 3, category: 'parks', distanceM: 300 }),
      amenity({ id: 4, category: 'errands', distanceM: 300 }),
    ];
    const repetitive: Amenity[] = [1, 2, 3, 4].map((id) =>
      amenity({ id, category: 'grocery', distanceM: 300 }),
    );
    expect(walkScore(varied)).toBeGreaterThan(walkScore(repetitive));
  });

  it('ignores amenities beyond the 2km radius', () => {
    // One amenity at 1900 m contributes ~0.3 points and rounds to 0 either way,
    // so the boundary only shows with a full complement of categories.
    const atDistance = (distanceM: number) =>
      CATEGORIES.map((c, i) => amenity({ id: i, category: c.id, distanceM }));
    expect(walkScore(atDistance(2100))).toBe(0);
    expect(walkScore(atDistance(1900))).toBeGreaterThan(0);
  });
});
