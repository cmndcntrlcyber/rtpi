# RTPI Design System — MASTER

Source of truth for tokens, primitives, and patterns. Page-level overrides live in `design-system/pages/<page>.md` and take precedence over this file when present.

**Target**: v3.0.0 — see [`../v3.0.0-ui-ux-optimization.md`](../v3.0.0-ui-ux-optimization.md) for phasing.

---

## Pattern

Real-time red-team operations console. Data-dense panels, status colors prominent, one primary CTA per screen, secondary actions visually subordinate. Optimized for analyst workflows, not marketing/conversion.

---

## Theme

Three theme classes. Component code never branches on theme — only tokens.

| Class | When | Status |
|-------|------|--------|
| (none) | Light | Default until phase 8 |
| `.dark` | Dark | Toggled from header |
| `.graphite` | Graphite (semi-dark, operator default) | Behind `FF_UI_V3_GRAPHITE`, future default |

All themes share token names; only HSL values differ.

---

## Color Tokens

### Existing (shadcn baseline — unchanged)

`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`.

### Added in v3.0

| Token | Light | Dark | Graphite | Purpose |
|-------|-------|------|----------|---------|
| `--success` | `142 76% 36%` | `142 70% 45%` | `142 70% 45%` | Operational green |
| `--success-foreground` | `0 0% 100%` | `144 80% 10%` | `144 80% 10%` | On-success text |
| `--warning` | `38 92% 50%` | `38 92% 55%` | `38 92% 55%` | Caution amber |
| `--warning-foreground` | `20 14% 10%` | `20 14% 4%` | `20 14% 4%` | On-warning text |
| `--info` | `199 89% 48%` | `199 89% 55%` | `199 89% 55%` | Neutral info blue |
| `--info-foreground` | `0 0% 100%` | `200 80% 10%` | `200 80% 10%` | On-info text |
| `--sev-critical` | `0 84% 50%` | `0 84% 60%` | `0 84% 60%` | Severity: critical |
| `--sev-high` | `16 95% 48%` | `16 95% 55%` | `16 95% 55%` | Severity: high |
| `--sev-medium` | `38 92% 45%` | `38 92% 50%` | `38 92% 50%` | Severity: medium |
| `--sev-low` | `199 89% 42%` | `199 89% 48%` | `199 89% 48%` | Severity: low |
| `--sev-info` | `215 16% 47%` | `215 16% 55%` | `215 16% 55%` | Severity: informational |

**Rule**: pages must not use `text-red-500` / `bg-amber-400` etc. Use `text-destructive`, `text-success`, `text-warning`, `text-info`, or the `<SeverityBadge>` primitive.

**Pairing**: every fg/bg pair listed above is verified at ≥ 4.5:1 (WCAG AA). Re-run contrast checks when adjusting any value.

---

## Typography

- **Headings**: `Fira Sans`
- **Body**: `Fira Sans`
- **Mono / data**: `Fira Code` (tabular numerals for IPs, ports, CVE IDs, durations)

### Scale

| Token | Size | Use |
|-------|------|-----|
| `text-xs` | 12px | Badges, kbd, meta only — not body |
| `text-sm` | 14px | Body (operator console floor) |
| `text-base` | 16px | Body on mobile inputs (prevents iOS auto-zoom) |
| `text-lg` | 18px | Section subheads |
| `text-xl` | 20px | Card titles |
| `text-2xl` | 24px | Page subtitle |
| `text-3xl` | 30px | Page title (default `PageHeader`) |
| `text-4xl` | 36px | Marketing/login only |

### Weight

- Headings: `font-semibold` (600) for h1/h2; `font-medium` (500) for h3+.
- Body: `font-normal` (400).
- Labels/captions: `font-medium` (500).

### Number rendering

```css
.tabular-nums { font-variant-numeric: tabular-nums; }
```

Apply to all numeric columns in tables and any monospaced count.

---

## Spacing

8pt rhythm. Allowed steps: `1, 2, 3, 4, 6, 8, 10, 12, 16` (Tailwind units).

| Context | Class |
|---------|-------|
| Page padding | `px-4 sm:px-6 lg:px-8` |
| Section gap | `space-y-6` |
| Card padding | `p-4 sm:p-6` |
| Card stack gap | `gap-4` |
| Inline element gap | `gap-2` |

No arbitrary values like `px-3` / `gap-7` / `mt-5`.

---

## Radius

| Use | Radius |
|-----|--------|
| Cards, buttons, inputs | `var(--radius)` = `0.5rem` |
| Badges | `0.125rem` (2px) |
| Pills (filters), status dots | `9999px` |
| Dialog/popover | `var(--radius)` |

---

## Elevation

Three tiers only.

| Tier | Class | Use |
|------|-------|-----|
| 0 | `shadow-none` | In-flow surfaces |
| 1 | `shadow-sm` | Cards, panels |
| 3 | `shadow-lg` | Overlays: dialog, popover, command palette |

`shadow-md`, `shadow-xl`, `shadow-2xl` are out of scope. If found in pages during conversion, replace with the nearest allowed tier.

---

## Motion

- **Duration**: 150–200ms for micro-interactions; up to 300ms for layout reveals; never above 400ms.
- **Easing**: `ease-out` on enter, `ease-in` on exit.
- **Property**: transition `transition-colors`, `transition-opacity`, `transition-transform` — never `transition-all`.
- **Reduced motion**: globally honored via `@media (prefers-reduced-motion: reduce)` override in `index.css` (animations + transitions clamped to 1ms).
- **Decorative motion**: not allowed. Animation must convey state change (open/close, focus, success).

