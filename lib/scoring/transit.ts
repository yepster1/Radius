import { clamp, decay } from './math';
import type { TransitStop } from '@/lib/report/types';

const RADIUS_M = 1500;
const DECAY_SCALE_M = 600; // radius / 2.5, matching Walk Score's falloff

/**
 * K is a calibration constant, not a derived value. It is fixed against the
 * four reference fixtures so that a transit-saturated core lands near 100 and
 * a single bus stop lands near 15. Changing it must show up as a test diff.
 */
const K = 4;

const MODE_WEIGHT: Record<TransitStop['mode'], number> = {
  rail: 3,
  light_rail: 2,
  tram: 2,
  bus: 1,
};

export function transitScore(stops: TransitStop[]): number {
  const total = stops
    .filter((s) => s.distanceM <= RADIUS_M)
    .reduce(
      (sum, s) =>
        sum +
        decay(s.distanceM, DECAY_SCALE_M) *
          MODE_WEIGHT[s.mode] *
          Math.max(1, s.routeCount),
      0,
    );

  return clamp(Math.round(K * total), 0, 100);
}
