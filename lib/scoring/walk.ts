import { CATEGORIES } from './categories';
import { clamp, decay } from './math';
import type { Amenity } from '@/lib/report/types';

const RADIUS_M = 2000;
const DECAY_SCALE_M = 800;
const POSITION_WEIGHTS = [1.0, 0.5, 0.25];

/**
 * A category's score maxes out when all three nearest amenities sit at the
 * doorstep, i.e. the position weights summed. Dividing by it puts every
 * category in [0,1] so the weighted mean is also in [0,1] — without this the
 * raw value ranges to 1.75 and, scaled by 100, saturates the 0-100 clamp for
 * any address with amenities in most categories.
 */
const MAX_CATEGORY_SCORE = POSITION_WEIGHTS.reduce((sum, w) => sum + w, 0);

/**
 * Walk Score for a point, given amenities already fetched for it.
 *
 * Pure: no I/O, no clock, no randomness. The same dataset always yields the
 * same score, which is what makes it testable and safe to reuse elsewhere.
 *
 * An intersection-density penalty was specified here and then removed. Measured
 * across the four reference points, junctions within a 1 km radius came out: rural
 * 0, car-dependent suburb 238, dense urban 439, transit suburb 507. No threshold
 * separates walkable from car-dependent, and the leafy transit suburb outranks
 * downtown DC. OSM splits ways on tagging changes unrelated to street topology, so
 * the proxy measures bookkeeping as much as connectivity. Documented in the README.
 */
export function walkScore(amenities: Amenity[]): number {
  let weighted = 0;
  let totalWeight = 0;

  for (const category of CATEGORIES) {
    const nearest = amenities
      .filter((a) => a.category === category.id && a.distanceM <= RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, POSITION_WEIGHTS.length);

    const categoryScore = nearest.reduce(
      (sum, a, i) => sum + decay(a.distanceM, DECAY_SCALE_M) * POSITION_WEIGHTS[i],
      0,
    );

    weighted += (categoryScore / MAX_CATEGORY_SCORE) * category.weight;
    totalWeight += category.weight;
  }

  if (totalWeight === 0) return 0;

  return clamp(Math.round((weighted / totalWeight) * 100), 0, 100);
}
