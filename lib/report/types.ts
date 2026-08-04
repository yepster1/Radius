// Single source of truth — defined in Task 2, re-exported here for convenience
// so consumers can import every shared type from one module.
import type { Coordinates } from '@/lib/geo/distance';
export type { Coordinates };

export type CategoryId =
  | 'grocery'
  | 'dining'
  | 'cafe'
  | 'retail'
  | 'errands'
  | 'parks'
  | 'schools'
  | 'culture'
  | 'fitness';

export type Amenity = {
  id: number;
  name: string;
  category: CategoryId;
  lat: number;
  lon: number;
  distanceM: number;
};

export type TransitStop = {
  id: number;
  name: string;
  mode: 'rail' | 'light_rail' | 'tram' | 'bus';
  routeCount: number;
  distanceM: number;
};

export type StreetContext = {
  intersectionsWithin1km: number;
  buildingsWithin500m: number;
  /** False when the lookup failed and the numbers are placeholders. */
  available: boolean;
};

export type UrbanBand = 'Rural' | 'Suburban' | 'Urban' | 'Dense Urban';

/** A refinement data source whose lookup can fail without failing the report. */
export type DataSource = 'transit' | 'street';

export type Scores = {
  walk: number;
  drive: number;
  transit: number;
  errand: number;
  urbanSuburban: { index: number; band: UrbanBand };
  overall: number;
};

export type Report = {
  address: string;
  coordinates: Coordinates;
  slug: string;
  scores: Scores;
  amenities: Amenity[];
  transitStops: TransitStop[];
  street: StreetContext;
  fifteenMinute: { met: CategoryId[]; missing: CategoryId[] };
  dataSparse: boolean;
  /** Refinement sources whose lookup failed (or, for street, degraded to placeholder). */
  unavailable: DataSource[];
};

export type AddressSuggestion = {
  mapboxId: string;
  primary: string;
  secondary: string;
};
