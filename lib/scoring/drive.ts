import { CATEGORIES } from './categories';
import { clamp, decay } from './math';
import type { Amenity } from '@/lib/report/types';

const RADIUS_M = 8000;
const DECAY_SCALE_M = 3200; // radius / 2.5, matching Walk Score's falloff
const POSITION_WEIGHTS = [1.0, 0.5, 0.25];
const MAX_CATEGORY_SCORE = POSITION_WEIGHTS.reduce((sum, w) => sum + w, 0);

/**
 * Drive Score: the Walk Score algorithm at a wider radius over a
 * car-relevant weighting, exactly as the brief specifies.
 * No intersection penalty — street connectivity is irrelevant when driving.
 */
export function driveScore(amenities: Amenity[]): number {
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

    weighted += (categoryScore / MAX_CATEGORY_SCORE) * category.driveWeight;
    totalWeight += category.driveWeight;
  }

  if (totalWeight === 0) return 0;
  return clamp(Math.round((weighted / totalWeight) * 100), 0, 100);
}
