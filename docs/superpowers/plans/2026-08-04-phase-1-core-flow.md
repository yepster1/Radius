# Radius — Phase 1: Core Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a live, deployed address-insights product that satisfies every line of the RentEngine challenge — autocomplete, walk/drive/transit scores, urban-suburban index, nearby businesses, a map, local search history, and a shareable URL that renders identically for a cold visitor.

**Architecture:** Four layers with a hard boundary between them. `lib/providers/` performs I/O and returns typed raw data. `lib/scoring/` is pure — it accepts an already-fetched dataset and returns numbers, with no fetch, no clock and no randomness. `lib/report/` is the only place the two meet: it fetches in parallel, feeds scoring, and assembles one typed `Report`. Components render a `Report` and never compute one. The report page is a React Server Component; the route streams a skeleton via `loading.tsx` while the server resolves.

> **Correction to the design artifact.** The architecture review described *per-card Suspense boundaries*. That was wrong. Walk, drive, errand and urban-suburban all derive from the **same** amenity fetch, so they resolve at the same instant — wrapping each card in its own boundary would be theatre, adding complexity for no perceptible gain. The genuine win is route-level streaming: `loading.tsx` paints an instant skeleton while `buildReport` runs, and `Promise.allSettled` means a slow transit or street-context query never delays the amenity-derived scores. Per-card boundaries become worthwhile in Phase 2, when Census demographics arrive on an independent request.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind v4, Mapbox (Search Box + GL JS), OpenStreetMap Overpass, Vitest, Playwright, GitHub Actions, Vercel.

## Global Constraints

- **Product name:** `Radius`. Package name `radius`. Never reference RentEngine in user-facing copy.
- **Node:** 22 LTS. **Package manager:** npm.
- **TypeScript:** `strict: true`. No `any` in committed code. No non-null assertions (`!`) on external data.
- **Purity rule:** nothing under `lib/scoring/` may import from `lib/providers/`, call `fetch`, read `Date`, or use `Math.random`. This is enforced by a lint rule in Task 1.
- **Geography:** US only. `country=us` on every geocoding call.
- **Design tokens** (exact values, from RentEngine's live Webflow CSS):
  - Accent `#ff4f00` · Charcoal `#141516` · Grays `#252a31` `#4b5563` `#adb4c2` `#e5e7eb` `#f3f5f9`
  - Display font **Archivo** 600, `letter-spacing: -0.02em`
  - UI/label/button font **JetBrains Mono**, `letter-spacing: 0.015em`
  - Button radius `4.5px`, padding `16px 24px` · Card radius `8px`
  - Spacing scale: 8 / 12 / 16 / 20 / 24 / 40 / 56 / 64 / 80 / 96 / 120 px
- **Git:** all Phase 1 work on branch `phase-1-core-flow`, merged to `main` via a single PR at Task 12.
- **Secrets:** `MAPBOX_SECRET_TOKEN` is server-only and must never appear in a client component or in `NEXT_PUBLIC_*`. `NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN` is URL-restricted at Mapbox.
- **Every task ends with a passing test run and a commit.**

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `app/layout.tsx` | Root shell, fonts, token CSS variables | 1 |
| `app/globals.css` | Tailwind v4 `@theme` block with the design tokens | 1 |
| `components/ui/*.tsx` | Presentational primitives: `Card`, `Meter`, `ScoreTile`, `Button` | 1 |
| `lib/geo/distance.ts` | `haversineMetres`, `metresToWalkMinutes` | 2 |
| `lib/geo/geohash.ts` | `encodeGeohash`, `decodeGeohash` | 2 |
| `lib/geo/slug.ts` | `buildSlug`, `parseSlug` | 2 |
| `lib/report/types.ts` | `Coordinates`, `Amenity`, `Scores`, `Report`, `AddressSuggestion` | 3 |
| `lib/scoring/math.ts` | `clamp`, `decay`, `norm` | 3 |
| `lib/scoring/categories.ts` | The 9 categories, their OSM tags and weights | 3 |
| `lib/providers/overpass.ts` | `fetchAmenities`, `fetchStreetContext` — I/O only | 4 |
| `tests/fixtures/*.json` | Four recorded Overpass responses | 4 |
| `lib/scoring/walk.ts` | `walkScore` | 5 |
| `lib/scoring/drive.ts` | `driveScore` | 6 |
| `lib/scoring/transit.ts` | `transitScore` | 6 |
| `lib/scoring/errand.ts` | `errandScore`, `fifteenMinuteBreakdown` | 6 |
| `lib/scoring/urbanSuburban.ts` | `urbanSuburbanIndex` + band label | 6 |
| `lib/scoring/overall.ts` | `overallScore` | 6 |
| `lib/providers/mapbox.ts` | `suggestAddresses`, `retrieveAddress`, `reverseGeocode` — I/O only | 7 |
| `app/api/autocomplete/route.ts` | Proxy that keeps the secret token server-side | 7 |
| `components/search/AddressSearch.tsx` | `'use client'` ARIA combobox | 8 |
| `lib/report/buildReport.ts` | Orchestrator: parallel fetch, cache, assemble | 9 |
| `app/a/[slug]/page.tsx` | Report page, RSC, Suspense per card | 10 |
| `components/report/*.tsx` | `ReportHeader`, `ScoreTiles`, `NearbyList`, `UrbanSuburbanBar` | 10 |
| `components/report/ReportMap.tsx` | `'use client'` Mapbox GL | 11 |
| `components/search/RecentSearches.tsx` | `'use client'` localStorage history | 11 |
| `tests/e2e/*.spec.ts` | Playwright: search flow, cold share | 12 |
| `.github/workflows/ci.yml` | Lint, typecheck, unit, e2e | 12 |

---

## Task 1: Scaffold, tooling and design system

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `eslint.config.mjs`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `components/ui/Card.tsx`, `components/ui/Meter.tsx`, `components/ui/ScoreTile.tsx`
- Test: `tests/ui/ScoreTile.test.tsx`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `<Card>`, `<Meter value: number>`, `<ScoreTile label: string, value: number, caption: string>`; the token CSS variables `--color-accent`, `--color-charcoal`, `--color-gray-1..5`; npm scripts `dev`, `build`, `test`, `lint`, `typecheck`

- [ ] **Step 1: Create the branch**

```bash
git checkout -b phase-1-core-flow
```

- [ ] **Step 2: Scaffold the app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint \
  --src-dir=false --import-alias "@/*" --turbopack --no-git
```

Answer "yes" to overwriting the existing README.

- [ ] **Step 3: Install test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react \
  @testing-library/jest-dom @types/node
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
});
```

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Add npm scripts**

In `package.json`, set `"name": "radius"` and add:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 6: Define the design tokens**

Replace `app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-accent: #ff4f00;
  --color-accent-tint: #fff1eb;
  --color-charcoal: #141516;
  --color-gray-1: #252a31;
  --color-gray-2: #4b5563;
  --color-gray-3: #adb4c2;
  --color-gray-4: #e5e7eb;
  --color-gray-5: #f3f5f9;

  --font-display: var(--font-archivo), Arial, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;

  --radius-card: 8px;
  --radius-btn: 4.5px;
}

body {
  font-family: var(--font-display);
  color: var(--color-gray-1);
  background: #fff;
}

h1, h2, h3, h4 {
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

/* Every mono surface — buttons, labels, score captions — carries this
   tracking. Setting it on the utility means components never restate it. */
.font-mono {
  letter-spacing: 0.015em;
}
```

- [ ] **Step 7: Wire the fonts in the root layout**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Radius — know the address before you list it',
  description:
    'Walkability, transit, nearby businesses and renter fit for any US address.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Add the purity lint rule**

Append to `eslint.config.mjs` (inside the exported array):

```js
{
  files: ['lib/scoring/**/*.ts'],
  rules: {
    'no-restricted-globals': [
      'error',
      { name: 'fetch', message: 'lib/scoring must be pure — no I/O.' },
      { name: 'Date', message: 'lib/scoring must be pure — no clock.' },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            // Both forms must be blocked. An alias-only pattern is trivially
            // bypassed by `import x from '../providers/overpass'`, which would
            // silently defeat the whole purity guarantee.
            group: ['@/lib/providers/**', '**/providers/**'],
            message: 'lib/scoring must not depend on I/O.',
          },
        ],
      },
    ],
    'no-restricted-properties': [
      'error',
      { object: 'Math', property: 'random', message: 'lib/scoring must be deterministic.' },
    ],
  },
}
```

- [ ] **Step 9: Write the failing test for ScoreTile**

Create `tests/ui/ScoreTile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreTile } from '@/components/ui/ScoreTile';

describe('ScoreTile', () => {
  it('renders the label, value and caption', () => {
    render(<ScoreTile label="Walk" value={94} caption="Daily errands on foot" />);
    expect(screen.getByText('Walk')).toBeInTheDocument();
    expect(screen.getByText('94')).toBeInTheDocument();
    expect(screen.getByText('Daily errands on foot')).toBeInTheDocument();
  });

  it('exposes the score to assistive tech as a meter', () => {
    render(<ScoreTile label="Walk" value={94} caption="Daily errands on foot" />);
    const meter = screen.getByRole('meter', { name: /walk score/i });
    expect(meter).toHaveAttribute('aria-valuenow', '94');
  });

  it('clamps an out-of-range value into 0-100', () => {
    render(<ScoreTile label="Walk" value={140} caption="x" />);
    expect(screen.getByRole('meter', { name: /walk score/i }))
      .toHaveAttribute('aria-valuenow', '100');
  });
});
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/components/ui/ScoreTile'`

- [ ] **Step 11: Implement the UI primitives**

Create `components/ui/Meter.tsx`:

```tsx
export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-4"
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}
```

Create `components/ui/Card.tsx`:

```tsx
export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card border border-gray-4 bg-white p-6 ${className}`}>
      {children}
    </div>
  );
}
```

Create `components/ui/ScoreTile.tsx`:

```tsx
import { Meter } from './Meter';

export function ScoreTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="rounded-card border border-gray-4 p-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-gray-2">
        {label}
      </span>
      <strong className="mt-2 block text-2xl font-bold tracking-[-0.03em]">{pct}</strong>
      <Meter value={pct} label={`${label} score`} />
      <span className="mt-2 block text-xs text-gray-2">{caption}</span>
    </div>
  );
}
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — 3 tests

- [ ] **Step 13: Verify the whole toolchain**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all three succeed with no errors.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: scaffold Radius with design tokens and UI primitives"
```

---

## Task 2: Geo utilities

**Files:**
- Create: `lib/geo/distance.ts`, `lib/geo/geohash.ts`, `lib/geo/slug.ts`
- Test: `tests/geo/distance.test.ts`, `tests/geo/geohash.test.ts`, `tests/geo/slug.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `haversineMetres(a: Coordinates, b: Coordinates): number`
  - `metresToWalkMinutes(metres: number): number`
  - `encodeGeohash(lat: number, lon: number, precision?: number): string`
  - `decodeGeohash(hash: string): { lat: number; lon: number }`
  - `buildSlug(address: string, lat: number, lon: number): string`
  - `parseSlug(slug: string): { lat: number; lon: number } | null`
  - `type Coordinates = { lat: number; lon: number }` — **defined here and only here.** `lib/report/types.ts` (Task 3) re-exports it rather than redeclaring it, so there is exactly one definition in the codebase.

- [ ] **Step 1: Write the failing distance tests**

Create `tests/geo/distance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { haversineMetres, metresToWalkMinutes } from '@/lib/geo/distance';

describe('haversineMetres', () => {
  it('returns 0 for identical points', () => {
    const p = { lat: 38.8977, lon: -77.0365 };
    expect(haversineMetres(p, p)).toBe(0);
  });

  it('measures a known distance within 1%', () => {
    // White House -> Washington Monument, ~1030 m
    const whiteHouse = { lat: 38.8977, lon: -77.0365 };
    const monument = { lat: 38.8895, lon: -77.0353 };
    const d = haversineMetres(whiteHouse, monument);
    expect(d).toBeGreaterThan(910);
    expect(d).toBeLessThan(930);
  });

  it('is symmetric', () => {
    const a = { lat: 40.7128, lon: -74.006 };
    const b = { lat: 34.0522, lon: -118.2437 };
    expect(haversineMetres(a, b)).toBeCloseTo(haversineMetres(b, a), 6);
  });
});

describe('metresToWalkMinutes', () => {
  it('uses 4.8 km/h — 400 m is 5 minutes', () => {
    expect(metresToWalkMinutes(400)).toBe(5);
  });

  it('rounds up so nothing reads as 0 minutes', () => {
    expect(metresToWalkMinutes(10)).toBe(1);
  });

  it('returns 0 for zero distance', () => {
    expect(metresToWalkMinutes(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- distance`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement distance.ts**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- distance`
Expected: PASS — 6 tests

- [ ] **Step 5: Write the failing geohash tests**

Create `tests/geo/geohash.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decodeGeohash, encodeGeohash } from '@/lib/geo/geohash';

