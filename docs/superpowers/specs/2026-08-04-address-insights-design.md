# Address Insights — Design Spec

**Date:** 2026-08-04
**Status:** Approved (design review completed via Lavish, artifact at `.lavish/design-review.html`)
**Author:** Cary Small
**Context:** Take-home challenge for RentEngine (rentengine.io)

---

## 1. Goal

A web page where you type any US address, pick it from an autocomplete, and get a location report
that answers a property manager's question: **who should I market this unit to, and what should I
highlight?**

The submission is judged on being a live, working, professional product. It doubles as a portfolio
piece, so quality of finish matters as much as feature count.

**Deliverables:** public GitHub repo, live Vercel deployment, README with a brief-coverage matrix.

---

## 2. Framing decision

RentEngine sells leasing-automation software to **property managers filling vacancies** — not to
home buyers. The generic reading of "address insights" produces a neutral geo-dashboard that looks
like every other mapping-API demo.

We instead frame the report as a **leasing report**: the same underlying data, positioned to answer a
leasing decision. Renter-persona fit leads, flags are framed as viewing objections and selling
points, and the scores act as supporting evidence rather than the headline.

This was selected as "Direction A" over a neutral dashboard (B) and a scrollytelling narrative (C).

---

## 3. Brief coverage

Every line of the challenge maps to a feature. This matrix is reproduced in the README.

| Asked for (verbatim) | Delivered as | How |
|---|---|---|
| Autocomplete the address as you type | Address autocomplete | Mapbox Search Box, debounced, keyboard-navigable |
| **Walking Score** — your own simple metric based on nearby amenities/businesses | Walk Score | Own algorithm over OSM amenities, distance-decayed, 2 km radius |
| **Driving Score** — similar metric, but assume greater radius/amenity reach | Drive Score | **Same algorithm at 8 km** over a car-relevant amenity set |
| **Urban/Suburban Index** — a single number or label inferred from density/type of amenities | Urban ↔ Suburban Index | Density + type-mix → 0–100 score *and* a band label |
| **Search History** — recent lookups stored locally | Search history | `localStorage`, re-runnable, clearable |
| **Render Map** — address on a map with nearby amenities highlighted | Interactive map | Mapbox GL JS, pin + walk-radius ring + categorised markers |
| **Shareable Page** — send the URL, friend sees the same thing | Shareable page | `/a/[slug]`, server-rendered, identical for a cold visitor |
| Nearby businesses | Nearby businesses | OSM Overpass, categorised, distance-sorted, walk-time labelled |
| **Any other interesting features you might think of** | Differentiators tier | Renter Fit, flags, schools, demographics, noise proxy, 15-minute check, compare, AI listing angles, Transit Score |

> **Correction made during review:** Drive Score was initially specced as a Mapbox Isochrone call.
> The brief says "similar metric, but assume greater radius/amenity reach" — i.e. the *same*
> algorithm with a wider radius. Corrected. This is both closer to the brief and simpler.

---

## 4. Scope

### Tier 1 — Core (9)
Address autocomplete · Interactive map · Walk Score · Drive Score · Transit Score\* ·
Urban↔Suburban Index · Nearby businesses · Search history · Shareable page

\* Transit Score is not in the brief. It sits in this tier because it shares the scoring
infrastructure with Walk and Drive — near-zero marginal cost once those exist — and the report looks
incomplete without it. Counted as an extra in §3.

### Tier 2 — Differentiators (6)
Renter Fit personas · Green & red flags · Nearby schools · Neighborhood demographics ·
Noise & nuisance proxy · 15-minute check

### Tier 3 — Stretch (4)
OG image generation · Compare two addresses · AI listing angles · Methodology page

### Explicitly excluded
- **Sale price history** — no free US source exists; it could only be a fabricated number, and it is
  the single most likely thing a reviewer would spot-check against Zillow. Dropped.
- **Commute calculator** — cut for scope.
- **PDF export** — cut for scope.

---

## 5. Data sources and honesty policy

