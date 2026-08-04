import { beforeEach, describe, expect, it, vi } from 'vitest';
import denseUrban from '../fixtures/dense-urban.json';
import { parseAmenityElements } from '@/lib/providers/overpass';

const DC = { lat: 38.8977, lon: -77.0365 };
const amenities = parseAmenityElements(denseUrban.elements, DC);

vi.mock('@/lib/providers/overpass', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/providers/overpass')>();
  return {
    ...actual,
    fetchAmenities: vi.fn(),
    fetchTransitStops: vi.fn(),
    fetchStreetContext: vi.fn(),
  };
});

const overpass = await import('@/lib/providers/overpass');
const { buildReport } = await import('@/lib/report/buildReport');

beforeEach(() => {
  vi.mocked(overpass.fetchAmenities).mockResolvedValue(amenities);
  vi.mocked(overpass.fetchTransitStops).mockResolvedValue([
    { id: 1, name: 'Metro Center', mode: 'rail', routeCount: 3, distanceM: 400 },
  ]);
  vi.mocked(overpass.fetchStreetContext).mockResolvedValue({
    intersectionsWithin1km: 439, buildingsWithin500m: 320, available: true,
  });
});

describe('buildReport', () => {
  it('assembles a complete report', async () => {
    const report = await buildReport('1600 Pennsylvania Ave NW', DC);
    expect(report.address).toBe('1600 Pennsylvania Ave NW');
    expect(report.coordinates).toEqual(DC);
    expect(report.slug).toMatch(/-[0-9a-z]{7}$/);
    expect(report.scores.walk).toBeGreaterThan(0);
    expect(report.scores.overall).toBeGreaterThan(0);
    expect(report.amenities.length).toBeGreaterThan(0);
    expect(report.fifteenMinute.met.length + report.fifteenMinute.missing.length).toBe(9);
  });

  it('fetches amenities at the 8km drive radius, not 2km', async () => {
    await buildReport('x', DC);
    expect(vi.mocked(overpass.fetchAmenities)).toHaveBeenCalledWith(DC, 8000);
  });

  it('still produces a report when transit lookup fails', async () => {
    vi.mocked(overpass.fetchTransitStops).mockRejectedValue(new Error('down'));
    const report = await buildReport('x', DC);
    expect(report.scores.transit).toBe(0);
    expect(report.scores.walk).toBeGreaterThan(0);
  });

  it('still produces a report when street context fails', async () => {
    vi.mocked(overpass.fetchStreetContext).mockRejectedValue(new Error('down'));
    const report = await buildReport('x', DC);
    expect(report.street.available).toBe(false);
    expect(report.scores.walk).toBeGreaterThan(0);
  });

  it('flags sparse data when very few amenities are found', async () => {
    vi.mocked(overpass.fetchAmenities).mockResolvedValue([]);
    const report = await buildReport('x', DC);
    expect(report.dataSparse).toBe(true);
  });

  it('does not flag sparse data for a dense address', async () => {
    expect((await buildReport('x', DC)).dataSparse).toBe(false);
  });

  it('throws when amenity lookup fails entirely — there is no report without it', async () => {
    vi.mocked(overpass.fetchAmenities).mockRejectedValue(new Error('all endpoints down'));
    await expect(buildReport('x', DC)).rejects.toThrow(/amenit/i);
  });
});
