import { clamp, decay } from './math';
import type { TransitStop } from '@/lib/report/types';

const RADIUS_M = 1500;
const DECAY_SCALE_M = 600; // radius / 2.5, matching Walk Score's falloff

/**
 * K is a calibration constant, not a derived value. It is fixed against the
 * four reference fixtures so that a transit-saturated core lands near 100.
 *
 * At K = 4 the anchors are: one bus stop with one route at 300 m -> 3; one rail
 * stop at 300 m -> 8; a rail stop at 400 m with three routes -> 21; six bus
 * stops at 300 m with two routes each -> 34; a stop-dense core saturates at 100.
 *
 * `transitScore` feeds the headline Overall Score at weight 0.25, so those
 * anchors are pinned by exact-value tests. Ordering tests alone cannot protect
 * this constant: any positive scalar preserves ordering, and the saturation
 * test still clamps to 100 for any K above ~0.11 — K could be changed tenfold
 * without a single ordering test noticing.
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