---

## Layout Shell

- **Header height**: `--header-h: 4rem` (64px). Main content uses `pt-[var(--header-h)]`.
- **Sidebar widths**: `w-64` expanded, `w-20` collapsed. Switches at `lg:` (1024px).
- **Main container**: `min-h-dvh` (mobile viewport units fix).
- **Skip link**: first focusable element in `MainLayout`, target `#main`.
- **Z-index scale**: `0 / 10 / 20 / 40 / 100 / 1000`. Sidebar `30`, Header `40`, Toast/Dialog `100+`, Tooltip `1000`.

---

## Primitives

| Primitive | Path | Status |
|-----------|------|--------|
| `Button`, `Card`, `Badge`, `Input`, etc. | `client/src/components/ui/*.tsx` | Existing |
| `PageHeader` | `client/src/components/ui/page-header.tsx` | Existing — adoption required |
| `Skeleton` | `client/src/components/ui/skeleton.tsx` | **New in v3.0** |
| `EmptyState` | `client/src/components/ui/empty-state.tsx` | **New in v3.0** |
| `StatusDot` | `client/src/components/ui/status-dot.tsx` | **New in v3.0** |
| `SeverityBadge` | `client/src/components/ui/severity-badge.tsx` | **New in v3.0** |

---

## Icons

- **Source**: Lucide React only. Single stroke width (2px default).
- **Sizes**: `h-4 w-4` (16) for inline; `h-5 w-5` (20) for buttons; `h-6 w-6` (24) for cards; `h-8 w-8` (32) for `PageHeader`.
- **Emoji as icons**: forbidden.
- **Icon-only buttons**: require `aria-label`.

---

## Touch Targets

- **Mobile (< 640px)**: ≥ 44×44px.
- **Desktop**: ≥ 32×32px with ≥ 8px spacing.
- `Button` `size="icon"` default `h-10 w-10` (40); for mobile-critical icon buttons in the header/sidebar use `h-11 w-11` (44).

---

## Accessibility Floor

- Keyboard-complete (no mouse-only flows).
- All icon-only buttons have `aria-label`.
- All form inputs have a visible `<Label>` (placeholder-only is forbidden).
- Color is never the sole information carrier — pair with icon or text (see `SeverityBadge`).
- Focus rings: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`. Never `outline: none` without a replacement.
- Charts: keyboard-reachable tooltips + an `aria-label` summarizing the insight.
- WCAG 2.2 AA target across all three themes.

---

## Toast vs NotificationCenter

| Surface | Use |
|---------|-----|
| **Toast** (`sonner`) | Transient feedback for *the current user's action* — saved, copied, failed. Auto-dismiss 3–5s. `aria-live="polite"`. |
| **NotificationCenter** | Persistent, multi-session events — workflow finished, scan completed, new vuln found. Survives reload. |

An event triggers exactly one surface. Forms confirm via toast; backend events surface via NotificationCenter.

---

## Per-Page Conversion Checklist

A page is "converted" to v3 only when **all** of the following pass:

- [ ] Adopts `<PageHeader />` (no ad-hoc `<h1>`).
- [ ] First-paint loading uses `<Skeleton />` (no `Loader2` for blocking states).
- [ ] Empty data uses `<EmptyState />`.
- [ ] No literal color classes: `text-red-*`, `bg-amber-*`, `text-emerald-*`, etc. Replace with `destructive`, `warning`, `success`, `info` or `<SeverityBadge />`.
- [ ] All icon-only buttons have `aria-label`.
- [ ] Tables wrapped in `overflow-x-auto`.
- [ ] No `text-[10px]` or `text-[11px]` body text.
- [ ] No `shadow-md` / `shadow-xl` / `shadow-2xl`.
- [ ] Animations use `transition-colors|opacity|transform` (no `transition-all`).

### Conversion Status

Updated as pages are migrated. Order matches the migration strategy in the parent doc.

| Page | Status |
|------|--------|
| Dashboard | ☑ |
| Operations | ☑ |
| Targets | ☑ |
| Vulnerabilities | ☑ |
| Agents | ◐ (page-level only; deep refactor → Phase 6) |
| Surface Assessment | ☑ |
| Reports | ☑ |
| Tools | ☑ |
| Tool Registry | ☐ |
| Tool Migration | ☐ |
| Empire | ☑ |
| Implants | ☑ |
| Infrastructure | ☐ |
| Ollama | ☐ |
| OffSec Team | ☐ |
| CTI | ☐ |
| Engagement Dashboard | ☐ |
| Attack Framework | ☑ |
| ATLAS Framework | ☑ |
| OWASP LLM | ☑ |
| NIST AI | ☑ |
| CIS Framework | ☑ |
| Frameworks | ☑ |
| Operations Manager | ☐ |
| Settings | ☐ |
| Profile | ☐ |
| Users | ☐ |
| Admin Reporters | ☐ |
| Login | ☐ |

---

## How to Use This File

When building or refactoring a page:

1. Read this MASTER file.
2. Check `design-system/pages/<page-name>.md` — if present, its rules override.
3. Apply the conversion checklist before marking the page done.
