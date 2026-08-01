# Project site

This folder is the project's GitHub Pages site
(<https://emmcarbe.github.io/torchio/>). It contains:

- **`press/`**: the in-browser press, a single self-contained page built by
  `node tools/build-browser.js` from the same engine modules the CLI uses.
  `pleiades.json` beside it is the compact ancient-world gazetteer the
  "Locate ancient places" button fetches on demand (built by
  `node tools/build-pleiades-browser.js`, data from
  [Pleiades](https://pleiades.stoa.org/), CC BY).
- `index.html`, the two SVG lockups.

The demonstration editions pressed from real scholarly materials live in
their own repository, [emmcarbe/torchio-demos](https://github.com/emmcarbe/torchio-demos),
so that materials with limited rights stay apart from the engine; their
sources, licences and credits are recorded there.

Maps in pressed sites use [Leaflet](https://leafletjs.com/) (BSD-2, bundled)
and tiles © OpenStreetMap contributors (ODbL), loaded from the OSM servers
when a map page is viewed; geographic lookups use data derived from
[GeoNames](https://www.geonames.org/) (CC BY 4.0) and
[Pleiades](https://pleiades.stoa.org/) (CC BY); map coastlines from
[Natural Earth](https://www.naturalearthdata.com/) (public domain).

Torchio's code remains MIT; the licences above concern data and contents.
