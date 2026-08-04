import { describe, expect, it } from 'vitest';
import { overallScore } from '@/lib/scoring/overall';

const base = {
  walk: 50, drive: 50, transit: 50, errand: 50,
  urbanSuburban: { index: 50, band: 'Suburban' as const },
};

describe('overallScore', () => {
  it('returns the shared value when every score matches', () => {
    expect(overallScore(base)).toBe(50);
  });

  it('weights walk most heavily', () => {
    const betterWalk = overallScore({ ...base, walk: 100 });
    const betterDrive = overallScore({ ...base, drive: 100 });
    expect(betterWalk).toBeGreaterThan(betterDrive);
  });

  it('returns 0 when everything is 0', () => {
    expect(overallScore({
      walk: 0, drive: 0, transit: 0, errand: 0,
      urbanSuburban: { index: 0, band: 'Rural' },
    })).toBe(0);
  });

  it('returns 100 when everything is 100', () => {
    expect(overallScore({
      walk: 100, drive: 100, transit: 100, errand: 100,
      urbanSuburban: { index: 100, band: 'Dense Urban' },
    })).toBe(100);
  });

  it('ignores the urban-suburban index, which is descriptive not evaluative', () => {
    const urban = overallScore({ ...base, urbanSuburban: { index: 95, band: 'Dense Urban' } });
    const rural = overallScore({ ...base, urbanSuburban: { index: 5, band: 'Rural' } });
    expect(urban).toBe(rural);
  });
});
