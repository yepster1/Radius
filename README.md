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
transit suburb, car-dependent suburb, rural). The e2e suite runs the real app but
sets `RADIUS_FIXTURE_MODE=1`, which swaps the Overpass provider for those same
fixtures — CI stays green on the health of this repository, not of a free
community API with no uptime guarantee.

### What testing against real places caught

Running the app against real addresses, rather than trusting the unit suite alone,
surfaced three bugs the fixtures couldn't:

- **Walk Score always showed 100.** Washington DC, Brookline MA and Plano TX all
  scored the maximum — a normalisation bug where a value that could range up to
  1.75 was scaled as though its range topped out at 1.
- **A Plano, TX subdivision was labelled "Rural."** The Urban ↔ Suburban Index
  normalised intersection density linearly against a cap of 150, which crushes
  the middle of a heavy-tailed distribution — real counts within 1 km ranged
  across 0, 21, 400 and 793.
- **Every report failed in production.** The Overpass provider sent no
  `User-Agent`; Overpass returns 406 without one. 118 unit tests still passed,
  because they exercise the parser against recorded fixtures and never touch
  the network.

All three are why this repo now has a browser-verification step in the plan and a
fixture mode for CI — the fixtures earn their keep by catching regressions, not by
standing in for ever running the real thing.
