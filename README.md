# AdminKit — Admin Dashboard (HTML + Tailwind CDN + CSS + Vanilla JS)

## Structure
- `public/assets/css`: `theme.css` (design tokens, light/dark, brand/density/radius/font), `app.css` (base styles), `components.css` (shell, sidebar, header, cards, tables, forms).
- `public/assets/js`: `theme.js` (loads in `<head>`; Light/Dark/System, brand, persistence, CONFIG), `sidebar.js` (collapse, accordion, floating submenu, drawer, active state), `header.js` (dropdowns, Ctrl/Cmd+K, theme shortcut, table filter), `appearance.js`, `dashboard.js` (SVG chart). `navigation.js` and `app.js` are placeholders.
- `src/components` and `src/pages`: editable source markup. `dist/`: complete pages, each embedding header, sidebar, page content and footer (marked with `<!-- X:start/end -->`).

## Updating shared components
Edit `src/components/*.html`, then paste the new markup between the matching marker comments in every `dist/*.html`. Nothing is fetched at runtime.

## Run
Open the project in VS Code and use Live Server on `dist/index.html`, or serve the folder with any static HTTP server (for example `python3 -m http.server` from `Admin-Dashboard/`, then open `/dist/`).

## External resources
Tailwind Play CDN (`cdn.tailwindcss.com`, pinned 3.4.17). It is for development/prototyping only; replace it with a compiled stylesheet in production (e.g. via Laravel's asset pipeline).

## Laravel later
`dist/index.html` → `dashboard.blade.php`, `sidebar.html` → `partials/sidebar.blade.php`, `header.html` → `partials/header.blade.php`, `footer.html` → `partials/footer.blade.php`, `appearance.html` → `settings/appearance.blade.php`. Move `public/assets` into Laravel's `public/`.

## Navigation
Collapsed desktop sidebar: hovering an icon opens cascading menus built from the nested sidebar HTML (any depth). Timings live in the CONFIG object at the top of sidebar.js (closeDelay, hoverDelay, tipDelay).

## App Alert
Vanilla port of the React AppAlert: `AppAlert.fire(options)` returns a Promise with `{ isConfirmed, isDenied, isDismissed, value, dismiss }`. Files: `app-alert.css`, `app-alert.js`, `app-alert-demo.js` (preview card only). It is loaded on every page and initialised from `app.js`; call it from any module, e.g. `const r = await AppAlert.fire({ icon: "warning", title: "Delete user?", showCancelButton: true })`. The App Alert Preview card sits directly below the Calendar section on `projects.html`.

## Toast notifications
Global `toast` API (`toast-notification.js`, `toast-notification.css`); demo and usage examples on `toaster-notification.html` (`toast-demo.js`). Defaults and per-toast overrides: `toast.configure({ theme, position, duration, maxVisible, pauseOnHover, showProgressBar, showCloseButton, preventDuplicates })`. Themes: `light`, `dark`, or `auto` (follows the dashboard). Toasts sit at z-index 9999, above AppAlert (1000).

Laravel Blade (the API is plain JS, no routes are hard-coded): load `{{ asset('assets/js/toast-notification.js') }}` once in the layout, then flash server messages with `@if (session('success')) <script>document.addEventListener('DOMContentLoaded', () => toast.success(@json(session('success'))));</script> @endif`, or call `toast.update(id, ...)` inside your `fetch` / `$.ajax` callbacks (see the usage examples page).

## Components: Drawer, Forms, Modal, Table
Ported from the React archive `Components.rar` to vanilla JS. Pages: `drawer.html`, `forms.html`, `modal.html`, `table.html` (each has overview, live preview, copyable examples and API docs; the overview separates original functionality from dashboard additions).
- `AppDrawer.open({ side, title, body, footer })`, `AppModal.open({ title, size, body, footer })`: `drawer.js`, `modal.js`, `drawer.css`, `modal.css`.
- `AppForms` (`forms.js`, `forms.css`): `validate`, `values`, `setErrors` (Laravel 422 shape), `reset`, custom `rules`; forms with `data-ff-form` emit `appform:valid` / `appform:invalid`.
- `AppTable.create(host, config)` (`table.js`, `table.css`): the primary reusable table (search, sort, filters, pagination, selection, bulk actions, column menu/resize/reorder, export, print, CSV import, server-side mode with `onQuery`). It replaced the old placeholder filter table on the Users page.
- AppAlert and the toast system are unchanged and independent; AppAlert (z-index 1000) and toasts (9999) sit above drawers and modals (300).

## Sidebar, shortcuts, tooltips, scrollbars, layout
- Sidebar scroll position and open branches are kept in `sessionStorage` (`admin.sidebar.scroll`, `admin.sidebar.open`) and restored on every standalone page and on refresh; the active item is scrolled into view only if it is outside the list.
- **Ctrl+B** (Cmd+B on Mac) toggles the sidebar (drawer on mobile); **Ctrl+\** works too as a fallback because some browsers reserve Ctrl+B (for example Firefox's bookmarks sidebar) in a few situations. Both are ignored while typing in inputs and while a modal, drawer or AppAlert is open. The toggle buttons expose `aria-expanded`, `aria-label` and `aria-keyshortcuts` and stay in sync with the shortcut.
- One tooltip system (`tooltip.js`, `data-tooltip`, tokens `--tt-bg/--tt-fg/--tt-border` in `theme.css`): same surface, text and border tokens as the flyout menus (light in Light mode, dark in Dark mode, updates live), z-index `--z-tooltip` (10000). Native `title` tooltips were removed.
- Scrollbars are themed by `--sbar-*` tokens (thin, hover state, Firefox fallback). With the sidebar collapsed, `--maxw` grows (1760px default, 1920px wide) and dashboard grids use container queries.

## Table component v2 (Users redesign)
One engine (`table.js`), five configurations in `table-demo.js` (Users, Products, Orders, Roles & permissions, simulated server-side). No sample data or backend code lives in the engine.
- New: `variant: "compact"` (reference design), `title` + `showCount` ("Users (87)"), typed per-column filters (`filter: "text" | {type:"select"|"number"|"date"}`), `column.type`, `rowActionsVariant: "compact"` (icon buttons with tooltips), `bulkBarMode`, `expandable` + `AppTable.details()`, `setState("normal|loading|error|empty")`, `reload()`, `clearFilters()`, `onQuery` extras (`sortField`, `sortDirection`, `columnFilters`).
- Changed: the selection checkbox now comes before the expand control; sort indicators are icons; the empty state reads "No records available" (and "No results" + Clear filters when filters match nothing).
- Everything else is backward compatible: configs written for the previous version keep working (default variant, `columnSearch`, `rowActionsVariant: "icons" | "menu"`, text `expandable`, legacy `filters[]`, existing `onQuery` fields).
- Replace-style bulk bar, page size in the toolbar and chevron pager are part of the compact variant; the default variant keeps the old layout.

## Preferences
All appearance settings live in one object (`AdminPrefs` in theme.js, localStorage key `admin.prefs.v2`). Edit its CONFIG to change defaults.

## Notes
All data is demo data; logout, forms and actions are frontend demonstrations only.
