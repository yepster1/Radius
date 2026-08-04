import { decodeGeohash, encodeGeohash } from './geohash';

const GEOHASH_LENGTH = 7;
const GEOHASH_PATTERN = /^[0-9bcdefghjkmnpqrstuvwxyz]{7}$/;

function kebab(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build a shareable slug. The readable portion is decorative; the trailing
 * geohash is the payload that lets a cold server rebuild the report.
 */
export function buildSlug(address: string, lat: number, lon: number): string {
  const hash = encodeGeohash(lat, lon, GEOHASH_LENGTH);
  const readable = kebab(address);
  return readable ? `${readable}-${hash}` : hash;
}

/** Recover coordinates from a slug. Returns null when there is no valid hash. */
export function parseSlug(slug: string): { lat: number; lon: number } | null {
  const segments = slug.split('-');
  const candidate = segments[segments.length - 1]?.toLowerCase() ?? '';

  if (!GEOHASH_PATTERN.test(candidate)) return null;

  try {
    return decodeGeohash(candidate);
  } catch {
    return null;
  }
}