Policy: **real where possible, computed where we can defend the method, labelled where modelled.**
The real-vs-modelled table below ships as a `/methodology` page, linked from every derived number.

| Insight | Source | Status |
|---|---|---|
| Address & coordinates | Mapbox Search Box | Real |
| Map tiles | Mapbox GL JS | Real |
| Nearby businesses | OpenStreetMap Overpass | Real |
| Demographics | US Census ACS 5-year | Real |
| School name / level / distance | OpenStreetMap | Real |
| Walk / Drive / Transit / Errand Score | Own algorithm over OSM | Computed, formula published |
| Urban ↔ Suburban Index | Own algorithm over OSM | Computed, formula published |
| Renter Fit personas | Weighted blend of the above | Computed, weights published |
| Flags | Rule engine over the above | Computed, each flag cites its trigger |
| School ratings | No free API exists | **Modelled — labelled in-app** |
| AI listing angles | Claude Haiku 4.5, grounded in the computed signals | Generated, labelled as suggestions |

School ratings are the only modelled number on the page. That is defensible because the school's
name, level and distance beside it are all real.

**Provider choice.** The challenge says: *"Use any free/open geocoding and map APIs you prefer
(ex: free tier of Mapbox, Google Places API or LocationIQ)."* Mapbox is named as an example and is
the only one of the three providing autocomplete **and** map rendering from a single key with no
credit card required.

---

## 6. Scoring engine

All scoring functions are **pure** — they take a fetched dataset and return numbers. No I/O. This is
what makes them unit-testable, and the test suite is a deliverable in its own right.

### 6.1 Amenity categories

Nine categories, each defined by OSM tags:

| Category | OSM query |
|---|---|
| grocery | `shop=supermarket\|grocery\|convenience` |
| dining | `amenity=restaurant\|fast_food` |
| cafe | `amenity=cafe` |
| retail | `shop=clothes\|department_store\|mall\|books\|hardware` |
| errands | `amenity=pharmacy\|bank\|post_office`, `shop=hairdresser\|laundry` |
| parks | `leisure=park\|garden\|playground`, `landuse=recreation_ground` |
| schools | `amenity=school\|kindergarten\|college\|university` |
| culture | `amenity=library\|theatre\|cinema\|arts_centre`, `tourism=museum` |
| fitness | `leisure=fitness_centre\|sports_centre\|pitch` |

### 6.2 Walk Score

```
RADIUS        = 2000 m
decay(d)      = exp(-5 · (d / 2400)^5)
posWeight     = [1.0, 0.5, 0.25]          # up to 3 nearest per category

categoryScore(c) = Σ decay(dᵢ) · posWeight[i]   for the 3 nearest in c

catWeight = { grocery 3, dining 2, retail 2, errands 2,
              cafe 1.5, parks 1.5, schools 1, culture 1, fitness 1 }   # Σ = 15

raw       = Σ (categoryScore(c) · catWeight(c)) / Σ catWeight
WalkScore = clamp(round(raw · 100), 0, 100)
```

**An intersection-density penalty was specified here, then removed — measurement killed it.**
The intent was to distinguish a walkable grid from a cul-de-sac subdivision with the same raw
amenity count. Measured junctions per km² across the four reference locations:

| Location | Junctions/km² |
|---|---|
| Ferrisburgh VT (rural) | 0 |
| Plano TX (car-dependent suburb) | 238 |
| Washington DC (dense urban) | 439 |
| Brookline MA (transit suburb) | 507 |

