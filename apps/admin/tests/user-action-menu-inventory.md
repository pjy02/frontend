# User action menu inventory

Recorded on 2026-09-03 from `main@0f6e679` before the user action menus are
migrated to `AdminActionMenu`.

## Current visual baseline

The current user list was checked against the deterministic Admin mock API at
`/#/dashboard/user`. Existing image references remain in
`tests/visual-baseline/pre-upstream-1.21-f067389/` for 1440 x 900 and 390 x 844.

Current behavior that the migration must improve:

- `ProTable` keeps the first row action visible and puts every remaining React
  action node into a fixed `w-52` Popover. For users this means the outer
  overflow contains the subscription icon button and another overflow icon
  button instead of labelled actions.
- Opening the row overflow therefore creates an icon-only outer panel with a
  large empty right side. Opening its nested overflow creates another menu,
  making the actual destination two or three popup levels away.
- The user row overflow menu has a fixed `w-48` width even when its labels are
  short, so the labels sit on the left with unused space on the right.
- Only the destructive action has an icon. Navigation and destructive actions
  therefore do not share a stable visual column.
- Five navigation destinations and deletion are presented as one flat group.
- The subscription overflow menu presents nine ungrouped actions and uses a
  different width rule from the parent user menu.
- At tablet and mobile widths the same floating menu is used; there is no
  touch-oriented, in-panel navigation for deeper action groups.

The live desktop check was performed in the in-app browser at approximately
1280 px wide with the mock user fixture. The outer row Popover visibly rendered
only the subscription and overflow icons inside a wide empty panel. The
existing 1440 x 900 and 390 x 844 user screenshots provide the page-level
desktop and mobile references; the next migration stage must add open-menu
captures after replacing the nested Popover chain.

## User row operations

| Operation | Trigger or destination | Parameters | Completion behavior |
| --- | --- | --- | --- |
| User profile | Centered workspace dialog | `getUserDetail({ id: userId })` | Saving refetches the detail and refreshes the user table |
| User subscriptions | Centered workspace dialog | `<UserSubscription userId={userId} />` | Subscription actions refresh the nested table |
| Order list | `/dashboard/order` | `search.user_id = String(userId)` | Route navigation |
| Login logs | `/dashboard/log/login` | `search.user_id = String(userId)` | Route navigation |
| Balance logs | `/dashboard/log/balance` | `search.user_id = String(userId)` | Route navigation |
| Commission logs | `/dashboard/log/commission` | `search.user_id = String(userId)` | Route navigation |
| Gift logs | `/dashboard/log/gift` | `search.user_id = String(userId)` | Route navigation |
| Delete user | `deleteUser({ id: userId })` after confirmation | `id = userId` | Success toast, then refresh the user table |

## User subscription row operations

| Operation | Trigger or destination | Parameters | Completion behavior |
| --- | --- | --- | --- |
| Copy subscription | Clipboard | First URL returned by `getUserSubscribeUrls(row.short, token)` | Success toast |
| Reset address | `postUserSubscribeResetToken` after confirmation | `user_subscribe_id = row.id` | Success toast, then refresh nested table |
| Pause or resume | `postUserSubscribeToggle` after confirmation | `user_subscribe_id = row.id` | Status-specific success toast, then refresh nested table |
| Online devices | Centered subscription detail workspace | `subscriptionId = row.id`, `userId` | No table mutation |
| Subscription logs | `/dashboard/log/subscribe` | `user_id`, `user_subscribe_id` | Route navigation |
| Reset logs | `/dashboard/log/reset-subscribe` | `user_id`, `user_subscribe_id` | Route navigation |
| Traffic statistics | `/dashboard/log/subscribe-traffic` | `user_id`, `user_subscribe_id` | Route navigation |
| Traffic details | `/dashboard/log/traffic-details` | `user_id`, `subscribe_id = row.subscribe_id` | Route navigation |
| Delete subscription | `deleteUserSubscribe` after confirmation | `user_subscribe_id = row.id` | Success toast, then refresh nested table |

## Migration invariants

- Do not change the destinations or search parameter names above.
- Keep all destructive and state-changing confirmations.
- Preserve the existing success messages and refresh targets.
- Keep profile, subscription, and subscription-detail workspaces centered.
- Restore focus to the overflow trigger when a menu or mobile action panel closes.
- Replace the ProTable action-node nesting for migrated rows; do not place an
  `AdminActionMenu` inside the existing ProTable overflow Popover.
- Do not change Admin authentication, permissions, API clients, or backend data.
