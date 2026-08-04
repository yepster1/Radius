import { describe, expect, it } from 'vitest';
import { fixtureElementsFor } from '@/lib/providers/fixtures';

describe('fixtureElementsFor', () => {
  it('returns the dense-urban set for a Washington DC coordinate', () => {
    const elements = fixtureElementsFor({ lat: 38.8977, lon: -77.0365 });
    expect(elements.length).toBeGreaterThan(1000);
  });

  it('returns the rural set for a Vermont coordinate', () => {
    const elements = fixtureElementsFor({ lat: 44.2159, lon: -73.274 });
    expect(elements.length).toBeLessThan(20);
  });

  it('resolves an arbitrary coordinate to its nearest reference', () => {
    // Baltimore is nearest to the DC reference of the four.
    const elements = fixtureElementsFor({ lat: 39.2904, lon: -76.6122 });
    expect(elements.length).toBeGreaterThan(1000);
  });

  it('never returns an empty set', () => {
    for (const coords of [
      { lat: 61.2181, lon: -149.9003 },
      { lat: 25.7617, lon: -80.1918 },
    ]) {
      expect(fixtureElementsFor(coords).length).toBeGreaterThan(0);
    }
  });
});
