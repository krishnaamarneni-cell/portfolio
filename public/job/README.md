# Indian Job Market Visualizer

An interactive treemap of the Indian labour market — the Indian counterpart to
[Andrej Karpathy's US Job Market Visualizer](https://karpathy.ai/jobs/).

Each tile is an occupation; its **area** = number of workers; its **colour** = the
layer you select. You can also type a prompt and have every occupation scored 0–100,
then recolour the map by that score.

## Run

It's a static site — no build step.

```
cd indian-job-market-visualizer
python -m http.server 8123
# open http://localhost:8123
```

## Layers

- **Occupation group** — NCO-2015 major groups
- **Median pay** — median monthly earnings (₹)
- **Education** — typical education level
- **Job formality** — share with a written/formal contract (India's informal-sector lens)
- **AI exposure** — precomputed generative-AI exposure
- **Custom prompt** — score occupations live by any question

## Reading the data

- **Stats strip** (below the controls) summarises the active layer; cards wrap so
  nothing is hidden.
- **Treemap** is the big-picture view; tiny tiles may be unlabelled.
- **All occupations table** (bottom of the page) lists every occupation with all
  values — sortable (click a header) and paginated (10 / 25 / 50 / All rows). It
  respects the active dataset and any tier/histogram filter, so nothing is cut off.

## Datasets

Toggle between two datasets in the top-left of the control bar.

### 1. Real · ILOSTAT 2025 (`real_data.js`) — default
**Employment is real**, pulled programmatically (no login) from the ILOSTAT API —
indicator `EMP_TEMP_SEX_OCU_NB` (employment by sex & occupation), India, ISCO-08
1-digit (9 major groups), reference year **2025**, total **476.6M** workers.

Refresh it any time:
```
python refresh_ilostat.py     # prints latest ILOSTAT employment by occupation
```

> **Honest caveats:** ILOSTAT has *no* per-occupation wage series for India, so the
> `wage` values here are estimates anchored to the PLFS regular-wage average.
> `education` is derived from each ISCO group's skill level; `formality` and `ai`
> are estimates. Only **employment** is real — the UI badges this.

### 2. Illustrative · 40 occupations (`data.js`)
**Rough estimates** grounded in PLFS 2023-24 / Economic Survey aggregates — finer
(40 NCO-style occupations) but not official. Total ≈ 606M.

Both share one schema, mirroring NCO-2015:
```
{ name, group, employment (millions), wage (₹/mo), education (1–5), formality (0–1), ai (0–1) }
```

## Phase B — full PLFS microdata (real wages, ~40 occupations)

ILOSTAT only reaches 9 groups and has no Indian wages. For real Indian data at
finer granularity **with** wages/education/contract, use the **PLFS unit-level
microdata** — this needs a free registration that **you** must do (the portal
requires a login; it can't be automated):

1. Go to [microdata.gov.in → PLFS catalog](https://microdata.gov.in/NADA/index.php/catalog/PLFS).
2. Pick the latest round (e.g. *PLFS 2023-24*), click **GET MICRODATA**, register, submit the request.
3. Download the `.zip` → `CHHV1.txt` (household) + `CPERV1.txt` (person), **fixed-width
   text**, plus a **Data Layout** doc with byte positions for every field.
4. Fields this app needs: NCO-2015 occupation code (3-digit), usual-status activity,
   earnings (regular wage + self-employed), general education, job-contract type.
5. Drop the zip in this folder — a parser using the layout doc then aggregates it
   into the same `{name, group, employment, wage, education, formality, ai}` shape.

### Other open sources (no login)
- **NCO-2015** — [DGE / Ministry of Labour](https://www.ncs.gov.in/Documents/National%20Classification%20of%20Occupations%20_Vol%20I-%202015.pdf) (occupation taxonomy, ~3,600 codes)
- **Census 2011 B-series** — [censusindia.gov.in](https://censusindia.gov.in/census.website/data/census-tables) (granular but dated, NCO-2004)
- **PLFS Annual Report 2023-24** — [PDF](https://www.mospi.gov.in/sites/default/files/publication_reports/AnnualReport_PLFS2023-24L2.pdf) (1-digit NCO tables incl. wages)

## Plugging in a real LLM

`app.js` ships with a transparent client-side heuristic (`scoreByHeuristic`) so the
prompt feature works offline. To use a real model, replace the body of `runPrompt()`
with a call to your API that returns `{ [occupationName]: 0..100 }`. Karpathy's
original precomputes these scores once per prompt — you can do the same and cache them.
