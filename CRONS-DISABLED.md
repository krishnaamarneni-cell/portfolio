# Scheduled jobs — disabled 2026-11-05

Vercel paused **every deployment on the account** (HTTP 402) for exceeding the
Hobby **Fluid Active CPU** allowance: **6h 52m used against 4h per 30 days**.
Nothing else was close — CDN requests 280K/1M, invocations 273K/1M, data
transfer 7.52 GB/100 GB.

The GitHub Actions workflows in this repo do no work themselves. Each one is a
`curl` to `krishnaamarneni.com`, so **every tick spent Vercel CPU, not GitHub's**.
That is why they are the first thing to switch off.

## What was turned off

### GitHub Actions (`.github/workflows/*.yml`)

The `schedule:` blocks are commented out. `workflow_dispatch` is untouched, so
every job can still be run by hand from the Actions tab.

| Workflow | Schedule | Ticks/month | Endpoint |
|---|---|---|---|
| `auto-reply-cron.yml` | `*/5 13-23 * * *` | ~3,960 | `/api/cron/auto-reply` |
| `job-finder-cron.yml` | `*/15 * * * *` | ~2,880 | `/api/cron/job-finder` |
| `social-cron.yml` | `*/15 * * * *` | ~2,880 | `/api/cron/social-drip` |
| `agents-cron.yml` | `0 14,16,18,20 * * *` | ~120 | `/api/cron/agents` |
| `warm-outreach-cron.yml` | `0 15 * * 1-5` | ~22 | `/api/cron/warm-outreach` |

~9,900 function calls a month, and the two 15-minute jobs each run with a
`--max-time 120` budget — `job-finder` deliberately works until a 32s internal
deadline on every tick, crawling and scoring ~75 employer boards. Crawling is
HTML parsing, which is pure CPU, and CPU is exactly the meter that was blown.

### Vercel crons (`vercel.json`)

Removed. They were only ~90 calls a month and are not what caused this, but
they were turned off with the rest. To restore, put this back:

```json
{
  "crons": [
    { "path": "/api/cron/morning-briefing", "schedule": "0 11 * * *" },
    { "path": "/api/cron/sunday-reflection", "schedule": "0 23 * * 0" },
    { "path": "/api/cron/social-queue", "schedule": "0 12 * * *" }
  ]
}
```

## Before switching anything back on

Turning these off does **not** lift the current pause — that CPU is already
spent. The account unpauses on its own around **2026-12-05**, or immediately on
a Pro upgrade. These stay off so it does not trip again the day it returns.

The budget to stay inside is **4 hours of active CPU per 30 days** — about
8 minutes a day across every project on the account, not just this one.

Re-enable one job at a time and watch the usage page, cheapest first:

1. `warm-outreach` and `agents` — low frequency, safe.
2. `social-drip` — consider dropping to hourly (`0 * * * *`), 24× less.
3. `auto-reply` — 5 minutes is the aggressive part. 15 minutes still answers
   within the hour and costs a third.
4. `job-finder` — the expensive one. Either move the crawl off Vercel (do the
   fetching and parsing inside the GitHub Action, which is free, and POST the
   results to the API), or run it hourly instead of every 15 minutes.

Usage page: https://vercel.com/nyamaths195-9644s-projects/~/usage
