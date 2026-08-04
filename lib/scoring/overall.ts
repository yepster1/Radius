import { clamp } from './math';
import type { Scores } from '@/lib/report/types';

/**
 * Headline score. Walk leads because it is the strongest single signal of
 * location quality for a renter. The urban-suburban index is deliberately
 * excluded: it describes a place, it does not rank it — a rural address is
 * not worse than an urban one, only different.
 */
const WEIGHTS = { walk: 0.4, transit: 0.25, errand: 0.2, drive: 0.15 } as const;

export function overallScore(scores: Omit<Scores, 'overall'>): number {
  const total =
    scores.walk * WEIGHTS.walk +
    scores.transit * WEIGHTS.transit +
    scores.errand * WEIGHTS.errand +
    scores.drive * WEIGHTS.drive;

  return clamp(Math.round(total), 0, 100);
}
