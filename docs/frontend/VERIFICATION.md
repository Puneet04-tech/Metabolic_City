# Redesign verification checklist

Recorded at the end of phase 7. See the 11 November 2026 intelligence check
at the end of this file for the current data-quality panel. Every route was checked against the design
rules, the accessibility rules and the content rules.

## Route by route

| Route | Shell | Headings | axe (serious/critical) | Lighthouse (perf / a11y / bp / seo) | Content checks |
| --- | --- | --- | --- | --- | --- |
| `/` | MarketingShell | one `h1` | pass | 91 / 100 / 100 / 100 | no AI, ML, "intelligent", "<1s" or "24/7" claims; no statistics; the formula and the real thresholds are stated |
| `/login` | AuthShell | one `h1` | pass | 90 / 100 / 100 / 100 | no raw query text in the notice; links underlined |
| `/signup` | AuthShell | one `h1` | pass | 90 / 100 / 100 / 100 | password rules shown up front |
| `/citizen-report` | PublicReportShell | one `h1` | pass | 90 / 100 / 100 / 100 | no account, no app bar, no sign-out; position only on request; loading, success, error and offline states |
| `/operator` | AppShell | `h1` in the app bar, `h2` for the cell list and the cell detail | pass | n/a (needs a session) | "Cell details"; band comes from the server's `riskLevel`; ties keep a stable order by H3 id |
| `/field` | AppShell | `h1` in the app bar | pass | n/a (needs a session) | status stepper, "Pending sync" from the outbox, bottom navigation |
| `/field/tasks/:id` | AppShell | `h1` on the page, the app bar is a `span` | pass | n/a (needs a session) | server statuses unchanged; resolve has a confirm dialog; the file picker is keyboard reachable |
| `/analytics` | AppShell | `h1` in the app bar, `h2` for the page, `h3` for the charts and tables | pass | n/a (needs a session) | no raw server enums; the empty charts have empty states |
| `/admin` | AppShell | `h1` in the app bar, `h2` per panel | pass | n/a (needs a session) | weights, thresholds, users, QR codes and the audit trail |
| `/unauthorized` | SystemPage | one `h1` | pass | 93 / 100 / 100 / 66 | `noindex`; the low SEO score is Lighthouse penalising the deliberate `noindex` |
| `*` (404) | SystemPage | one `h1` | pass | 93 / 100 / 100 / 66 | `noindex`; the low SEO score is Lighthouse penalising the deliberate `noindex` |

The authenticated routes were measured with axe in jsdom rather than with
Lighthouse, because Lighthouse needs a live session. The axe suite covers
every route including the four that were previously uncovered.

## Design rules

| Rule | Result |
| --- | --- |
| No raw colour outside `src/styles/tokens.css` | pass, checked by `npm run lint:style` |
| Every `var(--x)` resolves to a defined token | pass, 28 dead references fixed |
| No emoji or pictograph anywhere | pass |
| No gradient | pass |
| No `backdrop-filter` | pass |
| No `text-shadow` | pass |
| No `filter: blur()` or `drop-shadow()` | pass |
| No glow or neon `box-shadow` | pass, 7 removed |
| No `!important` outside the reduced-motion block | pass |
| No `border` wider than 1px | pass |
| No Tailwind | pass |
| No legacy `styles.css` | deleted |

## The one implementation of each control

`src/components/ui/` holds the only implementation of each control. The
remaining raw elements are the ones a generic button cannot express:

| Place | Why it is not a `ui/Button` |
| --- | --- |
| `ui/Checkbox`, `ui/Switch`, `ui/Textarea`, `ui/Select` | The primitives themselves. |
| `ui/Notice`, `ui/Toast`, `ui/DataTable`, `ui/CopyableId`, `ui/SearchInput` | The primitives themselves. |
| `Operator/CellDetail.jsx` | The tooltip trigger is a button so the tooltip is reachable by keyboard; it is a Radix `TooltipTrigger asChild`, not a `ui/Button`. |
| `Field/TaskCard.jsx` | The card is a button, because the whole card is the target. |
| `Field/MobileNav.jsx`, `shell/AppShell.jsx` | Navigation items styled as navigation, not as buttons. |
| `Auth/AuthForm.jsx` | A link-styled button that focuses the error summary. |
| `Operator/SummaryStrip.jsx` | Band filter toggles with `aria-pressed` and a colour swatch. |

## Accessibility

| Check | Result |
| --- | --- |
| axe, serious and critical, on all 11 routes | pass |
| Exactly one `h1` per route, no skipped levels | pass, guarded by `src/pages/headings.dom.test.jsx` |
| Every form control has a visible label | pass |
| Icon-only controls have an accessible name | pass |
| Links in running text are underlined, not signalled by colour alone | pass |
| The role radio group shows a visible focus ring | pass |
| The file picker is reachable by keyboard | pass |
| The score tooltip is reachable by keyboard | pass |
| `prefers-reduced-motion` neutralises the animations | pass |

## Tooling

| Command | What it does |
| --- | --- |
| `npm run lint` | Stylelint plus the style check. |
| `npm test` | The whole suite: 140 tests across 12 files. |
| `npm run build` | The production build. |

## Still to do

- The data pipeline still derives sub-scores per batch rather than per cell, so
  two cells can receive the same score. This is backend work, on its own
  branch, with its own diff.
- `backend/src/services/spatialAnalysis.js` classifies a neighbourhood
  aggregate as `HIGH` from 4 while the risk engine uses 5. It only affects the
  neighbourhood roll-up, not the per-cell band the UI shows.
- `/forgot-password`, `/reset-password` and `/verify` are not built. They need
  backend endpoints first.
- The empty `frontend/src/components/Citizen/` directory could not be removed on
  this machine because the filesystem denied access. It is untracked and
  empty, so it does not affect the build or a checkout.


## Intelligence and data quality check — 11 November 2026

Checked against the running local stack (Node 5000, Python 8001, Vite 5173):

| Check | Result |
| --- | --- |
| `/operator` cell detail renders computed-score disclaimer, confidence and sub-scores | pass |
| Selected-cell provenance shows weather interpolation method, nearest-station distance and weather age | pass |
| Cell update age is shown separately from weather age | pass |
| `GET /api/v1/intelligence/data-quality` returns source counts, freshness and snapshot time | pass, HTTP 200 |
| `/v1/data-quality` returns the same overall provenance | pass, HTTP 200 |
| `/v1/cells/{h3}/intelligence` includes `dataQuality` | pass, HTTP 200 |
| Synthetic and simulated flags are shown, not hidden | pass; both 0 in the current data |
| Panel refreshes every 30 seconds | pass; snapshot advanced 4:36:17 PM → 4:37:47 PM → 4:41:00 PM |
| Weather is labelled interpolated, `exact: false` | pass; 100/100 events interpolated, average nearest 2.132 km |
| Agents and playbooks are labelled advisory/project-authored | pass; `isOfficial: false` |

The current data has 260 telemetry events (100 weather, 100 terrain/GIS, 60
TomTom traffic), 0 synthetic and 0 simulated rows. The transit adapter is
dormant with 0 GTFS rows. These are local dev checks, not a production
benchmark.
