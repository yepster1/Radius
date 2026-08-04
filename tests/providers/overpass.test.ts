import { afterEach, describe, expect, it } from 'vitest';
import denseUrban from '../fixtures/dense-urban.json';
import rural from '../fixtures/rural.json';
import {
  fetchStreetContext, parseAmenityElements, type OverpassElement,
} from '@/lib/providers/overpass';

const DC = { lat: 38.8977, lon: -77.0365 };
// NOTE: 44.4759, -73.2121 (as given in the task brief) is downtown
// Burlington's Main Street, not rural. Using a genuinely rural point
// ~20mi south (Ferrisburgh, VT) so this matches the fixture's name and intent.
const RURAL = { lat: 44.2159, lon: -73.2740 };

describe('parseAmenityElements', () => {
  it('maps OSM elements to typed amenities with distances', () => {
    const amenities = parseAmenityElements(denseUrban.elements, DC);
    expect(amenities.length).toBeGreaterThan(20);
    for (const a of amenities) {
      expect(a.distanceM).toBeGreaterThanOrEqual(0);
      expect(a.name).not.toBe('');
      expect(a.category).toBeTruthy();
    }
  });

  it('reads coordinates from `center` for way and relation elements', () => {
    const ways = denseUrban.elements.filter((e) => e.type === 'way' && e.center);
    expect(ways.length).toBeGreaterThan(0);
    const parsed = parseAmenityElements(ways, DC);
    expect(parsed.every((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon))).toBe(true);
  });

  it('drops elements with no resolvable coordinates', () => {
    const broken = [{ type: 'way', id: 1, tags: { amenity: 'cafe', name: 'Ghost' } }];
    expect(parseAmenityElements(broken, DC)).toHaveLength(0);
  });

  it('falls back to the category label when an element has no name', () => {
    const unnamed = [{ type: 'node', id: 2, lat: 38.8980, lon: -77.0360, tags: { amenity: 'cafe' } }];
    expect(parseAmenityElements(unnamed, DC)[0].name).toBe('Cafe');
  });

  it('sorts nearest first', () => {
    const amenities = parseAmenityElements(denseUrban.elements, DC);
    for (let i = 1; i < amenities.length; i += 1) {
      expect(amenities[i].distanceM).toBeGreaterThanOrEqual(amenities[i - 1].distanceM);
    }
  });

  it('returns few or no amenities for the rural fixture', () => {
    // Cast needed: TS infers an overly-narrow literal-union type for this
    // small (3-element) fixture's heterogeneous `tags` shapes, which fails
    // Record<string, string> assignability even though the runtime data is
    // fine — the same call on the 2000+ element dense-urban fixture above
    // does not need this because TS widens large literal arrays instead.
    const amenities = parseAmenityElements(rural.elements as unknown as OverpassElement[], RURAL);
    expect(amenities.length).toBeLessThan(15);
  });

  it('returns an empty array for an empty element list', () => {
    expect(parseAmenityElements([], DC)).toEqual([]);
  });
});

describe('fetchStreetContext', () => {
  afterEach(() => {
    delete process.env.RADIUS_FIXTURE_MODE;
  });

  it('reports unavailable in fixture mode — the values are DC placeholders, not a real lookup', async () => {
    process.env.RADIUS_FIXTURE_MODE = '1';
    const street = await fetchStreetContext(DC);
    expect(street.available).toBe(false);
  });
});
