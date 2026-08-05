# Radius

Type any US address, get a location report: walkability, transit, nearby businesses,
and how urban the area is — with every number traceable to its source.

**Live:** https://radius-address-insights.vercel.app/

## FOR RentEngine

Honestly, all the code was written by AI. However I was heavily involved in planning, architecture, debugging, QA/testing and UX/UI.

### How I approached the problem

A developer in the modern age needs to be wore than a code monkey. We need to think about the end user, and the product for day one (or minute one in this case). My customer in this case is actually you, rent engine, so I made a system that I thought you could use, and targeted it at your client base. Giving a property manager information about a potential listing before listing it. I then worked on UI/UX, what I would want this to look like (and matched the styling to your webpage as best I could). I then narrowed down  scope as much as I could (I had a lot of ideas). You can see the results of the planning in the .lavish folder (for design and architecture), and the docs/superpowers for the implementation plan

**It is slower than I would have wanted it to be, this is to do with the downstream API (overpass), I improved this a bit, and we have caching, but I didn't have time to properly debug this.**

## Design Decisions 

This entire project is a design desicion 😅

but a non exhaustive list of important decisions are:
- narrowing down what features I wanted to build after deciding on the target. Things like renter fit ended up being dropped but I would have liked that.
- data sources. Mapbox for geocoding and tiles. openstreetmap overpass for everything else. 
- the look (matching rentEngine styling, trying to make it look like something you would have on your system)
- scoring methodology (we compute all the scoring in house and don't try and grab bit's of data from other API. scores were scaled logarithmically as things got further away, which is what I would want in a real system (the difference between 1km and 2km seems bigger than 7 km and 8km))
- Search history is localStorage-only as it wouldn't make sense to be shared
- Fixtures are recorded from real places, not hand-written

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
the same amenity count. Measuring junctions within a 1 km radius across the four
reference locations gave rural 0, car-dependent suburb 238, dense urban 439, transit
suburb 507 — no threshold separates walkable from car-dependent, and the leafy suburb
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

Unit tests run offline against five recorded Overpass fixtures (dense urban,
transit suburb, car-dependent suburb, rural, and dense-urban street geometry). The
e2e suite runs the real app but
sets `RADIUS_FIXTURE_MODE=1`, which swaps the Overpass provider for those same
fixtures — CI stays green on the health of this repository, not of a free
community API with no uptime guarantee.
