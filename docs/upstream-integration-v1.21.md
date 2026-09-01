# Upstream v1.21 integration ledger

This ledger tracks the integration of `perfect-panel/frontend` into the
customized PPanel frontend without regressing the current Admin experience.

## Baseline

- Local baseline: `main@f067389ac3b1c92b331464130fb7ee6cad25a9ec`
- Safety branch: `codex/backup-pre-upstream-1.21-f067389`
- Integration branch: `codex/upstream-1.21-integration`
- Upstream remote: `https://github.com/perfect-panel/frontend.git`
- Upstream target: `upstream/main@d32c45683c5b2b87225274e9308397655996aacb`
- Upstream release: `1.21.0-dev.1`
- Merge base: `87f85306461ed46d5d24ecaed0505838f7069aea`
- Visual baseline: `apps/admin/tests/visual-baseline/pre-upstream-1.21-f067389`

## Confirmed product decisions

- Preserve the current Admin layout, theme, motion system, Dashboard,
  responsive ProTable, mobile cards, dialogs, and full-screen mobile workspaces.
- Remove plugin management completely, following upstream. Do not retain its
  page, route, navigation, locale namespace, service, types, tests, or mocks.
- Remove the project-support/sponsor module. It is advertising content and must
  not be restored on either the Dashboard or payment pages.
- Keep User Web styling unchanged. Functional and copy fixes are allowed.
- Keep backend request paths and payload contracts aligned with the latest
  upstream Swagger. No backend changes are part of this integration.

## Integration rules

| Area | Resolution rule |
| --- | --- |
| Admin shell, theme, motion, responsive layout | Keep local implementation |
| Dashboard and traffic ranking | Keep local implementation; port data fixes only |
| ProTable | Keep local UI; port missing URL/filter behavior |
| Complex Admin forms | Keep local dialog/workspace pattern; do not restore large sheets |
| Swagger and OpenAPI templates | Adopt upstream final contract |
| Generated API clients | Migrate to upstream aggregated clients |
| User OAuth and Pages proxy | Adopt upstream behavior and tests |
| Routes, navigation, and locales | Union merge, then remove plugin and sponsor entries |
| Generated route tree | Regenerate after source routes are final |
| Lockfile | Regenerate from the final dependency graph |

## Upstream feature matrix

Status values: `pending`, `in-progress`, `verified`, `not-applicable`.

| Upstream change | Scope | Local landing rule | Status |
| --- | --- | --- | --- |
| `cdde298` quota reset log label | Admin log locales | Add type `234` in both locales | pending |
| `317c460` reset-subscription warning | User Dashboard | Port behavior and copy without restyling User Web | pending |
| `2df835d`, `db7b9dd`, `b3facb3` Swagger sync | API docs | Already patch-equivalent locally; verify in final Swagger | pending |
| `61a1b1d` API architecture | Shared services | Adopt templates and aggregated generated clients | pending |
| `61a1b1d` commission withdrawals | Admin | Rebuild in the current Admin table/dialog/mobile system | pending |
| `61a1b1d` plugin removal | Admin/shared services | Delete all plugin code and references | pending |
| `3ff807f` trusted client IP | Pages function | Adopt upstream proxy behavior and tests | pending |
| `f5f362e` OAuth callbacks | User/Pages function | Adopt upstream logic and tests | pending |
| `6c202953` loading performance | Both apps/shared UI | Port route locales, icons, Markdown, Lottie, and safe query caching | pending |
| `117ad816`, `411e72b`, `db65b6f` Swagger sync | API docs | Adopt final upstream documents | pending |
| `6a0bb81`, `9565d73` API regeneration | Shared services | Regenerate once from the final contract | pending |
| `e444a13` Admin user/log workflows | Admin/ProTable | Port URL filters and workflow behavior into local UI | pending |
| `9f6a3ca` OAuth invite codes | User/shared types | Adopt session handoff and request field | pending |
| `e79fa78` server node configuration | Admin servers | Port inherit/override logic into local workspace UI | pending |
| `41dd6c7` sponsor restoration | Admin Dashboard/payment | Do not restore; remove sponsor module completely | not-applicable |
| `c25838e` commission naming | Admin | Use final commission-management naming | pending |
| `6ce8a8a` request risk metadata | Admin logs/shared types | Integrate into the unified local log experience | pending |
| `4e6d5ff` timezone offset | Admin header | Adopt final calculation and tests | pending |
| `9e51a57` order creation log | Admin logs/API | Add through the unified local log component | pending |

Release-only and branch-merge commits are covered by the final merge commit and
are not implemented as separate features. Duplicate timezone and order-log
patches are applied only once from the final upstream tree.

## Protected Admin surfaces

These surfaces require visual comparison against the baseline after each major
integration group:

- Dashboard desktop/mobile, light/dark, English/Chinese
- Sidebar, Header, page container, and route content transitions
- Server and node tables, mobile cards, sorting, and action menus
- User table, detail/editor dialogs, subscriptions, and URL restoration
- ProTable filters, pagination, bulk action bar, loading continuity, and motion
- Dialogs, menus, tooltips, focus restoration, and reduced motion

## Required verification gates

- TypeScript, Biome, locale-key parity, schema tests, interaction tests, and
  `git diff --check`
- Admin, User, Docs, and Pages-function builds/tests
- OpenAPI regeneration produces only reviewed output
- No remaining plugin or sponsor references
- Reality `client-fingerprint` remains available and serializes correctly
- OAuth callback/invite flows and trusted-client-IP proxy tests pass
- Commission management, order log, request-risk metadata, and server override
  workflows are operable
- Real-browser regression at 390, 430, 768, 1024, 1280, and 1440 px in both
  themes and both locales
