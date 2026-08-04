export type Coordinates = { lat: number; lon: number };

const EARTH_RADIUS_M = 6_371_000;
const WALK_SPEED_M_PER_MIN = 80; // 4.8 km/h

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two WGS84 points. */
export function haversineMetres(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Walking time in whole minutes, rounded up so nothing shows as "0 min". */
export function metresToWalkMinutes(metres: number): number {
  if (metres <= 0) return 0;
  return Math.max(1, Math.ceil(metres / WALK_SPEED_M_PER_MIN));
}