describe('encodeGeohash', () => {
  it('encodes a known point to the documented geohash', () => {
    // Reference value from the standard geohash algorithm
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj');
  });

  it('defaults to 7 characters', () => {
    expect(encodeGeohash(38.8977, -77.0365)).toHaveLength(7);
  });

  it('gives neighbouring points the same 7-char hash when very close', () => {
    const a = encodeGeohash(38.89770, -77.03650);
    const b = encodeGeohash(38.89771, -77.03651);
    expect(a).toBe(b);
  });
});

describe('decodeGeohash', () => {
  it('round-trips within 7-character precision (~76 m)', () => {
    const lat = 38.8977;
    const lon = -77.0365;
    const { lat: dLat, lon: dLon } = decodeGeohash(encodeGeohash(lat, lon));
    expect(Math.abs(dLat - lat)).toBeLessThan(0.001);
    expect(Math.abs(dLon - lon)).toBeLessThan(0.002);
  });

  it('handles negative coordinates', () => {
    const { lat, lon } = decodeGeohash(encodeGeohash(-33.8688, 151.2093));
    expect(lat).toBeLessThan(0);
    expect(lon).toBeGreaterThan(0);
  });

  it('throws on an invalid character', () => {
    expect(() => decodeGeohash('abcdefa')).toThrow(/invalid/i);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm test -- geohash`
Expected: FAIL — cannot find module

- [ ] **Step 7: Implement geohash.ts**

```ts
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Standard geohash encode. Precision 7 gives roughly +/-76 m. */
export function encodeGeohash(lat: number, lon: number, precision = 7): string {
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  let hash = '';
  let bits = 0;
  let bitCount = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        bits = (bits << 1) | 1;
        lonMin = mid;
      } else {
        bits = bits << 1;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        bits = (bits << 1) | 1;
        latMin = mid;
      } else {
        bits = bits << 1;
        latMax = mid;
      }
    }

    even = !even;
    bitCount += 1;

    if (bitCount === 5) {
      hash += BASE32[bits];
      bits = 0;
      bitCount = 0;
    }
  }

  return hash;
}

/** Decode a geohash to the centre of its cell. */
export function decodeGeohash(hash: string): { lat: number; lon: number } {
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let even = true;

  for (const char of hash.toLowerCase()) {
    const index = BASE32.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid geohash character: ${char}`);
    }

    for (let bit = 4; bit >= 0; bit -= 1) {
      const isSet = ((index >> bit) & 1) === 1;
      if (even) {
        const mid = (lonMin + lonMax) / 2;
        if (isSet) lonMin = mid;
        else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (isSet) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }

  return { lat: (latMin + latMax) / 2, lon: (lonMin + lonMax) / 2 };
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm test -- geohash`
Expected: PASS — 6 tests

- [ ] **Step 9: Write the failing slug tests**

Create `tests/geo/slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSlug, parseSlug } from '@/lib/geo/slug';

describe('buildSlug', () => {
  it('kebab-cases the address and appends a 7-char geohash', () => {
    const slug = buildSlug('1600 Pennsylvania Ave NW, Washington, DC 20500', 38.8977, -77.0365);
    expect(slug).toMatch(/^1600-pennsylvania-ave-nw-washington-dc-20500-[0-9a-z]{7}$/);
  });

  it('strips punctuation and collapses repeated separators', () => {
    const slug = buildSlug('St. John\'s Place #4B', 40.6782, -73.9442);
    expect(slug).not.toContain('--');
    expect(slug).not.toContain('.');
    expect(slug).not.toContain('#');
  });

  it('handles an empty address by emitting just the hash', () => {
    const slug = buildSlug('', 38.8977, -77.0365);
    expect(slug).toMatch(/^[0-9a-z]{7}$/);
  });
});

describe('parseSlug', () => {
  it('recovers coordinates from a slug it built', () => {
    const slug = buildSlug('1600 Pennsylvania Ave NW', 38.8977, -77.0365);
    const parsed = parseSlug(slug);
    expect(parsed).not.toBeNull();
    expect(Math.abs(parsed!.lat - 38.8977)).toBeLessThan(0.001);
    expect(Math.abs(parsed!.lon - -77.0365)).toBeLessThan(0.002);
  });

  it('ignores the human-readable portion entirely', () => {
    const real = buildSlug('1600 Pennsylvania Ave NW', 38.8977, -77.0365);
    const hash = real.split('-').pop()!;
    const tampered = parseSlug(`completely-different-text-${hash}`);
    expect(tampered).toEqual(parseSlug(real));
  });

  it('returns null when the trailing segment is not a valid geohash', () => {
    expect(parseSlug('some-address-with-no-hash!')).toBeNull();
    expect(parseSlug('')).toBeNull();
  });
});
```

- [ ] **Step 10: Run to verify it fails**

Run: `npm test -- slug`
Expected: FAIL — cannot find module

- [ ] **Step 11: Implement slug.ts**

```ts
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
```

- [ ] **Step 12: Run the full suite**

Run: `npm test`
Expected: PASS — all tests in `tests/geo` green (18 across the three files)

- [ ] **Step 13: Commit**

```bash
git add lib/geo tests/geo
git commit -m "feat: geo utilities — haversine, geohash, shareable slugs"
```

---

## Task 3: Shared types, scoring maths and amenity categories

**Files:**
- Create: `lib/report/types.ts`, `lib/scoring/math.ts`, `lib/scoring/categories.ts`
- Test: `tests/scoring/math.test.ts`, `tests/scoring/categories.test.ts`

**Interfaces:**
- Consumes: `Coordinates` from `lib/geo/distance.ts`
- Produces:
  - `clamp(value: number, min: number, max: number): number`
  - `decay(distanceM: number, scaleM: number): number`
  - `norm(value: number, cap: number): number`
  - `CATEGORIES: readonly Category[]` where `Category = { id: CategoryId; label: string; weight: number; driveWeight: number; tags: string[] }`
  - `type CategoryId = 'grocery' | 'dining' | 'cafe' | 'retail' | 'errands' | 'parks' | 'schools' | 'culture' | 'fitness'`
  - `type Amenity = { id: number; name: string; category: CategoryId; lat: number; lon: number; distanceM: number }`
  - `type Scores`, `type Report` (consumed by Tasks 9 and 10)

- [ ] **Step 1: Write the failing maths tests**

Create `tests/scoring/math.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clamp, decay, norm } from '@/lib/scoring/math';

describe('clamp', () => {
  it('passes through a value inside the range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('clamps below and above', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('handles the boundaries exactly', () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

describe('decay', () => {
  it('is 1 at zero distance', () => {
    expect(decay(0, 2400)).toBe(1);
  });

  it('decreases monotonically with distance', () => {
    const near = decay(200, 2400);
    const mid = decay(1000, 2400);
    const far = decay(2000, 2400);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it('stays near 1 for very close amenities', () => {
    expect(decay(100, 2400)).toBeGreaterThan(0.99);
  });

  it('is effectively 0 well beyond the scale', () => {
    expect(decay(6000, 2400)).toBeLessThan(0.001);
  });

  it('never returns a negative value', () => {
    expect(decay(100_000, 2400)).toBeGreaterThanOrEqual(0);
  });
});

describe('norm', () => {
  it('maps a value to a 0-1 fraction of the cap', () => {
    expect(norm(50, 100)).toBe(0.5);
  });

  it('saturates at 1', () => {
    expect(norm(500, 100)).toBe(1);
  });

  it('returns 0 for a zero or negative cap rather than dividing by zero', () => {
    expect(norm(50, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- math`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement math.ts**

```ts
/** Restrict a value to an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Distance decay: 1 at the doorstep, falling away sharply past the scale.
 * exp(-5 * (d / scale)^5) — the curve Walk Score popularised.
 */
export function decay(distanceM: number, scaleM: number): number {
  if (distanceM <= 0) return 1;
  if (scaleM <= 0) return 0;
  return Math.exp(-5 * Math.pow(distanceM / scaleM, 5));
}

/** Normalise a count to [0,1] against a saturation cap. */
export function norm(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return clamp(value / cap, 0, 1);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- math`
Expected: PASS — 11 tests

- [ ] **Step 5: Create the shared types**

Create `lib/report/types.ts`:

```ts
// Single source of truth — defined in Task 2, re-exported here for convenience
// so consumers can import every shared type from one module.
export type { Coordinates } from '@/lib/geo/distance';

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
};

export type UrbanBand = 'Rural' | 'Suburban' | 'Urban' | 'Dense Urban';

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
};

export type AddressSuggestion = {
  mapboxId: string;
  primary: string;
  secondary: string;
};
```

- [ ] **Step 6: Write the failing category tests**

Create `tests/scoring/categories.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoryById } from '@/lib/scoring/categories';

describe('CATEGORIES', () => {
  it('defines exactly the nine categories from the spec', () => {
    expect(CATEGORIES).toHaveLength(9);
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      'grocery', 'dining', 'cafe', 'retail', 'errands',
      'parks', 'schools', 'culture', 'fitness',
    ]);
  });

  it('gives every category at least one OSM tag filter', () => {
    for (const category of CATEGORIES) {
      expect(category.tags.length).toBeGreaterThan(0);
    }
  });

  it('has walk weights summing to 15 as specified', () => {
    const total = CATEGORIES.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBe(15);
  });

  it('weights grocery highest for walking', () => {
    const grocery = categoryById('grocery');
    for (const other of CATEGORIES) {
      expect(grocery.weight).toBeGreaterThanOrEqual(other.weight);
    }
  });

  it('weights cafe lower for driving than for walking', () => {
    const cafe = categoryById('cafe');
    expect(cafe.driveWeight).toBeLessThan(cafe.weight);
  });
});

describe('categoryById', () => {
  it('throws on an unknown id rather than returning undefined', () => {
    // @ts-expect-error deliberately invalid at the type level
    expect(() => categoryById('nightlife')).toThrow(/unknown category/i);
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npm test -- categories`
Expected: FAIL — cannot find module

- [ ] **Step 8: Implement categories.ts**

```ts
import type { CategoryId } from '@/lib/report/types';

export type Category = {
  id: CategoryId;
  label: string;
  /** Weight when computing Walk Score. Sums to 15 across all categories. */
  weight: number;
  /** Weight when computing Drive Score — car-relevant needs rank differently. */
  driveWeight: number;
  /** Overpass tag filters, applied as a union. */
  tags: string[];
};

export const CATEGORIES: readonly Category[] = [
  {
    id: 'grocery', label: 'Grocery', weight: 3, driveWeight: 3,
    tags: ['shop=supermarket', 'shop=grocery', 'shop=convenience'],
  },
  {
    id: 'dining', label: 'Dining', weight: 2, driveWeight: 1.5,
    tags: ['amenity=restaurant', 'amenity=fast_food'],
  },
  {
    id: 'cafe', label: 'Cafe', weight: 1.5, driveWeight: 0.5,
    tags: ['amenity=cafe'],
  },
  {
    id: 'retail', label: 'Retail', weight: 2, driveWeight: 3,
    tags: ['shop=clothes', 'shop=department_store', 'shop=mall', 'shop=books', 'shop=hardware'],
  },
  {
    id: 'errands', label: 'Errands', weight: 2, driveWeight: 2.5,
    tags: ['amenity=pharmacy', 'amenity=bank', 'amenity=post_office', 'shop=hairdresser', 'shop=laundry'],
  },
  {
    id: 'parks', label: 'Parks', weight: 1.5, driveWeight: 1,
    tags: ['leisure=park', 'leisure=garden', 'leisure=playground', 'landuse=recreation_ground'],
  },
  {
    id: 'schools', label: 'Schools', weight: 1, driveWeight: 1,
    tags: ['amenity=school', 'amenity=kindergarten', 'amenity=college', 'amenity=university'],
  },
  {
    id: 'culture', label: 'Culture', weight: 1, driveWeight: 1,
    tags: ['amenity=library', 'amenity=theatre', 'amenity=cinema', 'amenity=arts_centre', 'tourism=museum'],
  },
  {
    id: 'fitness', label: 'Fitness', weight: 1, driveWeight: 1.5,
    tags: ['leisure=fitness_centre', 'leisure=sports_centre', 'leisure=pitch'],
  },
] as const;

export function categoryById(id: CategoryId): Category {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category: ${id}`);
  return found;
}
```

- [ ] **Step 9: Run the full suite**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS — whole suite green, and crucially the purity lint rule does not fire

- [ ] **Step 10: Commit**

```bash
git add lib/report/types.ts lib/scoring tests/scoring
git commit -m "feat: shared types, scoring maths and amenity categories"
```

---

## Task 4: Overpass provider and test fixtures

**Files:**
- Create: `lib/providers/overpass.ts`
- Create: `scripts/record-fixtures.ts`
- Create: `tests/fixtures/dense-urban.json`, `suburban-transit.json`, `car-dependent.json`, `rural.json`
- Test: `tests/providers/overpass.test.ts`

**Interfaces:**
- Consumes: `CATEGORIES` (Task 3), `haversineMetres` (Task 2), `Amenity`/`TransitStop`/`StreetContext` (Task 3)
- Produces:
  - `fetchAmenities(coords: Coordinates, radiusM: number): Promise<Amenity[]>`
  - `fetchTransitStops(coords: Coordinates, radiusM: number): Promise<TransitStop[]>`
  - `fetchStreetContext(coords: Coordinates): Promise<StreetContext>`
  - `parseAmenityElements(elements: OverpassElement[], origin: Coordinates): Amenity[]` — exported for tests
  - `OVERPASS_ENDPOINTS: string[]`

- [ ] **Step 1: Write the failing parser test**

The network call is not unit-tested; the *parser* is, against recorded fixtures.

Create `tests/providers/overpass.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import denseUrban from '../fixtures/dense-urban.json';
import rural from '../fixtures/rural.json';
import { parseAmenityElements } from '@/lib/providers/overpass';

const DC = { lat: 38.8977, lon: -77.0365 };
const RURAL = { lat: 44.4759, lon: -73.2121 };

describe('parseAmenityElements', () => {
  it('maps OSM elements to typed amenities with distances', () => {
    const amenities = parseAmenityElements(denseUrban.elements, DC);
    expect(amenities.length).toBeGreaterThan(20);
    for (const a of amenities) {
      expect(a.distanceM).toBeGreaterThanOrEqual(0);
      expect(a.name).not.toBe('');
      expect(a.category).toBeTruthy();
    }
  });

  it('reads coordinates from `center` for way and relation elements', () => {
    const ways = denseUrban.elements.filter((e) => e.type === 'way' && e.center);
    expect(ways.length).toBeGreaterThan(0);
    const parsed = parseAmenityElements(ways, DC);
    expect(parsed.every((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon))).toBe(true);
  });

  it('drops elements with no resolvable coordinates', () => {
    const broken = [{ type: 'way', id: 1, tags: { amenity: 'cafe', name: 'Ghost' } }];
    expect(parseAmenityElements(broken, DC)).toHaveLength(0);
  });

  it('falls back to the category label when an element has no name', () => {
    const unnamed = [{ type: 'node', id: 2, lat: 38.8980, lon: -77.0360, tags: { amenity: 'cafe' } }];
    expect(parseAmenityElements(unnamed, DC)[0].name).toBe('Cafe');
  });

  it('sorts nearest first', () => {
    const amenities = parseAmenityElements(denseUrban.elements, DC);
    for (let i = 1; i < amenities.length; i += 1) {
      expect(amenities[i].distanceM).toBeGreaterThanOrEqual(amenities[i - 1].distanceM);
    }
  });

  it('returns few or no amenities for the rural fixture', () => {
    const amenities = parseAmenityElements(rural.elements, RURAL);
    expect(amenities.length).toBeLessThan(15);
  });

  it('returns an empty array for an empty element list', () => {
    expect(parseAmenityElements([], DC)).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the fixture recording script**

Create `scripts/record-fixtures.ts`:

```ts
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
  { name: 'rural', lat: 44.4759, lon: -73.2121 },
];

const filters = CATEGORIES.flatMap((c) => c.tags)
  .map((tag) => {
    const [key, value] = tag.split('=');
    return `nwr["${key}"="${value}"](around:2000,{{lat}},{{lon}});`;
  })
  .join('\n  ');

for (const ref of REFERENCES) {
  const query = `[out:json][timeout:60];\n(\n  ${filters}\n);\nout center;`
    .replaceAll('{{lat}}', String(ref.lat))
    .replaceAll('{{lon}}', String(ref.lon));

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
  });

  if (!res.ok) throw new Error(`${ref.name}: ${res.status}`);

  const json = await res.json();
  writeFileSync(`tests/fixtures/${ref.name}.json`, JSON.stringify(json, null, 2));
  console.log(`${ref.name}: ${json.elements.length} elements`);

  // Public Overpass rate-limits hard; be a good citizen between requests.
  await new Promise((r) => setTimeout(r, 5000));
}
```

- [ ] **Step 3: Record the fixtures**

```bash
npm install -D tsx
mkdir -p tests/fixtures
npx tsx scripts/record-fixtures.ts
```

Expected: four JSON files written, each logging a non-zero element count.
If Overpass returns 429, wait a minute and re-run — the script is idempotent.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- overpass`
Expected: FAIL — cannot find module `@/lib/providers/overpass`

- [ ] **Step 5: Implement overpass.ts**

```ts
import { haversineMetres } from '@/lib/geo/distance';
import { CATEGORIES } from '@/lib/scoring/categories';
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
  const query = `[out:json][timeout:30];
way["highway"~"^(residential|primary|secondary|tertiary|unclassified|living_street)$"](around:1000,${coords.lat},${coords.lon});
node(w)->.junctions;
(
  .junctions;
  way["building"](around:500,${coords.lat},${coords.lon});
);
out count;`;

  try {
    const elements = await runQuery(query);
    const counts = elements.find((e) => e.type === 'count') as
      | (OverpassElement & { tags?: Record<string, string> })
      | undefined;

    return {
      intersectionsWithin1km: Number(counts?.tags?.nodes ?? 0),
      buildingsWithin500m: Number(counts?.tags?.ways ?? 0),
    };
  } catch {
    // Street context is a refinement, not a requirement — degrade to neutral.
    return { intersectionsWithin1km: 30, buildingsWithin500m: 0 };
  }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test -- overpass`
Expected: PASS — 7 tests

- [ ] **Step 7: Commit**

```bash
git add lib/providers scripts tests/providers tests/fixtures
git commit -m "feat: Overpass provider with multi-endpoint fallback and recorded fixtures"
```

---

## Task 5: Walk Score

**Files:**
- Create: `lib/scoring/walk.ts`
- Test: `tests/scoring/walk.test.ts`

**Interfaces:**
- Consumes: `CATEGORIES` (Task 3), `clamp`/`decay` (Task 3), `Amenity` (Task 3), fixtures (Task 4)
- Produces: `walkScore(amenities: Amenity[], intersectionsWithin1km: number): number`

- [ ] **Step 1: Write the failing test**

Create `tests/scoring/walk.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { walkScore } from '@/lib/scoring/walk';
import { parseAmenityElements } from '@/lib/providers/overpass';
import type { Amenity } from '@/lib/report/types';
import denseUrban from '../fixtures/dense-urban.json';
import carDependent from '../fixtures/car-dependent.json';
import rural from '../fixtures/rural.json';

const DC = { lat: 38.8977, lon: -77.0365 };
const TX = { lat: 33.0198, lon: -96.6989 };
const VT = { lat: 44.4759, lon: -73.2121 };

const amenity = (over: Partial<Amenity>): Amenity => ({
  id: 1, name: 'Test', category: 'grocery', lat: 0, lon: 0, distanceM: 100, ...over,
});

describe('walkScore', () => {
  it('returns 0 when there are no amenities', () => {
    expect(walkScore([], 40)).toBe(0);
  });

  it('scores a dense urban address highly', () => {
    const score = walkScore(parseAmenityElements(denseUrban.elements, DC), 90);
    expect(score).toBeGreaterThan(75);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scores a car-dependent suburb well below a dense city', () => {
    const urban = walkScore(parseAmenityElements(denseUrban.elements, DC), 90);
    const suburb = walkScore(parseAmenityElements(carDependent.elements, TX), 20);
    expect(suburb).toBeLessThan(urban);
  });

  it('scores a rural address low', () => {
    expect(walkScore(parseAmenityElements(rural.elements, VT), 8)).toBeLessThan(35);
  });

  it('never exceeds 100 even with hundreds of adjacent amenities', () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      amenity({ id: i, category: 'dining', distanceM: 20 }),
    );
    expect(walkScore(many, 120)).toBeLessThanOrEqual(100);
  });

  it('rewards a closer amenity over a further one', () => {
    const near = [amenity({ distanceM: 100 })];
    const far = [amenity({ distanceM: 1800 })];
    expect(walkScore(near, 40)).toBeGreaterThan(walkScore(far, 40));
  });

  it('rewards category variety over repetition of one category', () => {
    const varied: Amenity[] = [
      amenity({ id: 1, category: 'grocery', distanceM: 300 }),
      amenity({ id: 2, category: 'cafe', distanceM: 300 }),
      amenity({ id: 3, category: 'parks', distanceM: 300 }),
      amenity({ id: 4, category: 'errands', distanceM: 300 }),
    ];
    const repetitive: Amenity[] = [1, 2, 3, 4].map((id) =>
      amenity({ id, category: 'grocery', distanceM: 300 }),
    );
    expect(walkScore(varied, 40)).toBeGreaterThan(walkScore(repetitive, 40));
  });

  it('applies an intersection penalty to a low-connectivity street network', () => {
    const set = [
      amenity({ id: 1, category: 'grocery', distanceM: 300 }),
      amenity({ id: 2, category: 'cafe', distanceM: 400 }),
    ];
    expect(walkScore(set, 5)).toBeLessThan(walkScore(set, 100));
  });

  it('ignores amenities beyond the 2km radius', () => {
    const inside = [amenity({ distanceM: 1900 })];
    const outside = [amenity({ distanceM: 2100 })];
    expect(walkScore(outside, 40)).toBe(0);
    expect(walkScore(inside, 40)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- walk`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement walk.ts**

```ts
import { CATEGORIES } from './categories';
import { clamp, decay } from './math';
import type { Amenity } from '@/lib/report/types';

const RADIUS_M = 2000;
const DECAY_SCALE_M = 2400;
const POSITION_WEIGHTS = [1.0, 0.5, 0.25];

/**
 * Walk Score for a point, given amenities already fetched for it.
 *
 * Pure: no I/O, no clock, no randomness. The same dataset always yields the
 * same score, which is what makes it testable and safe to reuse elsewhere.
 */
export function walkScore(amenities: Amenity[], intersectionsWithin1km: number): number {
  let weighted = 0;
  let totalWeight = 0;

  for (const category of CATEGORIES) {
    const nearest = amenities
      .filter((a) => a.category === category.id && a.distanceM <= RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, POSITION_WEIGHTS.length);

    const categoryScore = nearest.reduce(
      (sum, a, i) => sum + decay(a.distanceM, DECAY_SCALE_M) * POSITION_WEIGHTS[i],
      0,
    );

    weighted += categoryScore * category.weight;
    totalWeight += category.weight;
  }

  if (totalWeight === 0) return 0;

  // A connected grid beats a cul-de-sac with the same raw amenity count.
  const penalty = clamp((30 - intersectionsWithin1km) / 200, 0, 0.15);
  const raw = weighted / totalWeight;

  return clamp(Math.round(raw * 100 * (1 - penalty)), 0, 100);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- walk`
Expected: PASS — 9 tests

If the dense-urban assertion (`> 75`) fails, do **not** loosen the test. The maximum
achievable raw score is bounded by `POSITION_WEIGHTS` summing to 1.75 per category;
verify the fixture actually contains amenities across many categories, and record a
denser reference point if it does not.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/walk.ts tests/scoring/walk.test.ts
git commit -m "feat: Walk Score with distance decay and intersection penalty"
```

---

## Task 6: Drive, Transit, Errand, Urban-Suburban and Overall scores

**Files:**
- Create: `lib/scoring/drive.ts`, `transit.ts`, `errand.ts`, `urbanSuburban.ts`, `overall.ts`
- Test: `tests/scoring/drive.test.ts`, `transit.test.ts`, `errand.test.ts`, `urbanSuburban.test.ts`, `overall.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–5
- Produces:
  - `driveScore(amenities: Amenity[]): number`
  - `transitScore(stops: TransitStop[]): number`
  - `errandScore(amenities: Amenity[]): number`
  - `fifteenMinuteBreakdown(amenities: Amenity[]): { met: CategoryId[]; missing: CategoryId[] }`
  - `urbanSuburbanIndex(amenities, street): { index: number; band: UrbanBand }`
  - `overallScore(scores: Omit<Scores, 'overall'>): number`

- [ ] **Step 1: Write the failing drive test**

Create `tests/scoring/drive.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { driveScore } from '@/lib/scoring/drive';
import { walkScore } from '@/lib/scoring/walk';
import type { Amenity } from '@/lib/report/types';

const amenity = (over: Partial<Amenity>): Amenity => ({
  id: 1, name: 'Test', category: 'grocery', lat: 0, lon: 0, distanceM: 100, ...over,
});

describe('driveScore', () => {
  it('returns 0 with no amenities', () => {
    expect(driveScore([])).toBe(0);
  });

  it('counts amenities that Walk Score ignores as too far', () => {
    const far = [
      amenity({ id: 1, category: 'grocery', distanceM: 5000 }),
      amenity({ id: 2, category: 'retail', distanceM: 6000 }),
      amenity({ id: 3, category: 'errands', distanceM: 4500 }),
    ];
    expect(walkScore(far, 40)).toBe(0);
    expect(driveScore(far)).toBeGreaterThan(0);
  });

  it('ignores amenities beyond the 8km radius', () => {
    expect(driveScore([amenity({ distanceM: 9000 })])).toBe(0);
  });

  it('weights a cafe less than a supermarket', () => {
    const cafe = driveScore([amenity({ category: 'cafe', distanceM: 1000 })]);
    const grocery = driveScore([amenity({ category: 'grocery', distanceM: 1000 })]);
    expect(grocery).toBeGreaterThan(cafe);
  });

  it('stays within 0-100', () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      amenity({ id: i, category: 'retail', distanceM: 500 }),
    );
    const score = driveScore(many);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement drive.ts**

Run: `npm test -- drive` → FAIL

```ts
import { CATEGORIES } from './categories';
import { clamp, decay } from './math';
import type { Amenity } from '@/lib/report/types';

const RADIUS_M = 8000;
const DECAY_SCALE_M = 9600;
const POSITION_WEIGHTS = [1.0, 0.5, 0.25];

/**
 * Drive Score: the Walk Score algorithm at a wider radius over a
 * car-relevant weighting, exactly as the brief specifies.
 * No intersection penalty — street connectivity is irrelevant when driving.
 */
export function driveScore(amenities: Amenity[]): number {
  let weighted = 0;
  let totalWeight = 0;

  for (const category of CATEGORIES) {
    const nearest = amenities
      .filter((a) => a.category === category.id && a.distanceM <= RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, POSITION_WEIGHTS.length);

    const categoryScore = nearest.reduce(
      (sum, a, i) => sum + decay(a.distanceM, DECAY_SCALE_M) * POSITION_WEIGHTS[i],
      0,
    );

    weighted += categoryScore * category.driveWeight;
    totalWeight += category.driveWeight;
  }

  if (totalWeight === 0) return 0;
  return clamp(Math.round((weighted / totalWeight) * 100), 0, 100);
}
```

Run: `npm test -- drive` → PASS (5 tests)

- [ ] **Step 3: Write the failing transit test**

Create `tests/scoring/transit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { transitScore } from '@/lib/scoring/transit';
import type { TransitStop } from '@/lib/report/types';

const stop = (over: Partial<TransitStop>): TransitStop => ({
  id: 1, name: 'Stop', mode: 'bus', routeCount: 1, distanceM: 300, ...over,
});

describe('transitScore', () => {
  it('returns 0 with no stops', () => {
    expect(transitScore([])).toBe(0);
  });

  it('scores a rail station above a bus stop at the same distance', () => {
    expect(transitScore([stop({ mode: 'rail' })]))
      .toBeGreaterThan(transitScore([stop({ mode: 'bus' })]));
  });

  it('rewards more routes at one stop', () => {
    expect(transitScore([stop({ routeCount: 6 })]))
      .toBeGreaterThan(transitScore([stop({ routeCount: 1 })]));
  });

  it('rewards a closer stop', () => {
    expect(transitScore([stop({ distanceM: 150 })]))
      .toBeGreaterThan(transitScore([stop({ distanceM: 1400 })]));
  });

  it('ignores stops beyond 1500m', () => {
    expect(transitScore([stop({ distanceM: 1600 })])).toBe(0);
  });

  it('caps at 100 for a transit-saturated location', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      stop({ id: i, mode: 'rail', routeCount: 8, distanceM: 120 }),
    );
    expect(transitScore(many)).toBe(100);
  });
});
```

- [ ] **Step 4: Run to verify it fails, then implement transit.ts**

Run: `npm test -- transit` → FAIL

```ts
import { clamp, decay } from './math';
import type { TransitStop } from '@/lib/report/types';

const RADIUS_M = 1500;
const DECAY_SCALE_M = 1800;

/**
 * K is a calibration constant, not a derived value. It is fixed against the
 * four reference fixtures so that a transit-saturated core lands near 100 and
 * a single bus stop lands near 15. Changing it must show up as a test diff.
 */
const K = 4;

const MODE_WEIGHT: Record<TransitStop['mode'], number> = {
  rail: 3,
  light_rail: 2,
  tram: 2,
  bus: 1,
};

export function transitScore(stops: TransitStop[]): number {
  const total = stops
    .filter((s) => s.distanceM <= RADIUS_M)
    .reduce(
      (sum, s) =>
        sum +
        decay(s.distanceM, DECAY_SCALE_M) *
          MODE_WEIGHT[s.mode] *
          Math.max(1, s.routeCount),
      0,
    );

  return clamp(Math.round(K * total), 0, 100);
}
```

Run: `npm test -- transit` → PASS (6 tests)

- [ ] **Step 5: Write the failing errand test**

Create `tests/scoring/errand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { errandScore, fifteenMinuteBreakdown } from '@/lib/scoring/errand';
import type { Amenity, CategoryId } from '@/lib/report/types';

const at = (category: CategoryId, distanceM: number, id = 1): Amenity => ({
  id, name: 'Test', category, lat: 0, lon: 0, distanceM,
});

describe('errandScore', () => {
  it('is 0 with no amenities', () => {
    expect(errandScore([])).toBe(0);
  });

  it('is 100 when all nine categories are within 1200m', () => {
    const all: Amenity[] = (
      ['grocery','dining','cafe','retail','errands','parks','schools','culture','fitness'] as CategoryId[]
    ).map((c, i) => at(c, 500, i));
    expect(errandScore(all)).toBe(100);
  });

  it('counts each category once regardless of how many instances', () => {
    const five = [1, 2, 3, 4, 5].map((i) => at('cafe', 300, i));
    expect(errandScore(five)).toBe(errandScore([at('cafe', 300)]));
  });

  it('excludes categories only reachable beyond 1200m', () => {
    expect(errandScore([at('grocery', 1300)])).toBe(0);
  });
});

describe('fifteenMinuteBreakdown', () => {
  it('splits categories into met and missing', () => {
    const { met, missing } = fifteenMinuteBreakdown([
      at('grocery', 400, 1),
      at('cafe', 600, 2),
    ]);
    expect(met).toEqual(['grocery', 'cafe']);
    expect(missing).toContain('schools');
    expect(met.length + missing.length).toBe(9);
  });

  it('reports everything missing for an empty dataset', () => {
    const { met, missing } = fifteenMinuteBreakdown([]);
    expect(met).toEqual([]);
    expect(missing).toHaveLength(9);
  });
});
```

- [ ] **Step 6: Run to verify it fails, then implement errand.ts**

Run: `npm test -- errand` → FAIL

```ts
import { CATEGORIES } from './categories';
import type { Amenity, CategoryId } from '@/lib/report/types';

/** 1200 m is roughly 15 minutes at 4.8 km/h. */
const THRESHOLD_M = 1200;

export function fifteenMinuteBreakdown(
  amenities: Amenity[],
): { met: CategoryId[]; missing: CategoryId[] } {
  const reachable = new Set(
    amenities.filter((a) => a.distanceM <= THRESHOLD_M).map((a) => a.category),
  );

  const met: CategoryId[] = [];
  const missing: CategoryId[] = [];

  for (const category of CATEGORIES) {
    if (reachable.has(category.id)) met.push(category.id);
    else missing.push(category.id);
  }

  return { met, missing };
}

export function errandScore(amenities: Amenity[]): number {
  const { met } = fifteenMinuteBreakdown(amenities);
  return Math.round((met.length / CATEGORIES.length) * 100);
}
```

Run: `npm test -- errand` → PASS (6 tests)

- [ ] **Step 7: Write the failing urban-suburban test**

Create `tests/scoring/urbanSuburban.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { urbanSuburbanIndex } from '@/lib/scoring/urbanSuburban';
import type { Amenity } from '@/lib/report/types';

const many = (count: number): Amenity[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i, name: 'A', category: 'dining' as const, lat: 0, lon: 0, distanceM: 500,
  }));

describe('urbanSuburbanIndex', () => {
  it('labels an empty area Rural', () => {
    const { index, band } = urbanSuburbanIndex([], {
      intersectionsWithin1km: 2, buildingsWithin500m: 3,
    });
    expect(index).toBeLessThanOrEqual(25);
    expect(band).toBe('Rural');
  });

  it('labels a saturated area Dense Urban', () => {
    const { index, band } = urbanSuburbanIndex(many(200), {
      intersectionsWithin1km: 160, buildingsWithin500m: 600,
    });
    expect(index).toBeGreaterThan(75);
    expect(band).toBe('Dense Urban');
  });

  it('places a moderate area in a middle band', () => {
    const { band } = urbanSuburbanIndex(many(50), {
      intersectionsWithin1km: 45, buildingsWithin500m: 150,
    });
    expect(['Suburban', 'Urban']).toContain(band);
  });

  it('only counts amenities within 1km', () => {
    const far: Amenity[] = Array.from({ length: 200 }, (_, i) => ({
      id: i, name: 'A', category: 'dining' as const, lat: 0, lon: 0, distanceM: 1500,
    }));
    const near = urbanSuburbanIndex(many(200), { intersectionsWithin1km: 0, buildingsWithin500m: 0 });
    const distant = urbanSuburbanIndex(far, { intersectionsWithin1km: 0, buildingsWithin500m: 0 });
    expect(distant.index).toBeLessThan(near.index);
  });

  it('always returns an index within 0-100', () => {
    const { index } = urbanSuburbanIndex(many(5000), {
      intersectionsWithin1km: 9999, buildingsWithin500m: 9999,
    });
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 8: Run to verify it fails, then implement urbanSuburban.ts**

Run: `npm test -- urbanSuburban` → FAIL

```ts
import { clamp, norm } from './math';
import type { Amenity, StreetContext, UrbanBand } from '@/lib/report/types';

const AMENITY_CAP = 150;
const INTERSECTION_CAP = 120;
const BUILDING_CAP = 400;

function bandFor(index: number): UrbanBand {
  if (index <= 25) return 'Rural';
  if (index <= 50) return 'Suburban';
  if (index <= 75) return 'Urban';
  return 'Dense Urban';
}

/**
 * A single number *and* a label, as the brief asks for.
 * Derived from amenity density, street connectivity and building footprint.
 */
export function urbanSuburbanIndex(
  amenities: Amenity[],
  street: StreetContext,
): { index: number; band: UrbanBand } {
  const nearby = amenities.filter((a) => a.distanceM <= 1000).length;

  const index = clamp(
    Math.round(
      100 *
        (0.45 * norm(nearby, AMENITY_CAP) +
          0.3 * norm(street.intersectionsWithin1km, INTERSECTION_CAP) +
          0.25 * norm(street.buildingsWithin500m, BUILDING_CAP)),
    ),
    0,
    100,
  );

  return { index, band: bandFor(index) };
}
```

Run: `npm test -- urbanSuburban` → PASS (5 tests)

- [ ] **Step 9: Write the failing overall test**

Create `tests/scoring/overall.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { overallScore } from '@/lib/scoring/overall';

const base = {
  walk: 50, drive: 50, transit: 50, errand: 50,
  urbanSuburban: { index: 50, band: 'Suburban' as const },
};

describe('overallScore', () => {
  it('returns the shared value when every score matches', () => {
    expect(overallScore(base)).toBe(50);
  });

  it('weights walk most heavily', () => {
    const betterWalk = overallScore({ ...base, walk: 100 });
    const betterDrive = overallScore({ ...base, drive: 100 });
    expect(betterWalk).toBeGreaterThan(betterDrive);
  });

  it('returns 0 when everything is 0', () => {
    expect(overallScore({
      walk: 0, drive: 0, transit: 0, errand: 0,
      urbanSuburban: { index: 0, band: 'Rural' },
    })).toBe(0);
  });

  it('returns 100 when everything is 100', () => {
    expect(overallScore({
      walk: 100, drive: 100, transit: 100, errand: 100,
      urbanSuburban: { index: 100, band: 'Dense Urban' },
    })).toBe(100);
  });

  it('ignores the urban-suburban index, which is descriptive not evaluative', () => {
    const urban = overallScore({ ...base, urbanSuburban: { index: 95, band: 'Dense Urban' } });
    const rural = overallScore({ ...base, urbanSuburban: { index: 5, band: 'Rural' } });
    expect(urban).toBe(rural);
  });
});
```

- [ ] **Step 10: Run to verify it fails, then implement overall.ts**

Run: `npm test -- overall` → FAIL

```ts
import { clamp } from './math';
import type { Scores } from '@/lib/report/types';

/**
 * Headline score. Walk leads because it is the strongest single signal of
 * location quality for a renter. The urban-suburban index is deliberately
 * excluded: it describes a place, it does not rank it — a rural address is
 * not worse than an urban one, only different.
 */
const WEIGHTS = { walk: 0.4, transit: 0.25, errand: 0.2, drive: 0.15 } as const;

export function overallScore(scores: Omit<Scores, 'overall'>): number {
  const total =
    scores.walk * WEIGHTS.walk +
    scores.transit * WEIGHTS.transit +
    scores.errand * WEIGHTS.errand +
    scores.drive * WEIGHTS.drive;

  return clamp(Math.round(total), 0, 100);
}
```

Run: `npm test -- overall` → PASS (5 tests)

- [ ] **Step 11: Run the full suite and lint**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS — whole suite green; the purity lint rule must not fire on any scoring file

- [ ] **Step 12: Commit**

```bash
git add lib/scoring tests/scoring
git commit -m "feat: drive, transit, errand, urban-suburban and overall scores"
```

---

## Task 7: Mapbox provider and the autocomplete proxy

**Files:**
- Create: `lib/providers/mapbox.ts`, `app/api/autocomplete/route.ts`, `.env.local.example`
- Test: `tests/providers/mapbox.test.ts`

**Interfaces:**
- Consumes: `AddressSuggestion` (Task 3)
- Produces:
  - `suggestAddresses(query: string, sessionToken: string): Promise<AddressSuggestion[]>`
  - `retrieveAddress(mapboxId: string, sessionToken: string): Promise<{ address: string; lat: number; lon: number } | null>`
  - `reverseGeocode(coords: Coordinates): Promise<string | null>` — canonical address for a decoded slug
  - `parseSuggestResponse(json: unknown): AddressSuggestion[]` — exported for tests
  - `GET /api/autocomplete?q=&session=` → `{ suggestions: AddressSuggestion[] }`
  - `GET /api/autocomplete?id=&session=` → `{ address, lat, lon }`

- [ ] **Step 1: Create the env example**

Create `.env.local.example`:

```bash
# Public — URL-restricted at Mapbox to your deploy domain. Ships to the browser.
NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN=pk.your_public_token

# Secret — server-side only. Never prefix with NEXT_PUBLIC_.
MAPBOX_SECRET_TOKEN=sk.your_secret_token
```

Then `cp .env.local.example .env.local` and fill in real values.

- [ ] **Step 2: Write the failing parser test**

Create `tests/providers/mapbox.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSuggestResponse } from '@/lib/providers/mapbox';

const valid = {
  suggestions: [
    {
      mapbox_id: 'abc123',
      name: '1600 Pennsylvania Avenue NW',
      place_formatted: 'Washington, DC 20500, United States',
    },
    {
      mapbox_id: 'def456',
      name: '1600 Pennsylvania Ave SE',
      place_formatted: 'Washington, DC 20003, United States',
    },
  ],
};

describe('parseSuggestResponse', () => {
  it('maps the Mapbox payload to typed suggestions', () => {
    const parsed = parseSuggestResponse(valid);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      mapboxId: 'abc123',
      primary: '1600 Pennsylvania Avenue NW',
      secondary: 'Washington, DC 20500, United States',
    });
  });

  it('returns an empty array for a malformed payload rather than throwing', () => {
    expect(parseSuggestResponse(null)).toEqual([]);
    expect(parseSuggestResponse({})).toEqual([]);
    expect(parseSuggestResponse({ suggestions: 'nope' })).toEqual([]);
  });

  it('skips entries missing an id or name', () => {
    const partial = { suggestions: [{ mapbox_id: 'x' }, { name: 'y' }, valid.suggestions[0]] };
    expect(parseSuggestResponse(partial)).toHaveLength(1);
  });

  it('defaults a missing place_formatted to an empty string', () => {
    const noPlace = { suggestions: [{ mapbox_id: 'x', name: 'Somewhere' }] };
    expect(parseSuggestResponse(noPlace)[0].secondary).toBe('');
  });
});
```

- [ ] **Step 3: Run to verify it fails, then implement mapbox.ts**

Run: `npm test -- mapbox` → FAIL

```ts
import type { AddressSuggestion } from '@/lib/report/types';

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
```

Run: `npm test -- mapbox` → PASS (4 tests)

- [ ] **Step 3b: Add reverse geocoding**

A slug's readable portion is decorative and lossy — `washington-dc` cannot tell us the
address was `Washington, DC`. The report page therefore resolves the canonical address
from the decoded coordinates rather than trying to un-mangle the slug.

Append this test to `tests/providers/mapbox.test.ts`:

```ts
import { parseReverseResponse } from '@/lib/providers/mapbox';

describe('parseReverseResponse', () => {
  it('returns the full formatted address', () => {
    const json = {
      features: [{ properties: { full_address: '1600 Pennsylvania Ave NW, Washington, DC 20500' } }],
    };
    expect(parseReverseResponse(json)).toBe('1600 Pennsylvania Ave NW, Washington, DC 20500');
  });

  it('falls back to place_formatted when full_address is absent', () => {
    const json = { features: [{ properties: { place_formatted: 'Washington, DC' } }] };
    expect(parseReverseResponse(json)).toBe('Washington, DC');
  });

  it('returns null for an empty or malformed payload', () => {
    expect(parseReverseResponse({ features: [] })).toBeNull();
    expect(parseReverseResponse(null)).toBeNull();
    expect(parseReverseResponse({})).toBeNull();
  });
});
```

Run `npm test -- mapbox` → FAIL, then append to `lib/providers/mapbox.ts`:

```ts
import type { Coordinates } from '@/lib/report/types';

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
```

Run: `npm test -- mapbox` → PASS (7 tests)

- [ ] **Step 4: Implement the proxy route**

Create `app/api/autocomplete/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { retrieveAddress, suggestAddresses } from '@/lib/providers/mapbox';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const session = params.get('session');

  if (!session) {
    return NextResponse.json({ error: 'session is required' }, { status: 400 });
  }

  try {
    const mapboxId = params.get('id');
    if (mapboxId) {
      const result = await retrieveAddress(mapboxId, session);
      if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 });
      return NextResponse.json(result);
    }

    const query = params.get('q') ?? '';
    return NextResponse.json({ suggestions: await suggestAddresses(query, session) });
  } catch {
    // Never leak provider errors or token state to the client.
    return NextResponse.json({ error: 'upstream unavailable' }, { status: 502 });
  }
}
```

- [ ] **Step 5: Verify the proxy manually**

```bash
npm run dev
curl -s "http://localhost:3000/api/autocomplete?q=1600%20Pennsylvania&session=test-1" | head -c 400
```

Expected: JSON containing a `suggestions` array with real DC addresses.
Confirm no token string appears anywhere in the response.

- [ ] **Step 6: Commit**

```bash
git add lib/providers/mapbox.ts app/api tests/providers/mapbox.test.ts .env.local.example
git commit -m "feat: Mapbox provider behind a server-side autocomplete proxy"
```

---

## Task 8: Address search combobox

**Files:**
- Create: `components/search/AddressSearch.tsx`
- Modify: `app/page.tsx`
- Test: `tests/search/AddressSearch.test.tsx`

**Interfaces:**
- Consumes: `/api/autocomplete` (Task 7), `buildSlug` (Task 2), `AddressSuggestion` (Task 3)
- Produces: `<AddressSearch />` — a client component that navigates to `/a/{slug}` on selection

- [ ] **Step 1: Write the failing test**

Create `tests/search/AddressSearch.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddressSearch } from '@/components/search/AddressSearch';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const suggestions = [
  { mapboxId: 'a', primary: '1600 Pennsylvania Avenue NW', secondary: 'Washington, DC' },
  { mapboxId: 'b', primary: '1600 Pennsylvania Ave SE', secondary: 'Washington, DC' },
];

beforeEach(() => {
  push.mockReset();
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes('id=')) {
      return new Response(JSON.stringify({
        address: '1600 Pennsylvania Avenue NW, Washington, DC',
        lat: 38.8977, lon: -77.0365,
      }));
    }
    return new Response(JSON.stringify({ suggestions }));
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('AddressSearch', () => {
  it('exposes correct combobox semantics', () => {
    render(<AddressSearch />);
    const input = screen.getByRole('combobox', { name: /address/i });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('shows suggestions after typing at least 3 characters', async () => {
    const user = userEvent.setup();
    render(<AddressSearch />);
    await user.type(screen.getByRole('combobox'), '1600 Penn');
    expect(await screen.findByText('1600 Pennsylvania Avenue NW')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not query for fewer than 3 characters', async () => {
    const user = userEvent.setup();
    render(<AddressSearch />);
    await user.type(screen.getByRole('combobox'), '16');
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates to the report on selection', async () => {
    const user = userEvent.setup();
    render(<AddressSearch />);
    await user.type(screen.getByRole('combobox'), '1600 Penn');
    await user.click(await screen.findByText('1600 Pennsylvania Avenue NW'));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push.mock.calls[0][0]).toMatch(/^\/a\/1600-pennsylvania-avenue-nw-washington-dc-[0-9a-z]{7}$/);
  });

  it('supports arrow-key navigation and Enter', async () => {
    const user = userEvent.setup();
    render(<AddressSearch />);
    const input = screen.getByRole('combobox');
    await user.type(input, '1600 Penn');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push.mock.calls[0][0]).toContain('1600-pennsylvania-ave-se');
  });

  it('closes the list on Escape', async () => {
    const user = userEvent.setup();
    render(<AddressSearch />);
    await user.type(screen.getByRole('combobox'), '1600 Penn');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Install the interaction library and run to verify it fails**

```bash
npm install -D @testing-library/user-event
npm test -- AddressSearch
```

Expected: FAIL — cannot find module

- [ ] **Step 3: Implement AddressSearch.tsx**

```tsx
'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildSlug } from '@/lib/geo/slug';
import type { AddressSuggestion } from '@/lib/report/types';

const DEBOUNCE_MS = 250;
const MIN_QUERY = 3;

export function AddressSearch() {
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  // One session token per widget instance — Mapbox bills per session, not per keystroke.
  const session = useRef(crypto.randomUUID());

  useEffect(() => {
    if (query.trim().length < MIN_QUERY) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/autocomplete?q=${encodeURIComponent(query)}&session=${session.current}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { suggestions?: AddressSuggestion[] };
        setSuggestions(json.suggestions ?? []);
        setOpen((json.suggestions ?? []).length > 0);
        setActive(-1);
      } catch {
        // Aborted or offline — leave the previous list in place.
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const select = useCallback(
    async (suggestion: AddressSuggestion) => {
      setOpen(false);
      setQuery(suggestion.primary);

      const res = await fetch(
        `/api/autocomplete?id=${encodeURIComponent(suggestion.mapboxId)}&session=${session.current}`,
      );
      if (!res.ok) return;

      const { address, lat, lon } = (await res.json()) as {
        address: string; lat: number; lon: number;
      };

      router.push(`/a/${buildSlug(address || suggestion.primary, lat, lon)}`);
    },
    [router],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void select(suggestions[Math.max(0, active)]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-xl text-left">
      <input
        type="text"
        role="combobox"
        aria-label="Address"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listboxId}-${active}` : undefined}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Enter a US address"
        className="w-full rounded-btn px-4 py-4 text-base text-gray-1 shadow-lg outline-none"
      />

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-10 mt-2 w-full overflow-hidden rounded-btn bg-white shadow-xl"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.mapboxId}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                void select(s);
              }}
              className={`cursor-pointer border-b border-gray-4 px-4 py-3 last:border-b-0 ${
                i === active ? 'bg-accent-tint' : ''
              }`}
            >
              <span className="block text-sm font-medium text-gray-1">{s.primary}</span>
              <span className="block text-xs text-gray-2">{s.secondary}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- AddressSearch`
Expected: PASS — 6 tests

- [ ] **Step 5: Build the search page**

Replace `app/page.tsx`:

```tsx
import { AddressSearch } from '@/components/search/AddressSearch';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-charcoal">
      <nav className="flex items-center gap-5 border-b border-white/10 px-6 py-4">
        <span className="text-base font-bold tracking-[-0.03em] text-white">
          rad<span className="text-accent">ius</span>
        </span>
      </nav>

      <section className="px-6 py-24 text-center">
        <h1 className="mx-auto mb-4 max-w-[16ch] text-4xl text-white sm:text-5xl">
          Know the address before you list it.
        </h1>
        <p className="mx-auto mb-8 max-w-[52ch] text-gray-3">
          Walkability, transit, nearby businesses and renter fit — for any US address, in one page.
        </p>
        <AddressSearch />
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Verify in the browser**

```bash
npm run dev
```

Open `http://localhost:3000`, type a real address, confirm suggestions appear and that
selecting one navigates to `/a/...` (the page will 404 until Task 10 — that is expected).

- [ ] **Step 7: Commit**

```bash
git add components/search app/page.tsx tests/search
git commit -m "feat: accessible address autocomplete on the search screen"
```

---

## Task 9: Report orchestrator

**Files:**
- Create: `lib/report/buildReport.ts`
- Test: `tests/report/buildReport.test.ts`

**Interfaces:**
- Consumes: every provider (Tasks 4, 7) and every scoring function (Tasks 5, 6)
- Produces: `buildReport(address: string, coords: Coordinates): Promise<Report>`

- [ ] **Step 1: Write the failing test**

Create `tests/report/buildReport.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import denseUrban from '../fixtures/dense-urban.json';
import { parseAmenityElements } from '@/lib/providers/overpass';

const DC = { lat: 38.8977, lon: -77.0365 };
const amenities = parseAmenityElements(denseUrban.elements, DC);

vi.mock('@/lib/providers/overpass', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/providers/overpass')>();
  return {
    ...actual,
    fetchAmenities: vi.fn(),
    fetchTransitStops: vi.fn(),
    fetchStreetContext: vi.fn(),
  };
});

const overpass = await import('@/lib/providers/overpass');
const { buildReport } = await import('@/lib/report/buildReport');

beforeEach(() => {
  vi.mocked(overpass.fetchAmenities).mockResolvedValue(amenities);
  vi.mocked(overpass.fetchTransitStops).mockResolvedValue([
    { id: 1, name: 'Metro Center', mode: 'rail', routeCount: 3, distanceM: 400 },
  ]);
  vi.mocked(overpass.fetchStreetContext).mockResolvedValue({
    intersectionsWithin1km: 95, buildingsWithin500m: 320,
  });
});

describe('buildReport', () => {
  it('assembles a complete report', async () => {
    const report = await buildReport('1600 Pennsylvania Ave NW', DC);
    expect(report.address).toBe('1600 Pennsylvania Ave NW');
    expect(report.coordinates).toEqual(DC);
    expect(report.slug).toMatch(/-[0-9a-z]{7}$/);
    expect(report.scores.walk).toBeGreaterThan(0);
    expect(report.scores.overall).toBeGreaterThan(0);
    expect(report.amenities.length).toBeGreaterThan(0);
    expect(report.fifteenMinute.met.length + report.fifteenMinute.missing.length).toBe(9);
  });

  it('fetches amenities at the 8km drive radius, not 2km', async () => {
    await buildReport('x', DC);
    expect(vi.mocked(overpass.fetchAmenities)).toHaveBeenCalledWith(DC, 8000);
  });

  it('still produces a report when transit lookup fails', async () => {
    vi.mocked(overpass.fetchTransitStops).mockRejectedValue(new Error('down'));
    const report = await buildReport('x', DC);
    expect(report.scores.transit).toBe(0);
    expect(report.scores.walk).toBeGreaterThan(0);
  });

  it('still produces a report when street context fails', async () => {
    vi.mocked(overpass.fetchStreetContext).mockRejectedValue(new Error('down'));
    const report = await buildReport('x', DC);
    expect(report.street.intersectionsWithin1km).toBe(30);
    expect(report.scores.walk).toBeGreaterThan(0);
  });

  it('flags sparse data when very few amenities are found', async () => {
    vi.mocked(overpass.fetchAmenities).mockResolvedValue([]);
    const report = await buildReport('x', DC);
    expect(report.dataSparse).toBe(true);
  });

  it('does not flag sparse data for a dense address', async () => {
    expect((await buildReport('x', DC)).dataSparse).toBe(false);
  });

  it('throws when amenity lookup fails entirely — there is no report without it', async () => {
    vi.mocked(overpass.fetchAmenities).mockRejectedValue(new Error('all endpoints down'));
    await expect(buildReport('x', DC)).rejects.toThrow(/amenit/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement buildReport.ts**

Run: `npm test -- buildReport` → FAIL

```ts
import { buildSlug } from '@/lib/geo/slug';
import {
  fetchAmenities, fetchStreetContext, fetchTransitStops,
} from '@/lib/providers/overpass';
import { driveScore } from '@/lib/scoring/drive';
import { errandScore, fifteenMinuteBreakdown } from '@/lib/scoring/errand';
import { overallScore } from '@/lib/scoring/overall';
import { transitScore } from '@/lib/scoring/transit';
import { urbanSuburbanIndex } from '@/lib/scoring/urbanSuburban';
import { walkScore } from '@/lib/scoring/walk';
import type { Coordinates, Report, StreetContext, TransitStop } from '@/lib/report/types';

/** Fetch at the widest radius any score needs, then let each score filter down. */
const FETCH_RADIUS_M = 8000;
const TRANSIT_RADIUS_M = 1500;
const SPARSE_THRESHOLD = 5;

const NEUTRAL_STREET: StreetContext = {
  intersectionsWithin1km: 30,
  buildingsWithin500m: 0,
};

export async function buildReport(
  address: string,
  coords: Coordinates,
): Promise<Report> {
  const [amenityResult, transitResult, streetResult] = await Promise.allSettled([
    fetchAmenities(coords, FETCH_RADIUS_M),
    fetchTransitStops(coords, TRANSIT_RADIUS_M),
    fetchStreetContext(coords),
  ]);

  // Amenities are load-bearing — without them there is no report at all.
  if (amenityResult.status === 'rejected') {
    throw new Error(`Could not load amenities: ${String(amenityResult.reason)}`);
  }
  const amenities = amenityResult.value;

  // Transit and street context are refinements; degrade rather than fail.
  const transitStops: TransitStop[] =
    transitResult.status === 'fulfilled' ? transitResult.value : [];
  const street: StreetContext =
    streetResult.status === 'fulfilled' ? streetResult.value : NEUTRAL_STREET;

  const walk = walkScore(amenities, street.intersectionsWithin1km);
  const drive = driveScore(amenities);
  const transit = transitScore(transitStops);
  const errand = errandScore(amenities);
  const urbanSuburban = urbanSuburbanIndex(amenities, street);

  return {
    address,
    coordinates: coords,
    slug: buildSlug(address, coords.lat, coords.lon),
    scores: {
      walk,
      drive,
      transit,
      errand,
      urbanSuburban,
      overall: overallScore({ walk, drive, transit, errand, urbanSuburban }),
    },
    amenities,
    transitStops,
    street,
    fifteenMinute: fifteenMinuteBreakdown(amenities),
    dataSparse: amenities.length < SPARSE_THRESHOLD,
  };
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npm test -- buildReport`
Expected: PASS — 7 tests

- [ ] **Step 4: Commit**

```bash
git add lib/report/buildReport.ts tests/report
git commit -m "feat: report orchestrator with per-provider graceful degradation"
```

---

## Task 10: Report page and insight cards

**Files:**
- Create: `app/a/[slug]/page.tsx`, `app/a/[slug]/loading.tsx`, `app/not-found.tsx`
- Create: `components/report/ReportHeader.tsx`, `ScoreTiles.tsx`, `NearbyList.tsx`, `UrbanSuburbanBar.tsx`, `FifteenMinute.tsx`
- Test: `tests/report/ScoreTiles.test.tsx`, `tests/report/NearbyList.test.tsx`

**Interfaces:**
- Consumes: `buildReport` (Task 9), `parseSlug` (Task 2), `ScoreTile`/`Card`/`Meter` (Task 1), `metresToWalkMinutes` (Task 2)
- Produces: `/a/[slug]` rendering a full report

- [ ] **Step 1: Write the failing component tests**

Create `tests/report/ScoreTiles.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreTiles } from '@/components/report/ScoreTiles';

const scores = {
  walk: 94, drive: 71, transit: 88, errand: 91,
  urbanSuburban: { index: 89, band: 'Dense Urban' as const },
  overall: 87,
};

describe('ScoreTiles', () => {
  it('renders all four scores', () => {
    render(<ScoreTiles scores={scores} />);
    for (const label of ['Walk', 'Drive', 'Transit', 'Errand']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('94')).toBeInTheDocument();
    expect(screen.getByText('71')).toBeInTheDocument();
  });

  it('gives each score an accessible meter', () => {
    render(<ScoreTiles scores={scores} />);
    expect(screen.getAllByRole('meter')).toHaveLength(4);
  });
});
```

Create `tests/report/NearbyList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NearbyList } from '@/components/report/NearbyList';
import type { Amenity } from '@/lib/report/types';

const amenities: Amenity[] = [
  { id: 1, name: 'Whole Foods', category: 'grocery', lat: 0, lon: 0, distanceM: 320 },
  { id: 2, name: 'Compass Coffee', category: 'cafe', lat: 0, lon: 0, distanceM: 210 },
  { id: 3, name: 'Far Gym', category: 'fitness', lat: 0, lon: 0, distanceM: 4000 },
];

describe('NearbyList', () => {
  it('shows the nearest amenities with walk times', () => {
    render(<NearbyList amenities={amenities} />);
    expect(screen.getByText('Compass Coffee')).toBeInTheDocument();
    expect(screen.getByText('3 min')).toBeInTheDocument(); // 210m / 80 = 2.6 -> 3
  });

  it('excludes anything beyond a 10-minute walk', () => {
    render(<NearbyList amenities={amenities} />);
    expect(screen.queryByText('Far Gym')).not.toBeInTheDocument();
  });

  it('renders an explanatory message when nothing is walkable', () => {
    render(<NearbyList amenities={[amenities[2]]} />);
    expect(screen.getByText(/nothing within a 10-minute walk/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- ScoreTiles NearbyList`
Expected: FAIL — cannot find modules

- [ ] **Step 3: Implement the report components**

Create `components/report/ScoreTiles.tsx`:

```tsx
import { ScoreTile } from '@/components/ui/ScoreTile';
import type { Scores } from '@/lib/report/types';

export function ScoreTiles({ scores }: { scores: Scores }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <ScoreTile label="Walk" value={scores.walk} caption="Daily errands on foot" />
      <ScoreTile label="Drive" value={scores.drive} caption="Reach within 8 km" />
      <ScoreTile label="Transit" value={scores.transit} caption="Stops and routes nearby" />
      <ScoreTile label="Errand" value={scores.errand} caption="15-minute needs met" />
    </div>
  );
}
```

Create `components/report/NearbyList.tsx`:

```tsx
import { Card } from '@/components/ui/Card';
import { metresToWalkMinutes } from '@/lib/geo/distance';
import { categoryById } from '@/lib/scoring/categories';
import type { Amenity } from '@/lib/report/types';

const WALKABLE_M = 800; // 10 minutes at 4.8 km/h
const MAX_ROWS = 8;

export function NearbyList({ amenities }: { amenities: Amenity[] }) {
  const walkable = amenities
    .filter((a) => a.distanceM <= WALKABLE_M)
    .slice(0, MAX_ROWS);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-gray-2">
        <span>Nearby</span>
        <span className="text-gray-3">
          {amenities.filter((a) => a.distanceM <= WALKABLE_M).length} within a 10-minute walk
        </span>
      </div>

      {walkable.length === 0 ? (
        <p className="m-0 text-sm text-gray-2">
          Nothing within a 10-minute walk. This is a car-dependent location.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {walkable.map((a) => (
            <li
              key={a.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-gray-4 py-2 text-sm last:border-b-0"
            >
              <span className="truncate font-medium">{a.name}</span>
              <span className="font-mono text-[10px] text-gray-2">
                {categoryById(a.category).label}
              </span>
              <span className="font-mono text-xs">{metresToWalkMinutes(a.distanceM)} min</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

Create `components/report/UrbanSuburbanBar.tsx`:

```tsx
import { Card } from '@/components/ui/Card';
import { Meter } from '@/components/ui/Meter';
import type { Scores } from '@/lib/report/types';

export function UrbanSuburbanBar({ value }: { value: Scores['urbanSuburban'] }) {
  return (
    <Card>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-2">
        Urban ↔ suburban
      </div>
      <Meter value={value.index} label="Urban to suburban index" />
      <div className="mt-2 flex justify-between font-mono text-[10px]">
        <span className="text-gray-2">RURAL</span>
        <span className="text-accent">
          {value.band.toUpperCase()} · {value.index}
        </span>
      </div>
    </Card>
  );
}
```

Create `components/report/FifteenMinute.tsx`:

```tsx
import { Card } from '@/components/ui/Card';
import { categoryById } from '@/lib/scoring/categories';
import type { Report } from '@/lib/report/types';

export function FifteenMinute({ data }: { data: Report['fifteenMinute'] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-gray-2">
        <span>15-minute check</span>
        <span className="text-gray-3">{data.met.length} of 9 on foot</span>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {data.met.map((id) => (
          <li key={id} className="rounded-full bg-accent-tint px-3 py-1 text-xs text-gray-1">
            ✓ {categoryById(id).label}
          </li>
        ))}
        {data.missing.map((id) => (
          <li key={id} className="rounded-full bg-gray-5 px-3 py-1 text-xs text-gray-3">
            ✕ {categoryById(id).label}
          </li>
        ))}
      </ul>
    </Card>
  );
}
```

Create `components/report/ReportHeader.tsx`:

```tsx
import type { Report } from '@/lib/report/types';

export function ReportHeader({ report }: { report: Report }) {
  return (
    <>
      <div>
        <h1 className="text-xl">{report.address}</h1>
        <span className="mt-1 block font-mono text-[11px] text-gray-2">
          {report.coordinates.lat.toFixed(4)}, {report.coordinates.lon.toFixed(4)}
        </span>
      </div>

      <div className="flex items-center gap-4 rounded-card bg-charcoal p-5 text-white">
        <span className="text-5xl font-bold leading-none tracking-[-0.04em] text-accent">
          {report.scores.overall}
          <small className="text-base font-normal tracking-normal text-gray-3">/100</small>
        </span>
        <div>
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-gray-3">
            Location score
          </span>
          <span className="text-sm text-gray-4">
            {report.scores.urbanSuburban.band} · walk {report.scores.walk} · transit{' '}
            {report.scores.transit}
          </span>
        </div>
      </div>

      {report.dataSparse && (
        <p
          role="status"
          className="m-0 rounded-btn border-l-[3px] border-gray-3 bg-gray-5 px-4 py-3 text-sm text-gray-2"
        >
          OpenStreetMap has little data for this area, so these scores are based on a thin
          sample. They reflect mapped coverage, not necessarily what is actually there.
        </p>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run to verify the component tests pass**

Run: `npm test -- ScoreTiles NearbyList`
Expected: PASS — 5 tests

- [ ] **Step 5: Build the report page**

Create `app/a/[slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { parseSlug } from '@/lib/geo/slug';
import { reverseGeocode } from '@/lib/providers/mapbox';
import { buildReport } from '@/lib/report/buildReport';
import { ReportHeader } from '@/components/report/ReportHeader';
import { ScoreTiles } from '@/components/report/ScoreTiles';
import { NearbyList } from '@/components/report/NearbyList';
import { UrbanSuburbanBar } from '@/components/report/UrbanSuburbanBar';
import { FifteenMinute } from '@/components/report/FifteenMinute';

/**
 * Last-resort label if reverse geocoding is unavailable. The slug's readable
 * portion is lossy — it cannot recover "NW" from "nw" or restore commas — so
 * this is a fallback, never the primary source.
 */
function humanise(slug: string): string {
  return slug
    .split('-')
    .slice(0, -1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const coords = parseSlug(slug);
  if (!coords) notFound();

  // Resolve the canonical address from coordinates. The slug is decorative.
  const canonical = await reverseGeocode(coords);
  const report = await buildReport(canonical ?? humanise(slug), coords);

  return (
    <main className="min-h-screen">
      <nav className="flex items-center gap-5 border-b border-gray-4 px-6 py-4">
        <a href="/" className="text-base font-bold tracking-[-0.03em] text-gray-1 no-underline">
          rad<span className="text-accent">ius</span>
        </a>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-4 p-6">
        <ReportHeader report={report} />
        <ScoreTiles scores={report.scores} />
        <div className="grid gap-4 md:grid-cols-2">
          <NearbyList amenities={report.amenities} />
          <div className="grid content-start gap-4">
            <UrbanSuburbanBar value={report.scores.urbanSuburban} />
            <FifteenMinute data={report.fifteenMinute} />
          </div>
        </div>
      </div>
    </main>
  );
}
```

Create `app/a/[slug]/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-6">
      <div className="h-8 w-2/3 animate-pulse rounded bg-gray-4" />
      <div className="h-28 animate-pulse rounded-card bg-gray-4" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-card bg-gray-4" />
        ))}
      </div>
    </main>
  );
}
```

Create `app/not-found.tsx`:

```tsx
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-16 text-center">
      <h1 className="mb-3 text-3xl">Address not found</h1>
      <p className="mb-6 text-gray-2">
        That link does not contain a valid location. Radius covers US addresses only.
      </p>
      <a href="/" className="font-mono text-sm text-accent">
        ← Search for an address
      </a>
    </main>
  );
}
```

- [ ] **Step 6: Verify end to end in the browser**

```bash
npm run dev
```

Search a real address and confirm the report renders with real scores.
Then copy the `/a/...` URL into a **private window** and confirm it renders identically.

- [ ] **Step 7: Commit**

```bash
git add app components/report tests/report
git commit -m "feat: server-rendered report page with score, nearby and index cards"
```

---

## Task 11: Map and search history

**Files:**
- Create: `components/report/ReportMap.tsx`, `components/report/RecordVisit.tsx`, `components/search/RecentSearches.tsx`, `lib/history.ts`
- Modify: `app/a/[slug]/page.tsx`, `app/page.tsx`
- Test: `tests/search/history.test.ts`, `tests/search/RecentSearches.test.tsx`

**Interfaces:**
- Consumes: `Report` (Task 3), `NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN`
- Produces:
  - `readHistory(): HistoryEntry[]`, `addToHistory(entry: HistoryEntry): void`, `clearHistory(): void`
  - `type HistoryEntry = { address: string; slug: string }`
  - `<ReportMap report={report} />`, `<RecentSearches />`

- [ ] **Step 1: Write the failing history tests**

Create `tests/search/history.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { addToHistory, clearHistory, readHistory } from '@/lib/history';

beforeEach(() => localStorage.clear());

describe('history', () => {
  it('starts empty', () => {
    expect(readHistory()).toEqual([]);
  });

  it('stores and reads back an entry', () => {
    addToHistory({ address: '1600 Pennsylvania Ave NW', slug: 'a-dqcjqcp' });
    expect(readHistory()).toEqual([{ address: '1600 Pennsylvania Ave NW', slug: 'a-dqcjqcp' }]);
  });

  it('puts the most recent entry first', () => {
    addToHistory({ address: 'First', slug: 'one-dqcjqcp' });
    addToHistory({ address: 'Second', slug: 'two-dqcjqcp' });
    expect(readHistory()[0].address).toBe('Second');
  });

  it('de-duplicates by slug and promotes the repeat to the front', () => {
    addToHistory({ address: 'First', slug: 'one-dqcjqcp' });
    addToHistory({ address: 'Second', slug: 'two-dqcjqcp' });
    addToHistory({ address: 'First', slug: 'one-dqcjqcp' });
    const history = readHistory();
    expect(history).toHaveLength(2);
    expect(history[0].slug).toBe('one-dqcjqcp');
  });

  it('caps the list at 8 entries', () => {
    for (let i = 0; i < 12; i += 1) {
      addToHistory({ address: `Address ${i}`, slug: `slug-${i}-dqcjqcp` });
    }
    expect(readHistory()).toHaveLength(8);
  });

  it('clears', () => {
    addToHistory({ address: 'First', slug: 'one-dqcjqcp' });
    clearHistory();
    expect(readHistory()).toEqual([]);
  });

  it('returns an empty list when storage holds malformed JSON', () => {
    localStorage.setItem('radius:history', 'not json');
    expect(readHistory()).toEqual([]);
  });

  it('returns an empty list when storage holds the wrong shape', () => {
    localStorage.setItem('radius:history', '{"nope":true}');
    expect(readHistory()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement lib/history.ts**

Run: `npm test -- history` → FAIL

```ts
export type HistoryEntry = { address: string; slug: string };

const KEY = 'radius:history';
const MAX_ENTRIES = 8;

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const { address, slug } = value as Record<string, unknown>;
  return typeof address === 'string' && typeof slug === 'string';
}

export function readHistory(): HistoryEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

export function addToHistory(entry: HistoryEntry): void {
  if (typeof localStorage === 'undefined') return;
  const next = [entry, ...readHistory().filter((e) => e.slug !== entry.slug)]
    .slice(0, MAX_ENTRIES);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearHistory(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}
```

Run: `npm test -- history` → PASS (8 tests)

- [ ] **Step 3: Write the failing RecentSearches test**

Create `tests/search/RecentSearches.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { RecentSearches } from '@/components/search/RecentSearches';
import { addToHistory } from '@/lib/history';

beforeEach(() => localStorage.clear());

describe('RecentSearches', () => {
  it('renders nothing when there is no history', () => {
    const { container } = render(<RecentSearches />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists stored addresses as links to their reports', () => {
    addToHistory({ address: '1600 Pennsylvania Ave NW', slug: 'penn-dqcjqcp' });
    render(<RecentSearches />);
    const link = screen.getByRole('link', { name: '1600 Pennsylvania Ave NW' });
    expect(link).toHaveAttribute('href', '/a/penn-dqcjqcp');
  });

  it('clears the list when Clear is pressed', async () => {
    addToHistory({ address: 'Somewhere', slug: 'x-dqcjqcp' });
    render(<RecentSearches />);
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.queryByText('Somewhere')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run to verify it fails, then implement RecentSearches.tsx**

Run: `npm test -- RecentSearches` → FAIL

```tsx
'use client';

import { useEffect, useState } from 'react';
import { clearHistory, readHistory, type HistoryEntry } from '@/lib/history';

export function RecentSearches() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  // Read after mount — localStorage does not exist during server rendering.
  useEffect(() => setEntries(readHistory()), []);

  if (entries.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-3">
          Recent
        </span>
        <button
          type="button"
          onClick={() => {
            clearHistory();
            setEntries([]);
          }}
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-3 underline"
        >
          Clear
        </button>
      </div>

      <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <a
              href={`/a/${entry.slug}`}
              className="block rounded-full border border-white/20 px-3 py-1.5 font-mono text-[11px] text-gray-3 no-underline"
            >
              {entry.address}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Run: `npm test -- RecentSearches` → PASS (3 tests)

- [ ] **Step 5: Record history on the report page**

Create `components/report/RecordVisit.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { addToHistory } from '@/lib/history';

/** Renders nothing — its only job is to record the visit client-side. */
export function RecordVisit({ address, slug }: { address: string; slug: string }) {
  useEffect(() => addToHistory({ address, slug }), [address, slug]);
  return null;
}
```

- [ ] **Step 6: Implement the map**

```bash
npm install mapbox-gl
npm install -D @types/mapbox-gl
```

Create `components/report/ReportMap.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Report } from '@/lib/report/types';

const WALK_RADIUS_M = 800;

/** GeoJSON circle approximating a walking radius. */
function circle(lat: number, lon: number, radiusM: number) {
  const points = 64;
  const coords: [number, number][] = [];
  const latRadius = radiusM / 110_574;
  const lonRadius = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));

  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * 2 * Math.PI;
    coords.push([lon + lonRadius * Math.cos(angle), lat + latRadius * Math.sin(angle)]);
  }

  return {
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
    properties: {},
  };
}

export function ReportMap({ report }: { report: Report }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN;
    if (!container.current || !token) return;

    mapboxgl.accessToken = token;
    const { lat, lon } = report.coordinates;

    const map = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [lon, lat],
      zoom: 14,
    });

    map.on('load', () => {
      map.addSource('walk-radius', { type: 'geojson', data: circle(lat, lon, WALK_RADIUS_M) });
      map.addLayer({
        id: 'walk-radius-fill',
        type: 'fill',
        source: 'walk-radius',
        paint: { 'fill-color': '#ff4f00', 'fill-opacity': 0.07 },
      });
      map.addLayer({
        id: 'walk-radius-line',
        type: 'line',
        source: 'walk-radius',
        paint: { 'line-color': '#ff4f00', 'line-width': 1.5, 'line-dasharray': [3, 2] },
      });

      for (const amenity of report.amenities.filter((a) => a.distanceM <= WALK_RADIUS_M)) {
        const dot = document.createElement('div');
        dot.style.cssText =
          'width:8px;height:8px;border-radius:50%;background:#4b5563;border:1.5px solid #fff';
        new mapboxgl.Marker(dot)
          .setLngLat([amenity.lon, amenity.lat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setText(amenity.name))
          .addTo(map);
      }

      const pin = document.createElement('div');
      pin.style.cssText =
        'width:20px;height:20px;border-radius:50%;background:#ff4f00;border:3px solid #fff;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.3)';
      new mapboxgl.Marker(pin).setLngLat([lon, lat]).addTo(map);
    });

    return () => map.remove();
  }, [report]);

  return (
    <div
      ref={container}
      aria-label={`Map of ${report.address} with nearby amenities`}
      role="img"
      className="h-[420px] w-full overflow-hidden rounded-card border border-gray-4 bg-gray-5"
    />
  );
}
```

- [ ] **Step 7: Wire the map, history recorder and recent list into the pages**

In `app/a/[slug]/page.tsx`, add the imports and place `<ReportMap report={report} />`
as the first child of the two-column `div`, with `<RecordVisit address={report.address} slug={slug} />`
directly after `<ReportHeader />`.

In `app/page.tsx`, add `import { RecentSearches } from '@/components/search/RecentSearches';`
and render `<RecentSearches />` directly below `<AddressSearch />`.

- [ ] **Step 8: Verify the full suite and the browser**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: PASS — whole suite green, clean production build.

Then `npm run dev`: search an address, confirm the map renders with the orange pin,
the dashed walk ring and grey amenity dots. Return to `/` and confirm the address now
appears under Recent.

- [ ] **Step 9: Commit**

```bash
git add lib/history.ts components tests/search app
git commit -m "feat: interactive map and local search history"
```

---

## Task 12: End-to-end tests, CI, deployment and README

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/search.spec.ts`, `tests/e2e/share.spec.ts`
- Create: `.github/workflows/ci.yml`, `README.md`
- Modify: `vitest.config.ts` (exclude `tests/e2e`), `package.json`

**Interfaces:**
- Consumes: the entire application
- Produces: a green CI pipeline and a live Vercel deployment

- [ ] **Step 1: Install and configure Playwright**

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- [ ] **Step 2: Exclude e2e specs from Vitest**

In `vitest.config.ts`, change the `test` block to add:

```ts
    exclude: ['tests/e2e/**', 'node_modules/**'],
```

- [ ] **Step 3: Write the e2e specs**

Create `tests/e2e/search.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('search an address and read its report', async ({ page }) => {
  await page.goto('/');

  const input = page.getByRole('combobox', { name: /address/i });
  await input.fill('1600 Pennsylvania Ave');

  const option = page.getByRole('option').first();
  await expect(option).toBeVisible();
  await option.click();

  await expect(page).toHaveURL(/\/a\/.+-[0-9a-z]{7}$/);
  await expect(page.getByText('Location score')).toBeVisible();

  // Four scores, each with an accessible meter.
  await expect(page.getByRole('meter')).toHaveCount(5); // 4 tiles + urban/suburban
});

test('keyboard-only users can complete the flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: /address/i }).fill('350 5th Ave New York');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/a\/.+/);
});

test('an invalid slug shows the not-found page', async ({ page }) => {
  await page.goto('/a/not-a-real-address');
  await expect(page.getByText(/address not found/i)).toBeVisible();
});
```

Create `tests/e2e/share.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

/**
 * The core brief requirement: a shared URL must render identically for
 * someone with no localStorage and no prior session.
 */
test('a shared report renders for a cold visitor', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: /address/i }).fill('1600 Pennsylvania Ave');
  await page.getByRole('option').first().click();
  await expect(page).toHaveURL(/\/a\/.+/);

  const sharedUrl = page.url();
  const heading = await page.getByRole('heading', { level: 1 }).textContent();
  const overall = await page.locator('main').getByText(/\/100/).textContent();

  // A brand-new context: no cookies, no localStorage, no history.
  const cold = await browser.newContext();
  const coldPage = await cold.newPage();
  await coldPage.goto(sharedUrl);

  await expect(coldPage.getByRole('heading', { level: 1 })).toHaveText(heading ?? '');
  await expect(coldPage.locator('main').getByText(/\/100/)).toHaveText(overall ?? '');

  await cold.close();
});

test('visited addresses appear in recent searches', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: /address/i }).fill('1600 Pennsylvania Ave');
  await page.getByRole('option').first().click();
  await expect(page).toHaveURL(/\/a\/.+/);

  await page.goto('/');
  await expect(page.getByText('Recent')).toBeVisible();
});
```

- [ ] **Step 4: Add the e2e script and run both suites**

Add to `package.json` scripts: `"test:e2e": "playwright test"`

Run: `npm test && npm run test:e2e`
Expected: unit tests PASS; e2e PASS — 5 tests.

E2E hits the live Mapbox and Overpass APIs, so the first run is slow. If Overpass
times out, re-run — the fallback endpoints and cache make the second run fast.

- [ ] **Step 5: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Unit tests
        run: npm test

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: End-to-end tests
        run: npm run test:e2e
        env:
          NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN: ${{ secrets.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN }}
          MAPBOX_SECRET_TOKEN: ${{ secrets.MAPBOX_SECRET_TOKEN }}
```

- [ ] **Step 6: Write the README**

Create `README.md`:

````markdown
# Radius

Type any US address, get a location report: walkability, transit, nearby businesses,
and how urban the area is — with every number traceable to its source.

**Live:** https://radius-insights.vercel.app

## Brief coverage

| Asked for | Delivered | How |
|---|---|---|
| Autocomplete the address | Address autocomplete | Mapbox Search Box, debounced, keyboard-navigable |
| Walking Score from nearby amenities | Walk Score | Own algorithm over OSM, distance-decayed, 2 km |
| Driving Score, greater radius | Drive Score | Same algorithm at 8 km, car-relevant weighting |
| Urban/Suburban Index | Urban ↔ Suburban Index | Density-derived 0–100 score plus a band label |
| Search History, stored locally | Search history | localStorage, re-runnable, clearable |
| Render Map with amenities | Interactive map | Mapbox GL JS, pin, walk ring, amenity markers |
| Shareable Page | `/a/[slug]` | Geohash in the URL, server-rendered — identical for a cold visitor |
| Nearby businesses | Nearby list | OSM Overpass, categorised, walk-time labelled |
| Other interesting features | Transit Score, 15-minute check | See below |

## How the scores work

Nothing here is an API handing back a number. Every score is computed from raw
OpenStreetMap geometry with a published formula.

**Walk Score** — for each of nine amenity categories, take the three nearest within
2 km, weight each by `exp(-5 · (d/2400)^5)` distance decay and by position, then
weight the categories against each other. Apply an intersection-density penalty so a
connected grid beats a cul-de-sac with the same raw amenity count.

**Drive Score** — the same algorithm at 8 km with car-relevant category weights and
no intersection penalty.

**Transit Score** — stops within 1.5 km, weighted by mode (rail beats bus) and route count.

**Urban ↔ Suburban Index** — 45% amenity density, 30% intersection density,
25% building footprint, mapped to a 0–100 score and one of four bands.

## Architecture

`lib/providers/` does I/O. `lib/scoring/` is pure — no fetch, no clock, no randomness,
enforced by a lint rule. `lib/report/` is the only place they meet. That boundary is
what makes the scoring engine testable in milliseconds without mocking the network.

## Data honesty

Real: addresses and coordinates (Mapbox), amenities and transit (OpenStreetMap),
map tiles (Mapbox). Computed by us with published formulas: all four scores and the
urban-suburban index. Nothing on the page is invented.

## Running locally

```bash
npm install
cp .env.local.example .env.local   # add your Mapbox tokens
npm run dev
```

## Testing

```bash
npm test         # unit — scoring engine, geo utilities, components
npm run test:e2e # Playwright — search flow and cold-visitor share
```

Unit tests run offline against four recorded Overpass fixtures (dense urban,
transit suburb, car-dependent suburb, rural).
````

- [ ] **Step 7: Push and open the PR**

```bash
git add -A
git commit -m "test: e2e coverage, CI pipeline and README"
git push -u origin phase-1-core-flow
gh pr create --title "Phase 1: core flow" \
  --body "Implements the full challenge brief. Autocomplete, walk/drive/transit/errand scores computed from OpenStreetMap, urban-suburban index, interactive map, local search history, and shareable server-rendered report pages. Pure scoring core with fixture-driven unit tests plus Playwright coverage of the search flow and cold-visitor share."
```

- [ ] **Step 8: Deploy to Vercel**

1. Import the GitHub repo at vercel.com.
2. Add both environment variables (`NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN`, `MAPBOX_SECRET_TOKEN`).
3. Add the same two as GitHub Actions repository secrets so CI passes.
4. At Mapbox, URL-restrict the public token to the assigned `*.vercel.app` domain.
5. Deploy, then confirm on the live URL: search works, the map renders, and a shared
   link opens correctly in a private window.

- [ ] **Step 9: Merge**

```bash
gh pr merge --squash
```

**Phase 1 gate:** a stranger can open the deployed URL, search any US address, see real
scores on a real map, and share a link that renders identically for someone who has
never visited. CI green.
