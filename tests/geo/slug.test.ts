import { describe, expect, it } from 'vitest';
import { buildSlug, parseSlug } from '@/lib/geo/slug';

describe('buildSlug', () => {
  it('kebab-cases the address and appends a 7-char geohash', () => {
    const slug = buildSlug('1600 Pennsylvania Ave NW, Washington, DC 20500', 38.8977, -77.0365);
    expect(slug).toMatch(/^1600-pennsylvania-ave-nw-washington-dc-20500-[0-9a-z]{7}$/);
  });

  it('strips punctuation and collapses repeated separators', () => {
    const slug = buildSlug('St. John\'s Place #4B', 40.6782, -73.9442);
    expect(slug).not.toContain('--');
    expect(slug).not.toContain('.');
    expect(slug).not.toContain('#');
  });

  it('handles an empty address by emitting just the hash', () => {
    const slug = buildSlug('', 38.8977, -77.0365);
    expect(slug).toMatch(/^[0-9a-z]{7}$/);
  });
});

describe('parseSlug', () => {
  it('recovers coordinates from a slug it built', () => {
    const slug = buildSlug('1600 Pennsylvania Ave NW', 38.8977, -77.0365);
    const parsed = parseSlug(slug);
    expect(parsed).not.toBeNull();
    expect(Math.abs(parsed!.lat - 38.8977)).toBeLessThan(0.001);
    expect(Math.abs(parsed!.lon - -77.0365)).toBeLessThan(0.002);
  });

  it('ignores the human-readable portion entirely', () => {
    const real = buildSlug('1600 Pennsylvania Ave NW', 38.8977, -77.0365);
    const hash = real.split('-').pop()!;
    const tampered = parseSlug(`completely-different-text-${hash}`);
    expect(tampered).toEqual(parseSlug(real));
  });

  it('returns null when the trailing segment is not a valid geohash', () => {
    expect(parseSlug('some-address-with-no-hash!')).toBeNull();
    expect(parseSlug('')).toBeNull();
  });
});
