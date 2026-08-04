import { describe, expect, it } from 'vitest';
import streetDenseUrban from '../fixtures/street-dense-urban.json';
import { countJunctions, type HighwayWay } from '@/lib/geo/junctions';

describe('countJunctions', () => {
  it('returns 0 for an empty input', () => {
    expect(countJunctions([])).toBe(0);
  });

  it('counts one junction when two ways share a single node', () => {
    const ways: HighwayWay[] = [{ nodes: [1, 2, 3] }, { nodes: [3, 4, 5] }];
    expect(countJunctions(ways)).toBe(1);
  });

  it('returns 0 when two ways share no nodes', () => {
    const ways: HighwayWay[] = [{ nodes: [1, 2, 3] }, { nodes: [4, 5, 6] }];
    expect(countJunctions(ways)).toBe(0);
  });

  it('returns 0 for a single closed loop way (first node repeated at the end)', () => {
    const ways: HighwayWay[] = [{ nodes: [1, 2, 3, 1] }];
    expect(countJunctions(ways)).toBe(0);
  });

  it('counts one junction when three ways meet at one node', () => {
    const ways: HighwayWay[] = [
      { nodes: [1, 2] },
      { nodes: [2, 3] },
      { nodes: [2, 4] },
    ];
    expect(countJunctions(ways)).toBe(1);
  });

  it('produces a plausible non-zero count against the real dense-urban fixture', () => {
    const ways = streetDenseUrban.elements
      .filter((e) => e.type === 'way' && Array.isArray(e.nodes))
      .map((e) => ({ nodes: e.nodes as number[] }));

    expect(ways.length).toBeGreaterThan(0);

    const junctions = countJunctions(ways);
    expect(junctions).toBeGreaterThan(0);
    expect(junctions).toBeLessThan(1000);
  });
});
