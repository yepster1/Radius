import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { haversineMetres } from '@/lib/geo/distance';
import type { Coordinates } from '@/lib/report/types';
import type { OverpassElement } from './overpass';

type Reference = { coords: Coordinates; elements: OverpassElement[] };

const REFERENCE_FILES: { coords: Coordinates; file: string }[] = [
  { coords: { lat: 38.8977, lon: -77.0365 }, file: 'dense-urban.json' },
  { coords: { lat: 42.3736, lon: -71.1097 }, file: 'suburban-transit.json' },
  { coords: { lat: 33.081, lon: -96.718 }, file: 'car-dependent.json' },
  { coords: { lat: 44.2159, lon: -73.274 }, file: 'rural.json' },
];

export function fixtureModeEnabled(): boolean {
  return process.env.RADIUS_FIXTURE_MODE === '1';
}

/**
 * The four reference fixtures, loaded lazily and cached on first use so this
 * ~2MB of JSON is only ever read when fixture mode is actually on. Reading
 * with `fs.readFileSync` at a runtime-computed path — rather than a static
 * `import` of the JSON — means the bundler never sees a reference to these
 * files, so a production build does not ship them inside `.next/server/`.
 * `lib/` importing `tests/` at all (even dynamically) also inverts the
 * dependency direction this codebase otherwise enforces, which this avoids.
 */
let references: Reference[] | null = null;

function loadReferences(): Reference[] {
  if (!references) {
    references = REFERENCE_FILES.map(({ coords, file }) => {
      const raw = readFileSync(join(process.cwd(), 'tests', 'fixtures', file), 'utf-8');
      const parsed = JSON.parse(raw) as { elements: OverpassElement[] };
      return { coords, elements: parsed.elements };
    });
  }
  return references;
}

/**
 * Nearest recorded reference to the requested point. Any coordinate resolves to
 * one, so a test can use an arbitrary address and still get a deterministic,
 * plausible answer rather than an empty report.
 */
export async function fixtureElementsFor(coords: Coordinates): Promise<OverpassElement[]> {
  const refs = loadReferences();

  let best = refs[0];
  let bestDistance = Infinity;

  for (const reference of refs) {
    const distance = haversineMetres(coords, reference.coords);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = reference;
    }
  }

  return best.elements;
}
