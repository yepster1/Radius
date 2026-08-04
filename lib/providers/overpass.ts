import { haversineMetres } from '@/lib/geo/distance';
import { CATEGORIES } from '@/lib/scoring/categories';
import { countJunctions, type HighwayWay } from '@/lib/scoring/junctions';
import type {
  Amenity, CategoryId, Coordinates, StreetContext, TransitStop,
} from '@/lib/report/types';

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

/** Try each mirror in turn; only throw when every endpoint fails. */
async function runQuery(query: string): Promise<OverpassElement[]> {
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        next: { revalidate: 86_400 }, // 24h — shops do not move
      });
      if (!res.ok) throw new Error(`${endpoint} returned ${res.status}`);
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return json.elements ?? [];
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`All Overpass endpoints failed: ${String(lastError)}`);
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

export async function fetchAmenities(
  coords: Coordinates,
  radiusM: number,
): Promise<Amenity[]> {
  const filters = CATEGORIES.flatMap((c) => c.tags)
    .map((tag) => {
      const [key, value] = tag.split('=');
      return `nwr["${key}"="${value}"](around:${radiusM},${coords.lat},${coords.lon});`;
    })
    .join('\n  ');

  const elements = await runQuery(`[out:json][timeout:30];\n(\n  ${filters}\n);\nout center;`);
  return parseAmenityElements(elements, coords);
}

export async function fetchTransitStops(
  coords: Coordinates,
  radiusM: number,
): Promise<TransitStop[]> {
  const query = `[out:json][timeout:30];
(
  nwr["public_transport"="stop_position"](around:${radiusM},${coords.lat},${coords.lon});
  nwr["highway"="bus_stop"](around:${radiusM},${coords.lat},${coords.lon});
  nwr["railway"="station"](around:${radiusM},${coords.lat},${coords.lon});
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
}

export async function fetchStreetContext(coords: Coordinates): Promise<StreetContext> {
  // An "intersection" per the published methodology is a node shared by two
  // or more highway ways (degree >= 3, counting the ways that meet there).
  // `out count` over `node(w)` counts every node on every way — including
  // curve vertices — which inflates the figure several fold. Fetch the way
  // geometry instead and let countJunctions() do the real counting.
  const highwaysQuery = `[out:json][timeout:30];
way["highway"~"^(residential|primary|secondary|tertiary|unclassified|living_street)$"](around:1000,${coords.lat},${coords.lon});
out skel;`;

  const buildingsQuery = `[out:json][timeout:30];
way["building"](around:500,${coords.lat},${coords.lon});
out count;`;

  try {
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
  } catch {
    // Street context is a refinement, not a requirement — degrade to
    // neutral, but flag it so downstream scoring can renormalize rather
    // than silently treating "missing" as "zero".
    return { intersectionsWithin1km: 30, buildingsWithin500m: 0, available: false };
  }
}
