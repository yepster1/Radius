import { buildSlug } from '@/lib/geo/slug';
import {
  fetchAmenities, fetchStreetContext, fetchTransitStops,
} from '@/lib/providers/overpass';
import { driveScore } from '@/lib/scoring/drive';
import { errandScore, fifteenMinuteBreakdown } from '@/lib/scoring/errand';
import { overallScore } from '@/lib/scoring/overall';
import { transitScore } from '@/lib/scoring/transit';
import { urbanSuburbanIndex } from '@/lib/scoring/urbanSuburban';
import { walkScore } from '@/lib/scoring/walk';
import type { Coordinates, Report, StreetContext, TransitStop } from '@/lib/report/types';

/** Fetch at the widest radius any score needs, then let each score filter down. */
const FETCH_RADIUS_M = 8000;
const TRANSIT_RADIUS_M = 1500;
const SPARSE_THRESHOLD = 5;

const NEUTRAL_STREET: StreetContext = {
  intersectionsWithin1km: 30,
  buildingsWithin500m: 0,
  available: false,
};

export async function buildReport(
  address: string,
  coords: Coordinates,
): Promise<Report> {
  const [amenityResult, transitResult, streetResult] = await Promise.allSettled([
    fetchAmenities(coords, FETCH_RADIUS_M),
    fetchTransitStops(coords, TRANSIT_RADIUS_M),
    fetchStreetContext(coords),
  ]);

  // Amenities are load-bearing — without them there is no report at all.
  if (amenityResult.status === 'rejected') {
    throw new Error(`Could not load amenities: ${String(amenityResult.reason)}`);
  }
  const amenities = amenityResult.value;

  // Transit and street context are refinements; degrade rather than fail.
  const transitStops: TransitStop[] =
    transitResult.status === 'fulfilled' ? transitResult.value : [];
  const street: StreetContext =
    streetResult.status === 'fulfilled' ? streetResult.value : NEUTRAL_STREET;

  const walk = walkScore(amenities);
  const drive = driveScore(amenities);
  const transit = transitScore(transitStops);
  const errand = errandScore(amenities);
  const urbanSuburban = urbanSuburbanIndex(amenities, street);

  return {
    address,
    coordinates: coords,
    slug: buildSlug(address, coords.lat, coords.lon),
    scores: {
      walk,
      drive,
      transit,
      errand,
      urbanSuburban,
      overall: overallScore({ walk, drive, transit, errand, urbanSuburban }),
    },
    amenities,
    transitStops,
    street,
    fifteenMinute: fifteenMinuteBreakdown(amenities),
    dataSparse: amenities.length < SPARSE_THRESHOLD,
  };
}