No threshold separates walkable from car-dependent: the leafy transit suburb outranks downtown DC,
and the car-dependent suburb reaches more than half of DC's figure. OpenStreetMap splits a way
whenever a tag changes — a name or surface change mid-street creates a new way and a spurious
junction — so the proxy measures OSM bookkeeping as much as street topology. Intersection density
is a sound walkability metric in the literature (the EPA's Smart Location Database uses it), but it
needs true street-intersection counts rather than shared-node counts. Rather than ship a term that
does no work, it was removed. This page exists to make that kind of decision visible.

### 6.3 Drive Score

Identical algorithm with:
- `RADIUS = 8000 m`, `decay(d) = exp(-5 · (d / 9600)^5)`
- Car-relevant category weights: big-box retail and grocery up, cafe and dining down
- Additional categories: `amenity=fuel`, `amenity=hospital`
- No intersection penalty (irrelevant when driving)

### 6.4 Transit Score

```
stops within 1500 m, from OSM public_transport=stop_position | highway=bus_stop | railway=station
modeWeight = { rail 3, light_rail 2, tram 2, bus 1 }
K          = 4          # normalisation constant, calibrated so that a stop-rich
                        # urban core lands near 100 and a single bus stop near 15

TransitScore = clamp(round(K · Σ decay(dᵢ) · modeWeight(mode) · routeCount(stop)), 0, 100)
```

`K` is a tuning constant, not a derived value. It is fixed by calibrating against a small set of
reference addresses (dense urban, transit suburb, car-dependent suburb, rural) captured as test
fixtures, so a change to `K` shows up as a test diff rather than silently shifting every score.

### 6.5 Errand Score / 15-minute check

```
threshold = 1200 m   (≈15 min at 4.8 km/h)
ErrandScore = round(categoriesWithAtLeastOneWithin(threshold) / 9 · 100)
```
The UI shows *which* of the nine are and are not reachable — more useful than the number alone.

### 6.6 Urban ↔ Suburban Index

```
amenityDensity      = POIs within 1000 m
intersectionDensity = degree≥3 nodes within 1000 m
buildingDensity     = building ways within 500 m

norm(x, cap) = min(x / cap, 1)
index = round(100 · (0.45·norm(amenityDensity,150)
                   + 0.30·norm(intersectionDensity,120)
                   + 0.25·norm(buildingDensity,400)))
```

Band labels: `0–25 Rural · 26–50 Suburban · 51–75 Urban · 76–100 Dense Urban`.
The brief asks for "a single number **or** label" — we provide both.

### 6.7 Noise & nuisance proxy

Three independent sub-scores, each reported as Low / Moderate / High:

- **Road** — distance to nearest `highway=motorway|trunk|primary|secondary`, weighted by class
- **Rail** — distance to nearest `railway=rail`
- **Nightlife** — count of `amenity=bar|pub|nightclub` within 300 m

Presented as a proxy, not a decibel measurement. Labelled as such.

### 6.8 Renter Fit

Normalised signals in `[0,1]`: `walk`, `transit`, `errand`, `parkAccess`, `schoolAccess`,
`groceryAccess`, `cafeDensity`, `nightlife`, `fitnessAccess`, `healthcareAccess`, `cheapDining`,
`quietness` (inverse of noise), `urbanIndex`.

`drive` is deliberately **not** a persona signal. A high Drive Score is close to universal in
suburban US and therefore does not discriminate between personas; including it would flatten every
vector toward the same result.

Each persona is a weight vector summing to 1.0:

| Persona | Weights |
|---|---|
| Young Professional | walk .25 · transit .20 · nightlife .15 · cafeDensity .15 · urbanIndex .15 · fitnessAccess .10 |
| Growing Family | schoolAccess .28 · parkAccess .22 · quietness .20 · groceryAccess .15 · walk .08 · errand .07 |
| Student | transit .28 · cheapDining .22 · walk .20 · urbanIndex .15 · cafeDensity .10 · fitnessAccess .05 |
| Downsizer | quietness .25 · errand .22 · healthcareAccess .20 · walk .18 · parkAccess .15 |
| Remote Worker | cafeDensity .25 · walk .20 · parkAccess .20 · quietness .20 · fitnessAccess .15 |

`fit(persona) = round(100 · Σ weight(signal) · value(signal))`

**These weights are subjective and that is acknowledged openly.** They are published on
`/methodology`, and each persona card can expand to show which signals drove its score. Framed as a
defensible model, not a truth claim.

### 6.9 Flag rules

Each rule declares polarity, a predicate, a message template, and the evidence string it renders.

**Green:** grocery ≤ 500 m · park ≤ 400 m · ≥3 transit routes ≤ 800 m · ≥5 cafes ≤ 800 m ·
school ≤ 1000 m · WalkScore ≥ 80

**Red:** nearest grocery > 1500 m · no transit ≤ 1000 m · ≥8 bars ≤ 400 m ·
within 150 m of motorway/trunk/primary · within 100 m of active rail · no school ≤ 2000 m ·
WalkScore < 30

Every rendered flag shows its trigger, e.g.
`Whole Foods · 320 m · OSM shop=supermarket`. Flags without evidence are not rendered.

### 6.10 AI listing angles

Three suggested ad headlines generated from the address's strongest signals — the feature that most
directly echoes RentEngine's own "RentEngine AI" product.

- **Model:** `claude-haiku-4-5-20251001`. The task is short, structured and latency-sensitive; the
  cheapest capable model is the right call, and a take-home should not look like it burns budget
  carelessly.
- **Input:** the top three green flags, the winning persona, and the four scores — *not* raw POI
  lists. Keeps the prompt small and the output grounded in facts already on the page.
- **Output:** forced to a JSON schema of exactly three `{headline, rationale}` objects via tool use,
  so a malformed response is a retry rather than a broken card.
- **Server-side only**, behind a route handler. `ANTHROPIC_API_KEY` never reaches the browser.
- **Cached** with the report, keyed on the same geohash — one generation per address, not per view.
- **Degrades cleanly:** if the key is absent or the call fails, the card does not render and the rest
  of the report is unaffected. The deployed demo must work for a reviewer even if the key is
  exhausted.

This is the one feature that adds a paid dependency. Cost is negligible at demo volume (a few
hundred tokens per address), but the caching and the graceful-absence path are both required, not
optional.

### 6.11 Demographics

Census Geocoder (free, no key) resolves lat/lon → tract FIPS. ACS 5-year variables:

| Metric | Variable |
|---|---|
| Median household income | `B19013_001E` |
| Renter-occupied share | `B25003_003E / B25003_001E` |
| Median age | `B01002_001E` |
| Average household size | `B25010_001E` |

---

## 7. UI

**Design system.** RentEngine-*inspired*, not RentEngine-branded — the product carries its own name
and identity. Tokens lifted from their live Webflow CSS:

| Token | Value |
|---|---|
| Accent | `#ff4f00` |
| Neutrals | `#141516` `#252a31` `#4b5563` `#adb4c2` `#e5e7eb` `#f3f5f9` |
| Display | Archivo 600, `letter-spacing: -0.02em` |
| UI / labels / buttons | JetBrains Mono, `letter-spacing: 0.015em` |
| Button radius | `4.5px` · padding `16px 24px` |
| Card radius | `8px` |
| Spacing scale | 8 / 12 / 16 / 20 / 24 / 40 / 56 / 64 / 80 / 96 / 120 |

**Screens** (approved as mocked in `.lavish/design-review.html` §07):

1. **Search** — dark hero, single large input, autocomplete dropdown, recent-search chips below.
2. **Report** — `/a/[slug]`. Split layout: sticky map left, scrolling insight column right.
   Order: address header → overall Location Score → four score tiles → Renter Fit → flags →
   nearby businesses → Urban↔Suburban → demographics → noise → schools → listing angles.
   Listing angles sit last: they are the summarising "so what", and placing them last means the
   card's absence (no API key) leaves no gap in the middle of the report.
   Collapses to single column below 820 px with the map first.
3. **Compare** — `/compare?a=…&b=…`, two report columns side by side.
4. **Methodology** — the formulas above, rendered next to the live values for the address in view.

**Geography:** US only. Non-US lookups return an explicit "US addresses only" state, not a
half-empty report.

### 7.1 Share URL encoding

The brief requires that sending the URL shows the recipient the same thing. A slug alone cannot do
that — the server needs coordinates to rebuild the report, and it has no database.

**Format:** `/a/{kebab-address}-{geohash7}`

```
/a/1600-pennsylvania-ave-nw-washington-dc-dqcjqcp
```

- The kebab portion is human-readable and good for SEO, but is **not** parsed — it is decorative.
- The trailing **7-character geohash** is the payload: ±76 m precision, enough to reproduce an
  identical report, and short enough to keep the URL clean.
- The route decodes the geohash to lat/lon, fetches, and server-renders. No database, no shortener,
  no `localStorage` dependency — a cold visitor in a different browser gets a byte-identical page.
- If the geohash is missing or malformed, the route falls back to geocoding the kebab portion, and
  redirects to the canonical URL once resolved.

This choice is also what makes OG image generation possible: `/a/[slug]/opengraph-image` reads the
same geohash and renders the score card at the edge.

---

## 8. Non-functional requirements

- **Streaming.** A cold report must never look frozen. Route-level streaming via `loading.tsx`
  paints a skeleton immediately, and `Promise.allSettled` across providers means a slow transit or
  demographics query never delays the amenity-derived scores.
  *(Revised 2026-08-04: an earlier draft called for per-card Suspense boundaries. In Phase 1 all four
  scores derive from the same amenity fetch and therefore resolve together, so per-card boundaries
  would add complexity for no perceptible gain. They become worthwhile in Phase 2, when Census
  demographics arrive on an independent request.)*
- **Caching.** Edge cache keyed on coordinates rounded to ~4 decimal places. Overpass is slow
  (2–10 s) and aggressively rate-limited; repeat lookups of the same address must be instant.
- **Shareable pages are server-rendered.** A cold visitor with no `localStorage` sees exactly what
  the sender saw. This is an explicit brief requirement and drives the SSR decision.
- **Token hygiene.** The Mapbox GL JS token is public by necessity — URL-restrict it to the Vercel
  domain. Search Box and any server-side calls use a separate secret token, proxied through route
  handlers.
- **Low-data honesty.** Rural addresses genuinely score low. Detect sparse OSM coverage and say so
  explicitly rather than rendering a bare `12` that reads as a bug.
- **Accessibility.** Keyboard-navigable autocomplete with correct ARIA combobox semantics; score
  meters carry text equivalents; colour is never the sole carrier of meaning (flags use icon + text).
- **Responsive.** No horizontal overflow at any breakpoint.

---

## 9. Testing and CI

- **Vitest** over the scoring engine — pure functions, table-driven cases including empty-dataset,
  single-amenity, and dense-urban fixtures. Boundary tests on every clamp.
- **Playwright** over the search → report flow, and over a cold visit to a shared `/a/[slug]` URL
  (the requirement most likely to silently break).
- **GitHub Actions** running lint, typecheck, unit and e2e on every push. Badge in the README.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Overpass is slow and rate-limited | Edge caching, parallel category queries, streamed rendering |
| OSM coverage is uneven (rural) | Detect low density and label it, don't just show a low number |
| Mapbox GL token is public | URL-restrict it; separate secret token server-side |
| Persona weights are subjective | Publish them, show contributing signals, frame as a model |
| Census tract lookup can fail | Degrade gracefully — hide the demographics card, keep the report |
| Anthropic key absent/exhausted on the live demo | Listing-angles card simply does not render; report is unaffected |
| 19 features is a wide surface for one build | Implementation plan phases it: core flow first, deployed and working, before differentiators |

---

## 11. Decision log

| Date | Decision |
|---|---|
| 2026-08-04 | Company confirmed as RentEngine; style RentEngine-*inspired*, own branding |
| 2026-08-04 | Direction A (Leasing Report) over dashboard or scrollytelling |
| 2026-08-04 | Mapbox for geocoding + maps — named as an example in the challenge text |
| 2026-08-04 | Drive Score corrected from isochrone to same-algorithm-wider-radius, per brief wording |
| 2026-08-04 | Sale price history dropped — no free source, high credibility risk |
| 2026-08-04 | US only |
| 2026-08-04 | OG image generation reinstated — serves the core "shareable page" requirement |
| 2026-08-04 | Full test suite: Vitest + Playwright + GitHub Actions |
