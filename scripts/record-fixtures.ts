/**
 * Records real Overpass responses so unit tests run offline and deterministically.
 * Run manually: npx tsx scripts/record-fixtures.ts
 */
import { writeFileSync } from 'node:fs';
import { CATEGORIES } from '../lib/scoring/categories';

const REFERENCES = [
  { name: 'dense-urban', lat: 38.8977, lon: -77.0365 },
  { name: 'suburban-transit', lat: 42.3736, lon: -71.1097 },
  { name: 'car-dependent', lat: 33.0198, lon: -96.6989 },
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

// Wrapped in an async main() — not top-level await — because tsx transforms
// this file as CJS (no "type": "module" in package.json), which disallows it.
async function main() {
  for (const ref of REFERENCES) {
    const query = `[out:json][timeout:60];\n(\n  ${filters}\n);\nout center;`
      .replaceAll('{{lat}}', String(ref.lat))
      .replaceAll('{{lon}}', String(ref.lon));

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      // Node's fetch (undici) sends no User-Agent by default; overpass-api.de's
      // Apache config returns 406 Not Acceptable without one.
      headers: { 'User-Agent': 'RadiusAddressInsights/1.0 (contact: csmall@taivara.com)' },
      body: new URLSearchParams({ data: query }),
    });

    if (!res.ok) throw new Error(`${ref.name}: ${res.status}`);

    const json = await res.json();
    writeFileSync(`tests/fixtures/${ref.name}.json`, JSON.stringify(json, null, 2));
    console.log(`${ref.name}: ${json.elements.length} elements`);

    // Public Overpass rate-limits hard; be a good citizen between requests.
    await new Promise((r) => setTimeout(r, 5000));
  }
}

main();
