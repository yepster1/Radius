import 'server-only';

import type { AddressSuggestion, Coordinates } from '@/lib/report/types';

const SEARCH_BASE = 'https://api.mapbox.com/search/searchbox/v1';

function secretToken(): string {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) throw new Error('MAPBOX_SECRET_TOKEN is not set');
  return token;
}

/** Pure parser, exported so it can be tested without the network. */
export function parseSuggestResponse(json: unknown): AddressSuggestion[] {
  if (typeof json !== 'object' || json === null) return [];
  const { suggestions } = json as { suggestions?: unknown };
  if (!Array.isArray(suggestions)) return [];

  const result: AddressSuggestion[] = [];
  for (const raw of suggestions) {
    if (typeof raw !== 'object' || raw === null) continue;
    const { mapbox_id: id, name, place_formatted: place } = raw as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string') continue;
    result.push({
      mapboxId: id,
      primary: name,
      secondary: typeof place === 'string' ? place : '',
    });
  }
  return result;
}

export async function suggestAddresses(
  query: string,
  sessionToken: string,
): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return [];

  const url = new URL(`${SEARCH_BASE}/suggest`);
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', secretToken());
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('country', 'us');
  url.searchParams.set('types', 'address');
  url.searchParams.set('limit', '5');

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  return parseSuggestResponse(await res.json());
}

export async function retrieveAddress(
  mapboxId: string,
  sessionToken: string,
): Promise<{ address: string; lat: number; lon: number } | null> {
  const url = new URL(`${SEARCH_BASE}/retrieve/${encodeURIComponent(mapboxId)}`);
  url.searchParams.set('access_token', secretToken());
  url.searchParams.set('session_token', sessionToken);

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { full_address?: string; name?: string };
    }>;
  };

  const feature = json.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!feature || !coords || coords.length !== 2) return null;

  return {
    address: feature.properties?.full_address ?? feature.properties?.name ?? '',
    lon: coords[0],
    lat: coords[1],
  };
}

/** Pure parser, exported for tests. */
export function parseReverseResponse(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const { features } = json as { features?: unknown };
  if (!Array.isArray(features) || features.length === 0) return null;

  const props = (features[0] as { properties?: Record<string, unknown> })?.properties;
  const full = props?.full_address;
  if (typeof full === 'string' && full.length > 0) return full;

  const place = props?.place_formatted;
  return typeof place === 'string' && place.length > 0 ? place : null;
}

/** Canonical address for a coordinate pair. Cached — coordinates do not move. */
export async function reverseGeocode(coords: Coordinates): Promise<string | null> {
  const url = new URL('https://api.mapbox.com/search/geocode/v6/reverse');
  url.searchParams.set('longitude', String(coords.lon));
  url.searchParams.set('latitude', String(coords.lat));
  url.searchParams.set('access_token', secretToken());
  url.searchParams.set('types', 'address');

  try {
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return null;
    return parseReverseResponse(await res.json());
  } catch {
    return null;
  }
}
