import { unstable_cache } from 'next/cache';
import { haversineMetres } from '@/lib/geo/distance';
import { CATEGORIES } from '@/lib/scoring/categories';
import { countJunctions, type HighwayWay } from '@/lib/geo/junctions';
import type {
  Amenity, CategoryId, Coordinates, StreetContext, TransitStop,
} from '@/lib/report/types';
import { fixtureElementsFor, fixtureModeEnabled } from './fixtures';

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  /** Present on `out skel` way elements — the ordered node ids making up the way. */
  nodes?: number[];
};

/** How long to wait for a mirror before also trying the next one. */
const HEDGE_DELAY_MS = 8_000;
/** Hard ceiling on any single mirror attempt. */
const ATTEMPT_TIMEOUT_MS = 45_000;
/** 24h — shops do not move. */
const CACHE_TTL_S = 86_400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function queryEndpoint(
  endpoint: string,
  query: string,
): Promise<OverpassElement[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    // Overpass returns 406 to requests with no User-Agent, and Node's fetch
    // sends none by default — without this every query fails in production.
    // The fixture-recording script hit the same wall in Task 4.
    headers: { 'User-Agent': 'RadiusAddressInsights/0.1 (+https://radius-address-insights.vercel.app)' },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    // Deliberately uncached at the HTTP layer. This used to carry
    // `next: { revalidate: 86_400 }`, which silently did nothing: the amenity
    // response for a dense address is 5.55 MB and Next's Data Cache refuses
    // entries over 2 MB, so every write failed with
    // "items over 2MB can not be cached" and every visit paid a full round
    // trip. Caching now happens one level up, on the parsed result — see
    // `cachedAmenities` below.
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${endpoint} returned ${res.status}`);
  const json = (await res.json()) as { elements?: OverpassElement[] };
  return json.elements ?? [];
}

/**
 * Query the mirrors as hedged requests: start the first, and only bring in the
 * next if the previous has not answered within HEDGE_DELAY_MS. The first
 * success wins; we throw only when every mirror has failed.
 *
 * Trying them strictly in sequence — the previous approach — means a mirror
 * that hangs before failing costs its full timeout before the healthy one is
 * ever tried. Measured against the public mirrors during an outage: one
 * returned a connection error, the second 504'd after 86s, and only the third
 * answered, so a sequential walk took well over two minutes for a query the
 * healthy mirror served in 47s. Hedging bounds that at roughly the fastest
 * mirror's own latency while still, in the common case, sending just one
 * request — Overpass asks not to be hammered.
 */
async function runQuery(query: string): Promise<OverpassElement[]> {
  const attempts: Promise<OverpassElement[]>[] = [];
  const failures: unknown[] = [];
  let settled = false;

  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i += 1) {
    attempts.push(
      queryEndpoint(OVERPASS_ENDPOINTS[i], query).catch((error: unknown) => {
        failures.push(error);
        throw error;
      }),
    );

    // Give the mirrors already in flight a head start before adding another.
    if (i < OVERPASS_ENDPOINTS.length - 1) {
      const winner = await Promise.race([
        Promise.any(attempts).then(
          (elements) => {
            settled = true;
            return elements;
          },
          () => undefined, // all so far failed; fall through and hedge
        ),
        sleep(HEDGE_DELAY_MS).then(() => undefined),
      ]);
      if (settled && winner) return winner;
    }
  }

  try {
    return await Promise.any(attempts);
  } catch {
    throw new Error(
      `All Overpass endpoints failed: ${failures.map(String).join('; ')}`,
    );
  }
}

function coordsOf(element: OverpassElement): Coordinates | null {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) return { lat: element.center.lat, lon: element.center.lon };
  return null;
}

function categoryOf(tags: Record<string, string>): CategoryId | null {
  for (const category of CATEGORIES) {
    for (const tag of category.tags) {
      const [key, value] = tag.split('=');
      if (tags[key] === value) return category.id;
    }
  }
  return null;
}

/** Pure element -> Amenity mapping. Exported so tests can run offline. */
export function parseAmenityElements(
  elements: OverpassElement[],
  origin: Coordinates,
): Amenity[] {
  const amenities: Amenity[] = [];

  for (const element of elements) {
    const tags = element.tags;
    if (!tags) continue;

    const coords = coordsOf(element);
    if (!coords) continue;

    const category = categoryOf(tags);
    if (!category) continue;

    const label = CATEGORIES.find((c) => c.id === category)!.label;

    amenities.push({
      id: element.id,
      name: tags.name ?? label,
      category,
      lat: coords.lat,
      lon: coords.lon,
      distanceM: Math.round(haversineMetres(origin, coords)),
    });
  }

  return amenities.sort((a, b) => a.distanceM - b.distanceM);
}

/**
 * Cache the parsed amenity list rather than the raw response. Measured on the
 * dense-urban fixture, parsing is a 5.3x reduction — we keep six fields per
 * amenity and discard the other ~307 OSM tag keys — which brings a 5.55 MB
 * response down to roughly 1 MB and back inside the cache's 2 MB entry limit.
 *
 * Keyed on the arguments, and the arguments are stable: coordinates reach here
 * from `parseSlug`, which decodes a geohash to a fixed cell centre, so every
 * visitor to a shared link produces the same key and shares one entry.
 */
const cachedAmenities = unstable_cache(
  async (lat: number, lon: number, radiusM: number): Promise<Amenity[]> => {
    const coords = { lat, lon };
    const filters = CATEGORIES.flatMap((c) => c.tags)
      .map((tag) => {
        const [key, value] = tag.split('=');
        return `nwr["${key}"="${value}"](around:${radiusM},${lat},${lon});`;
      })
      .join('\n  ');

    const elements = await runQuery(
      `[out:json][timeout:30];\n(\n  ${filters}\n);\nout center;`,
    );
    return parseAmenityElements(elements, coords);
  },
  ['overpass-amenities'],
  { revalidate: CACHE_TTL_S },
);

export async function fetchAmenities(
  coords: Coordinates,
  radiusM: number,
): Promise<Amenity[]> {
  if (fixtureModeEnabled()) {
    return parseAmenityElements(await fixtureElementsFor(coords), coords)
      .filter((a) => a.distanceM <= radiusM);
  }

  return cachedAmenities(coords.lat, coords.lon, radiusM);
}

const cachedTransitStops = unstable_cache(
  async (lat: number, lon: number, radiusM: number): Promise<TransitStop[]> => {
    const coords = { lat, lon };
    const query = `[out:json][timeout:30];
(
  nwr["public_transport"="stop_position"](around:${radiusM},${lat},${lon});
  nwr["highway"="bus_stop"](around:${radiusM},${lat},${lon});
  nwr["railway"="station"](around:${radiusM},${lat},${lon});
);
out center;`;

    const elements = await runQuery(query);
    const stops: TransitStop[] = [];

    for (const element of elements) {
      const tags = element.tags;
      const position = coordsOf(element);
      if (!tags || !position) continue;

      const mode: TransitStop['mode'] =
        tags.railway === 'station' || tags.train === 'yes' ? 'rail'
        : tags.light_rail === 'yes' ? 'light_rail'
        : tags.tram === 'yes' ? 'tram'
        : 'bus';

      stops.push({
        id: element.id,
        name: tags.name ?? 'Transit stop',
        mode,
        routeCount: Number(tags.route_ref?.split(';').length ?? 1),
        distanceM: Math.round(haversineMetres(coords, position)),
      });
    }

    return stops.sort((a, b) => a.distanceM - b.distanceM);
  },
  ['overpass-transit'],
  { revalidate: CACHE_TTL_S },
);

export async function fetchTransitStops(
  coords: Coordinates,
  radiusM: number,
): Promise<TransitStop[]> {
  if (fixtureModeEnabled()) {
    // The amenity fixtures carry no transit data; an empty result is honest and
    // deterministic, and buildReport already handles it without degrading.
    return [];
  }

  return cachedTransitStops(coords.lat, coords.lon, radiusM);
}

/**
 * Worth caching for the same reason as amenities, only more so: the highways
 * query returns every node id of every way in a 1 km radius — hundreds of
 * arrays — and all we keep is two integers.
 */
const cachedStreetContext = unstable_cache(
  async (lat: number, lon: number): Promise<StreetContext> => {
    // An "intersection" per the published methodology is a node shared by two
    // or more highway ways (degree >= 3, counting the ways that meet there).
    // `out count` over `node(w)` counts every node on every way — including
    // curve vertices — which inflates the figure several fold. Fetch the way
    // geometry instead and let countJunctions() do the real counting.
    const highwaysQuery = `[out:json][timeout:30];
way["highway"~"^(residential|primary|secondary|tertiary|unclassified|living_street)$"](around:1000,${lat},${lon});
out skel;`;

    const buildingsQuery = `[out:json][timeout:30];
way["building"](around:500,${lat},${lon});
out count;`;

    const [highwayElements, buildingElements] = await Promise.all([
      runQuery(highwaysQuery),
      runQuery(buildingsQuery),
    ]);

    const ways: HighwayWay[] = highwayElements
      .filter((e) => e.type === 'way' && Array.isArray(e.nodes))
      .map((e) => ({ nodes: e.nodes ?? [] }));

    const buildingCount = buildingElements.find((e) => e.type === 'count') as
      | (OverpassElement & { tags?: Record<string, string> })
      | undefined;

    return {
      intersectionsWithin1km: countJunctions(ways),
      buildingsWithin500m: Number(buildingCount?.tags?.ways ?? 0),
      available: true,
    };
  },
  ['overpass-street'],
  { revalidate: CACHE_TTL_S },
);

export async function fetchStreetContext(coords: Coordinates): Promise<StreetContext> {
  if (fixtureModeEnabled()) {
    // These are downtown DC's measured values, retained only so the shape is
    // realistic — they are not derived from `coords`. `available: false` is
    // the honest signal here: they are placeholders, and urbanSuburbanIndex
    // already renormalises over the remaining signals when street data is
    // unavailable, so this does not silently misrepresent other addresses.
    return { intersectionsWithin1km: 439, buildingsWithin500m: 320, available: false };
  }

  try {
    // The catch stays out here on purpose: unstable_cache only stores resolved
    // values, so a failed lookup is never cached as if it were a real answer.
    return await cachedStreetContext(coords.lat, coords.lon);
  } catch {
    // Street context is a refinement, not a requirement — degrade to
    // neutral, but flag it so downstream scoring can renormalize rather
    // than silently treating "missing" as "zero".
    return { intersectionsWithin1km: 30, buildingsWithin500m: 0, available: false };
  }
}
