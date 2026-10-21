# Frontend architecture and redesign notes

The frontend is a Vite + React SPA with plain CSS. There is no Tailwind, no
component library, and no global stylesheet beyond a reset.

## Layers

| Layer | Location | Rule |
| --- | --- | --- |
| Tokens | `src/styles/tokens.css` | The only file allowed to contain a raw colour, radius, spacing, type, motion or z-index value. |
| Base | `src/styles/base.css` | Reset, element defaults, the focus ring, and the `prefers-reduced-motion` rule. No global component classes. |
| Components | `src/components/ui/<Name>/` | One implementation per control. `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`, `FormField`, `Badge`, `SeverityBadge`, `Notice`, `Toast`, `Dialog`, `DropdownMenu`, `Tooltip`, `Tabs`, `Popover`, `DataTable`, `Skeleton`, `EmptyState`, `ErrorState`, `StatBlock`, `CopyableId`, `SearchInput`, `SegmentedControl`, `NumberInput`, `Spinner`, `StatusDot`. |
| Shells | `src/components/shell/` | `MarketingShell`, `AuthShell`, `AppShell`, `PublicReportShell`. |
| Product components | `src/components/{Operator,Field,Admin,Analytics,map,auth,system,session,Shared}/` | Feature components, each with a co-located CSS module. |
| Domain helpers | `src/lib/` | `routes.js` (the route and role table), `roles.js` (role display names), `cells/` (cell labels, bands, ordering), `taskStatus.js`, `chartTheme.js`, `mapTheme.js`, `useAuthNotice.js`, `useInactivityGuard.js`. |

Variants and sizes are expressed with data attributes (`data-variant`,
`data-size`) and a `cn()` helper. There is no variant library.

Icons come from `lucide-react` as named imports. There is no emoji anywhere in
the product, and no hand-drawn SVG for anything that is an icon.

## Enforcement

| Rule | Enforced by |
| --- | --- |
| No raw colour outside `tokens.css` | `npm run lint:style` (`scripts/check-style.cjs`) |
| Every `var(--x)` resolves to a defined token | `npm run lint:style` |
| `!important` only inside a `prefers-reduced-motion` block | `npm run lint:style` |
| No hex colour, gradient, `backdrop-filter` or `text-shadow` | `npm run lint:css` (Stylelint) |
| One level-one heading per route, no skipped levels | `src/pages/headings.dom.test.jsx` |
| No serious or critical axe violation on any route | `src/a11y.test.jsx` |

`npm run lint` runs both linters. `npm test` runs the whole suite.

## Routes

`src/lib/routes.js` holds one table. The route guards, the navigation bar and
the page titles are all derived from it, so a link can never point at a page
the current role cannot open.

| Route | Page | Shell | Roles | Nav | Title / indexing |
| --- | --- | --- | --- | --- | --- |
| `/` | `Landing.jsx` | MarketingShell | public | — | indexable, canonical `/` |
| `/login` | `SignIn.jsx` | AuthShell | public | — | indexable, canonical `/login` |
| `/signup` | `SignUp.jsx` | AuthShell | public | — | indexable, canonical `/signup` |
| `/citizen-report` | `CitizenReport.jsx` | PublicReportShell | public | — | indexable, canonical `/citizen-report` |
| `/operator` | `OperatorConsole.jsx` | AppShell | Operator | Operator | noindex |
| `/field` | `FieldTasks.jsx` | AppShell | Field crew | Field crew | noindex |
| `/field/tasks/:id` | `FieldTaskDetail.jsx` | AppShell | Field crew | — | noindex |
| `/admin` | `Admin.jsx` | AppShell | Administrator | Administration | noindex |
| `/analytics` | `Analytics.jsx` | AppShell | Operator, Administrator | Analytics | noindex |
| `/unauthorized` | `Unauthorized.jsx` | SystemPage | public | — | noindex |
| `*` | `NotFound.jsx` | SystemPage | public | — | noindex |

Unauthenticated visits to a guarded route redirect to
`/login?returnTo=<path>`; `returnTo` is honoured after sign-in and validated
by `safeReturnTo()` (same-origin relative paths only). A role that may not
open a route is sent to `/unauthorized`.

## Terminology

- "Cell" is the primary term everywhere: an H3 hexagon with a composite risk
  score. There are no invented locality names.
- The cell label is produced by exactly one function, `getCellLabel()` in
  `src/lib/cells/index.js`. It returns a real locality when the data provides
  one and otherwise falls back to the shortened H3 id. It is the seam where a
  real ward or locality lookup is plugged in later.
- Role display names come from one map, `ROLE_LABELS` in `src/lib/roles.js`:
  Operator, Field crew, Administrator. The raw values (`OPERATOR`,
  `FIELD_CREW`, `ADMINISTRATOR`) stay internal.
- "Cell details" is the panel name; "incident" is a task raised from a cell.

## Risk bands

The server classifies every cell and stores the result on the cell as
`riskLevel` (`CRITICAL`, `HIGH`, `MODERATE`, `LOW`), using the critical
threshold the municipality has configured. The UI reads that classification
first (`cellBandFor()` in `src/lib/cells/index.js`) and only falls back to a
numeric comparison when a payload carries no risk level, so the console, the
cell list, the map and the analytics charts can never disagree with the
engine.

The caution band is fixed at 5 by the risk engine
(`backend/src/engine/risk.js`). The critical threshold defaults to 7
(`backend/src/models/ConfigWeights.js`).

> **Known backend inconsistency.** `backend/src/services/spatialAnalysis.js`
> still classifies a neighbourhood aggregate as `HIGH` from 4, while
> `backend/src/engine/risk.js` and `backend/src/routes/admin.js` use 5. This
> affects the neighbourhood roll-up only, not the per-cell band the UI shows.
> Fixing it is backend work and is out of scope for the frontend.

## Follow-ups that need backend endpoints first

These routes are deliberately **not** built, because the API has no support for
them and a dead screen is worse than no screen. They need backend endpoints
before any UI is written.

| Route | Needs |
| --- | --- |
| `/forgot-password` | A password-reset request endpoint and a token that survives an email round trip. |
| `/reset-password` | A password-reset confirmation endpoint that accepts the emailed token. |
| `/verify` | An account-verification endpoint and a verification token. |

## Other open items

- The data pipeline still derives sub-scores per batch rather than per cell.
  Each cell should get its own weather interpolation and its own per-stop
  transit attribution, so two cells that currently receive the same score
  separate. This is backend work and is tracked separately, with its own
  branch and diff.
- Until that lands, a demonstration that needs varied data should use a
  clearly labelled simulation mode, off by default, and never mixed into live
  data.
