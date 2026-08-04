# Radius

Type any US address, get a location report: walkability, transit, nearby businesses,
and how urban the area is — with every number traceable to its source.

**Live:** https://radius-address-insights.vercel.app/

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
2 km and weight each by `exp(-(d/800)^1.5)` distance decay and by position, then
weight the categories against each other. Each category's score is divided by its
own maximum before weighting, so the result genuinely occupies the 0–100 range.

**Drive Score** — the same algorithm at 8 km, with car-relevant category weights and
a decay scale of 3200. Every score sets `scale = radius / 2.5`, which puts an
amenity sitting at the radius edge at roughly 0.02 of full value.

**Transit Score** — stops within 1.5 km, weighted by mode (rail beats bus) and route count.

**Urban ↔ Suburban Index** — 45% amenity density, 30% intersection density,
25% building footprint, mapped to a 0–100 score and one of four bands. Amenity
density is normalised logarithmically rather than linearly, because it is
heavy-tailed: counts within 1 km across the four reference locations were 0, 21,
400 and 793. When the street-network lookup fails, the index renormalises over the
signals it actually has rather than reading missing data as zero.

**What was measured and removed.** Walk Score originally applied an
intersection-density penalty, so that a connected grid would beat a cul-de-sac with
the same amenity count. Measuring junctions per km² across the four reference
locations gave rural 0, car-dependent suburb 238, dense urban 439, transit suburb
507 — no threshold separates walkable from car-dependent, and the leafy suburb
outranks downtown DC. OpenStreetMap splits a way whenever a tag changes, so the
proxy measures OSM bookkeeping as much as street topology. The penalty was removed
rather than shipped as a term that does no work.

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
transit suburb, car-dependent suburb, rural). The e2e suite runs the real app but
sets `RADIUS_FIXTURE_MODE=1`, which swaps the Overpass provider for those same
fixtures — CI stays green on the health of this repository, not of a free
community API with no uptime guarantee.

### What testing against real places caught

Scoring formulas look plausible on synthetic inputs and fail on real ones. Testing
against four recorded real locations caught two bugs that hand-written test data
would have sailed past:

- **Walk Score always showed 100.** Washington DC, Brookline MA and Plano TX all
  scored the maximum — a normalisation bug where a value that could range up to
  1.75 was scaled as though its range topped out at 1. Synthetic amenities never
  produced enough categories at once to reveal it.
- **A Plano, TX subdivision was labelled "Rural."** The Urban ↔ Suburban Index
  normalised *amenity* density linearly against a cap of 150, which crushes the
  middle of a heavy-tailed distribution — real counts within 1 km were 0, 21, 400
  and 793. It now normalises logarithmically.

A third bug needed something the fixtures structurally cannot provide — actually
running the thing:

- **Every report failed in production.** The Overpass provider sent no
  `User-Agent`; Overpass answers those with 406. 118 unit tests passed regardless,
  because they exercise the parser against recorded fixtures and never open a
  socket.

Hence both halves of the strategy here: fixtures for deterministic, offline scoring
tests, and an end-to-end suite that drives the real application.
