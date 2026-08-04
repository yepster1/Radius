import { describe, expect, it } from 'vitest';
import { clamp, decay, norm } from '@/lib/scoring/math';

describe('clamp', () => {
  it('passes through a value inside the range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('clamps below and above', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('handles the boundaries exactly', () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

describe('decay', () => {
  it('is 1 at zero distance', () => {
    expect(decay(0, 2400)).toBe(1);
  });

  it('decreases monotonically with distance', () => {
    const near = decay(200, 2400);
    const mid = decay(1000, 2400);
    const far = decay(2000, 2400);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it('stays near 1 for very close amenities', () => {
    expect(decay(100, 2400)).toBeGreaterThan(0.99);
  });

  it('is effectively 0 well beyond the scale', () => {
    expect(decay(6000, 2400)).toBeLessThan(0.001);
  });

  it('never returns a negative value', () => {
    expect(decay(100_000, 2400)).toBeGreaterThanOrEqual(0);
  });
});

describe('norm', () => {
  it('maps a value to a 0-1 fraction of the cap', () => {
    expect(norm(50, 100)).toBe(0.5);
  });

  it('saturates at 1', () => {
    expect(norm(500, 100)).toBe(1);
  });

  it('returns 0 for a zero or negative cap rather than dividing by zero', () => {
    expect(norm(50, 0)).toBe(0);
  });
});
