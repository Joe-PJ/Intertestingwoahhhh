# Day Walker

Every bar near you, sorted by when it closes.

Day Walker finds every bar, pub and beer garden in an area you choose (your
location or a typed place, within 1–25 km) using free OpenStreetMap data, and
organises them by closing time — so you can tell at a glance which places shut
at a normal hour and which ones keep going deep into the night.

> Status: early scaffold. The data layer (place lookup + bar search) is in
> place; the search screen and closing-time grouping are next.

## Run it

Requires Node 20+.

```sh
npm install
npm run dev        # start the app at http://localhost:5173
npm test           # run the test suite once (no real network calls)
npm run typecheck  # TypeScript strict check
npm run lint       # ESLint
npm run build      # type-check and build to dist/
npm run preview    # serve the built app
```

## How it works

- `src/data/geocode.ts` — turns a typed place into coordinates via
  [Nominatim](https://nominatim.org/).
- `src/data/overpass.ts` — fetches every `amenity=bar|pub|biergarten` within the
  radius from the [Overpass API](https://overpass-api.de/) and normalises each
  into a `Bar` record (name, address, raw `opening_hours`, distance).
- Both calls give up after 25 seconds and fail with a typed `DataError`
  (`network`, `timeout`, `rateLimited`, `notFound`, `badResponse`) that the UI
  turns into a plain-language message.
- `src/styles/tokens.css` — colour, spacing, type and motion tokens.

Bar data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL.
