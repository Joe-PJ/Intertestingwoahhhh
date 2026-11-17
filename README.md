# Day Walker

Every bar near you, sorted by when it closes.

Day Walker finds every bar, pub and beer garden in an area you choose (your
location or a typed place, within 1–25 km) using free OpenStreetMap data, and
organises them by closing time — so you can tell at a glance which places shut
at a normal hour and which ones keep going deep into the night.

> Status: working app. Search by location or typed place, and see tonight's bars
> split into Day Walkers and Night Crawlers by closing time.

## Run it

Requires Node 20.19 or newer on the 20.x line, or Node 22.12 or newer — what
Vite 8 needs (`^20.19.0 || >=22.12.0`). CI uses Node 22.

```sh
npm install
npm run dev        # start the app at http://localhost:5173
npm test           # run the test suite once (no real network calls)
npm run typecheck  # TypeScript strict check
npm run lint       # ESLint
npm run build      # type-check and build to dist/
npm run preview    # serve the built app
```

## Automatic checks

`.github/workflows/ci.yml` runs on GitHub's servers for every push to any
branch, every pull request, and on demand from the **Actions** tab. It installs
dependencies with `npm ci`, then runs `npm run typecheck`, `npm run lint`,
`npm test` and `npm run build` — the same commands listed above. If any step
fails, the commit or pull request is marked as failed. The workflow only checks
the code; it does not publish or deploy anything.

The build uses relative asset paths (`base: './'` in `vite.config.ts`), so the
same `dist/` works at a site root or under any sub-path.

## How it works

- `src/data/geocode.ts` — turns a typed place into coordinates via
  [Nominatim](https://nominatim.org/).
- `src/data/overpass.ts` — fetches every `amenity=bar|pub|biergarten` within the
  radius from the [Overpass API](https://overpass-api.de/) and normalises each
  into a `Bar` record (name, address, raw `opening_hours`, distance).
- Both calls give up after 25 seconds and fail with a typed `DataError`
  (`network`, `timeout`, `rateLimited`, `notFound`, `badResponse`) that the UI
  turns into a plain-language message.
- `src/domain/closing.ts` — reads each bar's `opening_hours` and works out when
  it closes tonight, then sorts bars into four groups, shown in this order:
  - **Day Walkers** — close before midnight (sun icon).
  - **Night Crawlers** — close between midnight and 06:00, or stay open all
    night (moon icon). The midnight split lives in one constant,
    `NIGHT_SPLIT_HOUR`.
  - **Closed tonight** — listed hours, but not open tonight.
  - **Hours unknown** — no hours on the map, or hours we can't read.

## The screen

- `src/ui/SearchPanel.tsx` — "Use my location" button, a typed-place field and
  a radius choice (1, 2, 5, 10 or 25 km; 5 km to start). If location is off,
  it says so and moves you to the typed-place field.
- `src/ui/useBarSearch.ts` — runs one search at a time (a new search cancels
  the old one), tracks loading / results / error, and remembers the last
  search so "Try again" repeats it exactly. Widening the radius reuses the
  place already found rather than looking it up again.
- `src/ui/ResultGroups.tsx` and `src/ui/BarCard.tsx` — the four groups, each
  with an icon, a text heading and a count; every bar shows its closing time
  (e.g. "2:00 AM" or "Open all night"), distance, address when known and the
  raw hours under "Hours".
- `src/ui/VampireLogo.tsx` — the original vampire logo, also used as
  `public/favicon.svg`.
- Empty and error states always say what happened in plain words and offer a
  next step (search wider, type another place, or try again).
- `src/styles/tokens.css` — colour, spacing, type and motion tokens.

Bar data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL.
