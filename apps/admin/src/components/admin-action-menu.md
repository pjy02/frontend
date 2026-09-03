# Admin action menu

`AdminActionMenu` is the only row-action hierarchy for migrated Admin tables.
Do not place it inside the legacy `ProTable` action Popover; the table and page
must agree on a single overflow owner.

## Desktop visual contract

- Content width is intrinsic between 160 px and 220 px.
- Content uses a 10 px radius and 6 px padding.
- Each item is at least 36 px high and uses three columns:
  20 px icon, truncating label, and trailing state or submenu arrow.
- Labels stay on one line. A Tooltip is mounted only when the rendered label
  is actually truncated; pass `tooltip={false}` to suppress it.
- `AdminActionMenuDangerItem` inserts its own separator by default. Use
  `separated={false}` only for adjacent destructive items that already share a
  destructive section.
- Light and dark surfaces have separate border blends and elevation values.

## Motion contract

- Root menu enter: 160 ms, 4 px toward the trigger, opacity 0 to 1, scale 0.98
  to 1.
- Submenu enter: 160 ms, 6 px from its parent edge with the same fade and
  scale, so the hierarchy retains spatial continuity.
- Menu exit: 120 ms with a smaller fade and scale than enter.
- Mobile levels: 180 ms fade-through. Forward navigation enters from the right
  while the previous level leaves to the left; Back reverses both directions.
- The mobile level container uses layout animation so different item counts do
  not cause an abrupt height jump.
- The root `MotionProvider` and the global reduced-motion rules remove
  translation and scale when the user requests reduced motion.

## Usage

```tsx
<AdminActionMenu
  backLabel={t("back", "Back")}
  title={t("moreActions", "More actions")}
  trigger={<Button size="icon-sm" variant="ghost">...</Button>}
>
  <AdminActionMenuItem icon={<Receipt />}>...</AdminActionMenuItem>
  <AdminActionMenuSub icon={<ScrollText />} label={t("logs", "Logs")}>
    <AdminActionMenuItem>...</AdminActionMenuItem>
  </AdminActionMenuSub>
  <AdminActionMenuDangerItem icon={<Trash2 />} onAction={openConfirmation}>
    ...
  </AdminActionMenuDangerItem>
</AdminActionMenu>
```

Use `asChild` for a router `Link`. Use `loading` and `disabled` on the menu item
instead of replacing it, which preserves its position and accessible state.
