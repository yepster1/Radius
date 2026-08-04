import { clamp, norm } from './math';
import type { Amenity, StreetContext, UrbanBand } from '@/lib/report/types';

const AMENITY_CAP = 150;
// Measured across the four reference points: rural 0, car-dependent 238,
// dense urban 439, transit suburb 507. A cap of 120 saturated three of the
// four, collapsing the term to a rural/non-rural switch.
const INTERSECTION_CAP = 500;
const BUILDING_CAP = 400;

function bandFor(index: number): UrbanBand {
  if (index <= 25) return 'Rural';
  if (index <= 50) return 'Suburban';
  if (index <= 75) return 'Urban';
  return 'Dense Urban';
}

/**
 * A single number *and* a label, as the brief asks for.
 * Derived from amenity density, street connectivity and building footprint.
 */
export function urbanSuburbanIndex(
  amenities: Amenity[],
  street: StreetContext,
): { index: number; band: UrbanBand } {
  const nearby = amenities.filter((a) => a.distanceM <= 1000).length;

  const terms = [{ weight: 0.45, value: norm(nearby, AMENITY_CAP) }];

  // When the street lookup failed its numbers are placeholders, not data.
  // Renormalising over the signals we actually have stops a transient
  // Overpass failure from silently reporting a dense city as suburban —
  // measured at a 37-point, two-band swing before this guard existed.
  if (street.available) {
    terms.push({ weight: 0.3, value: norm(street.intersectionsWithin1km, INTERSECTION_CAP) });
    terms.push({ weight: 0.25, value: norm(street.buildingsWithin500m, BUILDING_CAP) });
  }

  const totalWeight = terms.reduce((sum, t) => sum + t.weight, 0);
  const weighted = terms.reduce((sum, t) => sum + t.weight * t.value, 0);
  const index = clamp(Math.round(100 * (weighted / totalWeight)), 0, 100);

  return { index, band: bandFor(index) };
}
