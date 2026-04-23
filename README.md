# Restaurant Finder — Nice, France

A minimal, keyless web app to discover restaurants in Nice, France. Pure static HTML/CSS/JS — no build step, no server, no API keys.

## Scope (v1)

**In:**
- Browse restaurants in Nice, locked to the Nice bounding box (lat 43.65–43.75, lng 7.20–7.32).
- Filter by neighborhood, cuisine, and "open now".
- Detail view per restaurant (hours, address, phone, website).
- Bilingual FR/EN with a language toggle.
- Explicit error states for every external call.

**Out (explicitly, per guardrails):**
- No accounts, reviews, or reservations.
- No geolocation, favorites, photos, sharing, or multi-city support.
- No map view.

Any addition requires explicit approval.

## Architecture

- **Frontend**: Pure static HTML + vanilla JS + [Pico.css](https://picocss.com) (via CDN).
- **Data source**: [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) over OpenStreetMap. Queries are hardcoded to the Nice bounding box; responses are re-validated client-side before render.
- **Opening hours**: [opening_hours.js](https://github.com/opening-hours/opening_hours.js) library, loaded via CDN.
- **Hosting**: GitHub Pages (or any static host).
- **Typography**: Fraunces (editorial display) + Manrope (body), via Google Fonts.

```
User
 │
 ▼
index.html ──loads──► Pico.css CDN
                      opening_hours.js CDN
                      app.js + data/neighborhoods.js
 │
 ▼
app.js ──bbox-locked query──► Overpass API
 │                               │
 │◄──── validated JSON ───────────┘
 │
 ├── filter (neighborhood bbox / cuisine / opening_hours)
 ├── translate (FR/EN strings table)
 └── render (Pico-styled cards)
```

## File structure

```
restaurant-finder-nice/
├── index.html              # Entry: CDN links, mount points, dialog for detail
├── app.js                  # Query, validate, filter, render, i18n, events
├── styles.css              # Minimal Pico overrides, Nice-inspired palette
├── data/
│   └── neighborhoods.js    # Preset Nice neighborhood bboxes
├── .gitignore
└── README.md               # This file
```

## Setup

No installation required. Clone the repository:

```bash
git clone <this-repo>
cd restaurant-finder-nice
```

## Run locally

You can open `index.html` directly in a browser, but serving over HTTP avoids any CORS edge cases with the Overpass API:

```bash
# Option A — Python 3 (comes with most systems)
python3 -m http.server 8000

# Option B — Node (if installed)
npx serve .
```

Then visit http://localhost:8000.

## Deploy to GitHub Pages

1. Push the repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Source**, select branch `main` and folder `/` (root).
4. Save. Your app will be live at `https://<user>.github.io/<repo>/`.

Any other static host (Netlify, Cloudflare Pages, Vercel, etc.) also works — just drop these files at the root.

## Guardrails — how each is enforced

| # | Guardrail | Enforcement in code |
|---|---|---|
| 1 | Geographic lock | `NICE_BBOX` is a hardcoded `Object.freeze(...)` constant in `app.js`. Every Overpass query interpolates it. After parsing, `validateAndNormalize()` re-checks every result against the same bbox and drops anything outside. |
| 2 | Data integrity | `fetchOverpass()` throws `NetworkError` on non-OK HTTP and `ShapeError` if `elements` isn't an array. An empty normalized result set is also treated as a shape error. On any failure, `renderError()` shows an explicit message and a retry button — no silent fallback. |
| 3 | Input validation | All filter inputs are `<select>` (whitelisted neighborhood/cuisine) or `<input type="checkbox">` (boolean). No free-text field means no injection surface. All user-supplied strings that reach the DOM go through `escapeHtml()`. |
| 4 | No scope creep | Feature set is locked by the sections above. Any addition requires explicit approval. |
| 5 | Secrets & keys | None exist. Overpass is keyless. The `.env` line in the Definition of Done is satisfied vacuously; `.gitignore` still excludes `.env` by convention in case a future version needs it. |

## Known limitations / honest caveats

- **Neighborhood bboxes are approximations**, not Nice's official administrative boundaries. They're sufficient for filtering but won't perfectly match local intuition at the edges.
- **`opening_hours` coverage in OSM is uneven.** Many restaurants have no hours tagged; those get an "Hours unknown" badge. The "Open now" filter only keeps restaurants with parseable hours that are open at query time — so enabling it will visibly shrink the list.
- **Overpass API rate limits apply.** The app uses two public endpoints with automatic failover, but bursty refresh during development may still get rate-limited. Wait a minute and retry.
- **Amenity coverage reflects OSM completeness.** Some small restaurants may not be mapped. This is a data quality constraint of the underlying source, not an app bug.
- **Restaurants without a `name` tag are skipped** (OSM occasionally has tagged but unnamed POIs). This is intentional — a nameless card is worse than no card.

## Next-version candidates (v2, requires approval)

- Map view with marker clustering.
- Nominatim-based free-text place search.
- Geolocation with a Nice bbox check.
- Local favorites via `localStorage`.
- More filters: outdoor seating, vegetarian, wheelchair access, takeaway.

## License

Code: MIT (suggested). Data: © OpenStreetMap contributors, under ODbL.
