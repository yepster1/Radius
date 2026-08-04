import { describe, expect, it } from 'vitest';
import { haversineMetres, metresToWalkMinutes } from '@/lib/geo/distance';

describe('haversineMetres', () => {
  it('returns 0 for identical points', () => {
    const p = { lat: 38.8977, lon: -77.0365 };
    expect(haversineMetres(p, p)).toBe(0);
  });

  it('measures a known distance within 1%', () => {
    // White House -> Washington Monument, ~1030 m
    const whiteHouse = { lat: 38.8977, lon: -77.0365 };
    const monument = { lat: 38.8895, lon: -77.0353 };
    const d = haversineMetres(whiteHouse, monument);
    expect(d).toBeGreaterThan(910);
    expect(d).toBeLessThan(930);
  });

  it('is symmetric', () => {
    const a = { lat: 40.7128, lon: -74.006 };
    const b = { lat: 34.0522, lon: -118.2437 };
    expect(haversineMetres(a, b)).toBeCloseTo(haversineMetres(b, a), 6);
  });
});

describe('metresToWalkMinutes', () => {
  it('uses 4.8 km/h — 400 m is 5 minutes', () => {
    expect(metresToWalkMinutes(400)).toBe(5);
  });

  it('rounds up so nothing reads as 0 minutes', () => {
    expect(metresToWalkMinutes(10)).toBe(1);
  });

  it('returns 0 for zero distance', () => {
    expect(metresToWalkMinutes(0)).toBe(0);
  });
});
