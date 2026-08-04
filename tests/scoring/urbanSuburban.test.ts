import { describe, expect, it } from 'vitest';
import { urbanSuburbanIndex } from '@/lib/scoring/urbanSuburban';
import { parseAmenityElements, type OverpassElement } from '@/lib/providers/overpass';
import type { Amenity, Coordinates } from '@/lib/report/types';
import denseUrban from '../fixtures/dense-urban.json';
import suburbanTransit from '../fixtures/suburban-transit.json';
import carDependent from '../fixtures/car-dependent.json';
import rural from '../fixtures/rural.json';

const many = (count: number): Amenity[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i, name: 'A', category: 'dining' as const, lat: 0, lon: 0, distanceM: 500,
  }));

describe('urbanSuburbanIndex', () => {
  it('labels an empty area Rural', () => {
    const { index, band } = urbanSuburbanIndex([], {
      intersectionsWithin1km: 2, buildingsWithin500m: 3, available: true,
    });
    expect(index).toBeLessThanOrEqual(25);
    expect(band).toBe('Rural');
  });

  it('labels a saturated area Dense Urban', () => {
    const { index, band } = urbanSuburbanIndex(many(200), {
      intersectionsWithin1km: 460, buildingsWithin500m: 600, available: true,
    });
    expect(index).toBeGreaterThan(75);
    expect(band).toBe('Dense Urban');
  });

  it('places a moderate area in a middle band', () => {
    const { band } = urbanSuburbanIndex(many(50), {
      intersectionsWithin1km: 240, buildingsWithin500m: 150, available: true,
    });
    expect(['Suburban', 'Urban']).toContain(band);
  });

  it('only counts amenities within 1km', () => {
    const far: Amenity[] = Array.from({ length: 200 }, (_, i) => ({
      id: i, name: 'A', category: 'dining' as const, lat: 0, lon: 0, distanceM: 1500,
    }));
    const near = urbanSuburbanIndex(many(200), { intersectionsWithin1km: 0, buildingsWithin500m: 0, available: true });
    const distant = urbanSuburbanIndex(far, { intersectionsWithin1km: 0, buildingsWithin500m: 0, available: true });
    expect(distant.index).toBeLessThan(near.index);
  });

  it('always returns an index within 0-100', () => {
    const { index } = urbanSuburbanIndex(many(5000), {
      intersectionsWithin1km: 9999, buildingsWithin500m: 9999, available: true,
    });
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThanOrEqual(100);
  });

  it('renormalises over amenity density alone when street data is unavailable', () => {
    const withStreet = urbanSuburbanIndex(many(200), {
      intersectionsWithin1km: 450, buildingsWithin500m: 380, available: true,
    });
    const without = urbanSuburbanIndex(many(200), {
      intersectionsWithin1km: 30, buildingsWithin500m: 0, available: false,
    });
    // Placeholder zeros must not drag a dense address toward suburban.
    expect(without.index).toBeGreaterThan(70);
    expect(Math.abs(without.index - withStreet.index)).toBeLessThan(35);
  });

  it('ranks the four reference locations sensibly on real fixture data', () => {
    // The assertion that matters: does the index order real places correctly?
    // Street data is marked unavailable so this exercises amenity density,
    // the one signal measurement showed to be reliable.
    const noStreet = {
      intersectionsWithin1km: 30, buildingsWithin500m: 0, available: false,
    };
    const score = (elements: unknown[], origin: Coordinates) =>
      urbanSuburbanIndex(
        parseAmenityElements(elements as OverpassElement[], origin),
        noStreet,
      ).index;

    const dc = score(denseUrban.elements, { lat: 38.8977, lon: -77.0365 });
    const brookline = score(suburbanTransit.elements, { lat: 42.3736, lon: -71.1097 });
    // NOTE: the brief's embedded test used { lat: 33.0198, lon: -96.6989 }
    // for Plano, which is ~7km from the point the fixture was actually
    // recorded around (scripts/record-fixtures.ts uses 33.0810, -96.7180,
    // matching this task's brief description). The fixture only contains
    // elements within 2km of the recording origin, so scoring from the
    // wrong point would put every element outside the 1km index radius and
    // silently zero out the amenity-density term. Corrected to match the
    // recording origin.
    const plano = score(carDependent.elements, { lat: 33.0810, lon: -96.7180 });
    const vt = score(rural.elements, { lat: 44.2159, lon: -73.274 });

    expect(vt).toBeLessThan(plano);
    expect(plano).toBeLessThan(Math.min(dc, brookline));
    expect(vt).toBeLessThan(20);
  });
});
