/**
 * Records real Overpass responses so unit tests run offline and deterministically.
 * Run manually: npx tsx scripts/record-fixtures.ts
 */
import { writeFileSync } from 'node:fs';
import { CATEGORIES } from '../lib/scoring/categories';

const REFERENCES = [
  { name: 'dense-urban', lat: 38.8977, lon: -77.0365 },
  { name: 'suburban-transit', lat: 42.3736, lon: -71.1097 },
  { name: 'car-dependent', lat: 33.0810, lon: -96.7180 },
  // NOTE: 44.4759, -73.2121 (as given in the task brief) is actually downtown
  // Burlington's Main Street, not rural — confirmed via Nominatim reverse
  // geocoding. Using a genuinely rural point ~20mi south (Ferrisburgh, VT)
  // instead, so this fixture matches its name and the "<15 amenities" test.
  { name: 'rural', lat: 44.2159, lon: -73.2740 },
];

const filters = CATEGORIES.flatMap((c) => c.tags)
  .map((tag) => {
    const [key, value] = tag.split('=');
    return `nwr["${key}"="${value}"](around:2000,{{lat}},{{lon}});`;
  })
  .join('\n  ');

async function recordFixture(name: string, query: string): Promise<void> {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    // Node's fetch (undici) sends no User-Agent by default; overpass-api.de's
    // Apache config returns 406 Not Acceptable without one.
    headers: { 'User-Agent': 'RadiusAddressInsights/1.0 (contact: csmall@taivara.com)' },
    body: new URLSearchParams({ data: query }),
  });

  if (!res.ok) throw new Error(`${name}: ${res.status}`);

  const json = await res.json();
  writeFileSync(`tests/fixtures/${name}.json`, JSON.stringify(json, null, 2));
  console.log(`${name}: ${json.elements.length} elements`);

  // Public Overpass rate-limits hard; be a good citizen between requests.
  await new Promise((r) => setTimeout(r, 5000));
}

// Wrapped in an async main() — not top-level await — because tsx transforms
// this file as CJS (no "type": "module" in package.json), which disallows it.
async function main() {
  for (const ref of REFERENCES) {
    const query = `[out:json][timeout:60];\n(\n  ${filters}\n);\nout center;`
      .replaceAll('{{lat}}', String(ref.lat))
      .replaceAll('{{lon}}', String(ref.lon));

    await recordFixture(ref.name, query);
  }

  // Real highway-way geometry for the dense-urban point, so countJunctions()
  // (lib/geo/junctions.ts) can be tested against real OSM data instead
  // of hand-built fixtures alone. Mirrors fetchStreetContext's highway query.
  const denseUrban = REFERENCES.find((r) => r.name === 'dense-urban')!;
  const streetQuery = `[out:json][timeout:30];
way["highway"~"^(residential|primary|secondary|tertiary|unclassified|living_street)$"](around:1000,${denseUrban.lat},${denseUrban.lon});
out skel;`;
  await recordFixture('street-dense-urban', streetQuery);
}

main();
