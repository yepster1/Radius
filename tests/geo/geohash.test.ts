import { describe, expect, it } from 'vitest';
import { decodeGeohash, encodeGeohash } from '@/lib/geo/geohash';

describe('encodeGeohash', () => {
  it('encodes a known point to the documented geohash', () => {
    // Reference value from the standard geohash algorithm
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj');
  });

  it('defaults to 7 characters', () => {
    expect(encodeGeohash(38.8977, -77.0365)).toHaveLength(7);
  });

  it('gives neighbouring points the same 7-char hash when very close', () => {
    const a = encodeGeohash(38.89770, -77.03650);
    const b = encodeGeohash(38.89771, -77.03651);
    expect(a).toBe(b);
  });
});

describe('decodeGeohash', () => {
  it('round-trips within 7-character precision (~76 m)', () => {
    const lat = 38.8977;
    const lon = -77.0365;
    const { lat: dLat, lon: dLon } = decodeGeohash(encodeGeohash(lat, lon));
    expect(Math.abs(dLat - lat)).toBeLessThan(0.001);
    expect(Math.abs(dLon - lon)).toBeLessThan(0.002);
  });

  it('handles negative coordinates', () => {
    const { lat, lon } = decodeGeohash(encodeGeohash(-33.8688, 151.2093));
    expect(lat).toBeLessThan(0);
    expect(lon).toBeGreaterThan(0);
  });

  it('throws on an invalid character', () => {
    expect(() => decodeGeohash('abcdefa')).toThrow(/invalid/i);
  });
});
