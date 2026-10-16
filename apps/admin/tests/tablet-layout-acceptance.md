# Admin tablet layouts

## Scope

This change builds on the dashboard preferences, saved table views, form
protection and freshness work. API contracts and User Web styles are unchanged.

| Width | Admin list behavior |
| --- | --- |
| Below 768px | Existing summary cards and expandable details |
| 768–1279px | Dedicated tablet layouts, chosen by content |
| 1280px and above | Existing full desktop tables |

The shared ProTable only enables these rules inside the Admin preference provider.
`mobile={false}` remains an explicit table-only opt-out. Sidebar and action-menu
breakpoints are unchanged; this is not a global redefinition of `useIsMobile`.

- Servers, nodes and users remain full-width lists. At 680px of usable content
  width, each record's information groups sit side by side.
- Product lists remain compact single-column lists because their existing drag
  strategy is vertical. All sortable tables deliberately ignore `tablet="grid"`.
- Orders, coupons and payments opt into two columns only when the table itself
  has at least 680px of content width. A wider Sidebar can therefore return them
  to one column without relying on device detection.
- Other tables, including logs and tickets, use compact single-column rows and
  retain their existing secondary-information disclosures.
- Empty and error feedback spans the entire grid. Loading placeholders follow
  the same column layout as loaded records.
- Card links and timestamps wrap within their fields. Action buttons keep 44px
  tablet touch targets, without enlarging the visual checkbox itself.
- Tablet workspaces use a 16px viewport margin, fixed header/footer and an
  internally scrolling body. Server basics and product/user forms avoid early
  three/four-column layouts; settings sections use their actual container width.
- Sortable cards let DndKit own transforms instead of competing with Motion.
  Keyboard auto-scroll respects reduced motion. Normal card motion is unchanged.

## Checks

- Admin and User TypeScript checks.
- Admin production build (existing eval/large-chunk warnings remain).
- Targeted table, saved-view, URL-state, log, form and drag tests: 27 passed.
- Biome and `git diff --check`.

Optional browser runner: `scripts/check-admin-tablet-browser.mjs`. Run against
local Admin production preview on 43002 and mock API on 43124. It refuses remote
origins; sorting requests only write to the local mock. Set `PLAYWRIGHT_MODULE`
when Playwright is installed outside this repository, and optionally set
`PLAYWRIGHT_BROWSER_CHANNEL`, `ACCEPTANCE_WIDTHS`, `ACCEPTANCE_ARTIFACT_DIR`.

The default matrix is 390/430/768/834/1024/1194/1280/1440px, English/light/normal
motion and Chinese/dark/reduced motion. Each case checks nine list routes and
the server creation workspace. Tablet cases additionally check keyboard sort
persistence, Sidebar changes, floating batch actions and loading/empty/error
feedback. Screenshots and DOM geometry checks complement one another.

Final local run on 2026-10-16: **16/16 browser cases passed**. The nine routes are
servers, nodes, users, products, orders, coupons, payments, tickets and subscription
logs. Tablet tests also assert that card field text does not overflow its column
and that visual checkboxes retain their normal compact size.

The browser checks use a new page load per route to avoid sampling the previous
route during SPA navigation. Keyboard sort waits for DndKit's announced drop
target after auto-scroll, rather than immediately dropping during scroll motion.

## Pre-push regression (2026-10-16)

- Admin: 228 tests / 51 files; shared UI: 39 tests / 8 files;
  User: 81 tests / 17 files, all passed.
- Functions/development proxy: 8 passed; Swagger documentation contract: 1 passed.
- Admin and User production builds and TypeScript checks passed. Existing eval
  and large-chunk warnings remain; API clients and User page sources are unchanged.
- Biome: 270 checked files passed after normalizing the four changed locale JSON
  files. Locale symmetry is also included in the complete Admin test suite.
- No conflict markers, unmerged files or whitespace errors were found.
- Tests were run per workspace with Node/Bun rather than the Windows Turbo wrapper.
  Git hook configuration is unchanged; duplicate hook execution is disabled only
  in the process that creates the already-validated delivery commit.

This is local browser/mock acceptance, not live-backend integration or physical
iPad/Android performance certification. No claim is made about those environments.
