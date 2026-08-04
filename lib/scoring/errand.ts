import { CATEGORIES } from './categories';
import type { Amenity, CategoryId } from '@/lib/report/types';

/** 1200 m is roughly 15 minutes at 4.8 km/h. */
const THRESHOLD_M = 1200;

export function fifteenMinuteBreakdown(
  amenities: Amenity[],
): { met: CategoryId[]; missing: CategoryId[] } {
  const reachable = new Set(
    amenities.filter((a) => a.distanceM <= THRESHOLD_M).map((a) => a.category),
  );

  const met: CategoryId[] = [];
  const missing: CategoryId[] = [];

  for (const category of CATEGORIES) {
    if (reachable.has(category.id)) met.push(category.id);
    else missing.push(category.id);
  }

  return { met, missing };
}

export function errandScore(amenities: Amenity[]): number {
  const { met } = fifteenMinuteBreakdown(amenities);
  return Math.round((met.length / CATEGORIES.length) * 100);
}
