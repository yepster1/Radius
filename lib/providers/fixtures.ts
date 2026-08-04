import { haversineMetres } from '@/lib/geo/distance';
import type { Coordinates } from '@/lib/report/types';
import carDependent from '@/tests/fixtures/car-dependent.json';
import denseUrban from '@/tests/fixtures/dense-urban.json';
import rural from '@/tests/fixtures/rural.json';
import suburbanTransit from '@/tests/fixtures/suburban-transit.json';
import type { OverpassElement } from './overpass';

type Reference = { coords: Coordinates; elements: OverpassElement[] };

/** The four locations whose Overpass responses are committed under tests/fixtures. */
const REFERENCES: Reference[] = [
  { coords: { lat: 38.8977, lon: -77.0365 }, elements: denseUrban.elements },
  { coords: { lat: 42.3736, lon: -71.1097 }, elements: suburbanTransit.elements },
  { coords: { lat: 33.081, lon: -96.718 }, elements: carDependent.elements },
  { coords: { lat: 44.2159, lon: -73.274 }, elements: rural.elements },
];

export function fixtureModeEnabled(): boolean {
  return process.env.RADIUS_FIXTURE_MODE === '1';
}

/**
 * Nearest recorded reference to the requested point. Any coordinate resolves to
 * one, so a test can use an arbitrary address and still get a deterministic,
 * plausible answer rather than an empty report.
 */
export function fixtureElementsFor(coords: Coordinates): OverpassElement[] {
  let best = REFERENCES[0];
  let bestDistance = Infinity;

  for (const reference of REFERENCES) {
    const distance = haversineMetres(coords, reference.coords);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = reference;
    }
  }

  return best.elements;
}
