# AR Performance Baseline (pre-optimization)

Captured during implementation of the performance plan. Re-measure after deploy.

## API (unauthenticated probe)

| Endpoint | Result |
|----------|--------|
| `GET /api/fm/accounting/accounts-receivable` | 401 Unauthorized in ~89ms (auth required) |

Authenticated measurement: use DevTools Network on `/fm/accounting/accounts-receivable` and record TTFB, total time, response KB, and `rows.length`.

## Code analysis (pre-change)

| Area | Finding |
|------|---------|
| Main BFF | 1× full `sales_invoice` scan + sequential collections fetch + 10+ Directus lookups |
| Invoice details | Full `units` + `discount_type` table scan per open |
| Client bundle | Static `jspdf`, `xlsx`, `framer-motion`, 3× Recharts on critical path |
| Client runtime | Duplicate search filters; DrilldownChart re-aggregates on every render |
| Caching | None (`cache: 'no-store'`, `force-dynamic`) |

## Target success criteria

- Initial API &lt; 3s (authenticated)
- Initial JS interactive &lt; 2s
- Invoice detail open &lt; 1s
