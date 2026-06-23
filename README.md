# Site Evaluation Overview

Static executive-summary frontend built from the Dema fixture export.

## Run locally

From this folder:

```bash
python3 -m http.server 4173
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Data source

The app reads [`data/sites.json`](/Users/mariabeatrizberrocalolmos/Documents/Site%20Selection%20(using%20data)/data/sites.json), copied from the provided `frontend-fixture.all-sites.json`.

Default site: `Dema - Helis`

You can open a different site with a query parameter:

- `http://127.0.0.1:4173/?site=dema-gold-full`
- `http://127.0.0.1:4173/?site=<site-id>`
