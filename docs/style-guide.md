# Style Guide

Shared by every group member (Dispatch Rescue Team, Post-Disaster Analysis, Issue and Disseminate Warning, Submit and Verify Hazard Report). Follow it so the four use cases look and read like one product.

Source of truth for visuals: the hi-fi wireframes in `Group_052.pdf` (pp. 38-41). Colors below were sampled from those pages. If a wireframe and this guide disagree, fix this guide in the same change.

Rules of use:
- Define tokens once per app (section 8). Never hard-code a color, spacing, or font size in a component.
- Only deviate from a wireframe when the group report documents the change.
- Keep it short: if a rule is not here, copy the closest existing screen.

---

## 1. Principles

1. **Calm under stress.** Users are in or near a disaster. One primary action per screen, plain words, large touch targets.
2. **Status is always visible.** Every report, shelter, team, or warning shows its state with the same chip, color, and label everywhere.
3. **Never leave the user guessing.** Every screen handles loading, empty, error, and offline states (section 6).
4. **Never rely on color alone.** Pair color with an icon or text label.
5. **Consistency over cleverness.** Reuse an existing component before writing a new one.

## 2. Color Tokens

| Token | Hex | Use |
|---|---|---|
| `navy` | `#17324d` | App bar, portal sidebar, secondary dark buttons ("Go to Home", "View Report") |
| `navy-hover` | `#244663` | Active sidebar item, pressed navy button |
| `orange` | `#e67e22` | Primary call to action, "View" links, Refresh, active tab |
| `orange-tint` | `#fff1e5` | Orange chip and badge backgrounds |
| `success` | `#2e8b57` | Verify, Verified, Safe, Resolved |
| `success-tint` | `#eaf6ef` | Success chip background |
| `danger` | `#c1392b` | Reject, Rejected, Critical, destructive actions |
| `danger-tint` | `#fbedec` | Danger chip background |
| `warning-tint` | `#fff3cd` | Warning banners, Pending Verification chip background |
| `warning-text` | `#8a5a00` | Text on warning tint (check contrast, see section 7) |
| `page` | `#f5f7fa` | Screen background |
| `surface` | `#ffffff` | Cards, inputs |
| `border` | `#d9dee5` | Card, input, and table borders |
| `text` | `#263238` | Body text |
| `text-muted` | `#667085` | Labels, helper text, timestamps |

Rules:
- Orange is the single primary action color. Do not use it for status.
- Do not introduce new hues. Need a new state? Reuse the closest token and add a label.
- Contrast: body text 4.5:1 or better, large text and UI borders 3:1 or better. White text on `navy`, `orange`, `success`, and `danger` is the approved pairing.

## 3. Typography

- **Family:** Inter. Fallback is the platform default sans-serif (San Francisco, Roboto, system-ui).
- Use one family everywhere. Never mix in a second family.

| Role | Size and weight | Example |
|---|---|---|
| Screen title (app bar) | 18, semibold | "Report Hazard" |
| Page title (portal) | 24, bold | "Pending Hazard Reports" |
| Section label | 12, semibold, uppercase, letter-spaced | HAZARD TYPE, LOCATION |
| Body | 16 mobile, 14 portal, regular | Descriptions |
| Helper and meta | 12, regular, `text-muted` | "2 mins ago" |
| Button | 16, semibold, uppercase on primary mobile buttons | "SUBMIT REPORT" |

- Required fields: label followed by a red asterisk (`danger`), e.g. `Hazard Type *`.
- Sentence case for all copy except section labels and primary mobile buttons.

## 4. Spacing, Shape, Elevation

- **Spacing scale (px):** 4, 8, 12, 16, 24, 32. Nothing else.
- **Screen padding:** 16 on mobile, 24 on the portal.
- **Radius:** 8 for inputs, buttons, and chips (chips fully rounded), 12 for cards.
- **Borders:** 1px `border` on cards and inputs. Shadows are subtle (one small shadow on cards only).
- **Touch targets (mobile):** at least 44 x 44 pt. Primary buttons are 48 high and full width.
- **Icons:** one outline icon set (Lucide on web, `lucide-react-native` on mobile). 20 px inline, 24 px in buttons, 48-64 px in result cards.

## 5. Components

### 5.1 Buttons

| Variant | Look | Use |
|---|---|---|
| Primary | `orange` fill, white text | The one main action on a screen |
| Secondary | `navy` fill, white text | Navigation or follow-up ("Go to Home", "View Report") |
| Success | `success` fill, white text | Verify |
| Danger | `danger` fill, white text | Reject (always behind a confirm dialog) |
| Ghost | White fill, `border`, `text` | Cancel, Back, Edit |
| Disabled | 40% opacity, no press state | While invalid or submitting |

- A submitting button shows a spinner and the text "Submitting..." and is disabled. Prevent double submit.
- Mobile: primary action pinned to the bottom of the screen, full width.

### 5.2 Form fields

- Label above the field (section label style), helper text below in muted color.
- Required fields marked with `*`. Optional fields say "(Optional)" in the label.
- Error: 1px `danger` border, error text below the field in `danger` with an alert icon. Move focus to the first invalid field on submit.
- Validate on blur and on submit. Never clear what the user typed after an error.
- Selects use a native picker on mobile and a styled select on the portal.

### 5.3 Status chips

One shared chip component per app. Never restyle a status locally.

| Status | Label | Background | Text |
|---|---|---|---|
| Pending Synchronization | Pending Synchronization | `#eef2f6` | `text-muted` |
| Pending Verification | Pending Verification | `warning-tint` | `warning-text` |
| Verified | Verified | `success-tint` | `success` |
| Rejected | Rejected | `danger-tint` | `danger` |

Other use cases extend this table here (for example Dispatched, En route, Issued, Critical, Warning, Resolved) using the same pattern: tint background, strong-color text, a leading dot or icon.

### 5.4 Cards

White surface, 1px `border`, radius 12, padding 16, 12 gap between cards. Section label at the top, content below.

### 5.5 Result screens (mobile)

Centered card: 56 px circular icon (`success`, `danger`, or `warning`), bold heading, one line of copy, a status chip, then a single action pinned to the bottom. Example: "Report Submitted" with the Pending Verification chip and "Go to Home".

### 5.6 Banners

Full-width, radius 8, padding 12, leading icon, `warning-tint` background for cautions (such as the emergency-numbers notice), `danger-tint` for errors, `success-tint` for confirmation. Offline banner is `warning-tint` and sticky at the top.

### 5.7 Dialogs

Used for irreversible or consequential actions (Reject, Dispatch, Issue warning). Title states the action, body states the consequence, two buttons: Ghost "Cancel" on the left, the action button on the right in its own color. Escape and tapping outside cancel.

### 5.8 Portal layout (web)

- Left sidebar (`navy`, 240 px): logo block, nav items with outline icons, count badge in `orange` where relevant, Logout at the bottom. Active item uses `navy-hover` with a left accent.
- Top bar: menu toggle, notification bell with red count, officer chip with "On duty" status dot.
- Page header: title, subtitle in muted text, primary action on the right.
- Stat cards: four across, big number, muted label, small tinted icon tile.
- Tables: sticky header, muted uppercase column labels, 56 px rows, "View" as an orange text button, pagination bottom right, "Showing 1-5 of 12" bottom left.
- Detail pages: numbered cards (1 Report Details, 2 Location, 3 Photo Evidence, 4 Notes, 5 Decision) in a two-column grid that collapses to one column below 1024 px.

### 5.9 Mobile layout

- Navy app bar, white title, back arrow on the left, optional action on the right.
- Bottom tab bar: Home, Tasks, Alerts, Profile. The active tab is `orange`.
- Lists use cards with a chevron. Pull to refresh on every list.

## 6. States (required on every screen)

| State | Treatment |
|---|---|
| Loading | Skeleton blocks matching the final layout. Spinner only inside buttons. |
| Empty | Icon, one sentence ("No pending reports"), and the next action if one exists. |
| Error | Inline banner with plain-language cause and a Retry button. Never a blank screen. |
| Offline (mobile) | Sticky banner "You are offline. Reports will be sent when you reconnect." Queued items show Pending Synchronization. |
| Permission denied (GPS, camera) | Explain why it is needed, with "Try again" and "Open settings". |
| Conflict | Plain message ("This report was already reviewed by another officer") and a link back to the list. |

## 7. Accessibility

- Every interactive element has an accessible name (`aria-label` on web, `accessibilityLabel` on mobile).
- Visible focus ring on the portal (2 px `orange` outline). Full keyboard operation, logical tab order, dialogs trap focus.
- Errors use `role="alert"` (web) or an accessibility announcement (mobile).
- Do not convey status by color alone. Chips always carry text.
- Respect reduced-motion settings. Keep animation under 200 ms.
- Text scales with the system font size on mobile. Layouts must not clip at 130% scale.

## 8. Implementing the Tokens

### Web (`apps/web/src/index.css`, Tailwind v4)

```css
@import 'tailwindcss';

@theme {
  --color-navy: #17324d;
  --color-navy-hover: #244663;
  --color-orange: #e67e22;
  --color-orange-tint: #fff1e5;
  --color-success: #2e8b57;
  --color-success-tint: #eaf6ef;
  --color-danger: #c1392b;
  --color-danger-tint: #fbedec;
  --color-warning-tint: #fff3cd;
  --color-warning-text: #8a5a00;
  --color-page: #f5f7fa;
  --color-surface: #ffffff;
  --color-border: #d9dee5;
  --color-ink: #263238;
  --color-muted: #667085;
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

Use utilities such as `bg-navy`, `text-muted`, `border-border`. No arbitrary values like `bg-[#17324d]`.

### Mobile (`apps/mobile/src/theme.ts`)

```ts
export const colors = {
  navy: '#17324d',
  navyHover: '#244663',
  orange: '#e67e22',
  orangeTint: '#fff1e5',
  success: '#2e8b57',
  successTint: '#eaf6ef',
  danger: '#c1392b',
  dangerTint: '#fbedec',
  warningTint: '#fff3cd',
  warningText: '#8a5a00',
  page: '#f5f7fa',
  surface: '#ffffff',
  border: '#d9dee5',
  text: '#263238',
  textMuted: '#667085',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { control: 8, card: 12, pill: 999 } as const;
```

Import from `theme.ts` in every `StyleSheet`. No inline hex values.

## 9. Content and Copy

- Plain, calm, short. Say what happened and what happens next ("Your report has been submitted and is waiting for verification").
- Buttons are verbs ("Review report", "Submit report", "Verify report").
- Emergency numbers for Sri Lanka: **117** (DMC hotline), **119** (Police), **110** (Ambulance). Never show 911.
- Dates and times: relative for recent ("2 mins ago"), absolute for older (`5 Oct 2026, 06:35`). Time zone is Asia/Colombo.
- Coordinates: decimal degrees with 4 decimals plus hemisphere letters (`7.2906° N, 80.6337° E`).
- IDs: `HR-YYYY-NNNN` style, monospace in the portal.
- Currency and numbers use the `en-LK` locale.

## 10. Code Conventions

These match what the repo already enforces. Run `bun run lint`, `bun run check-types`, and `bun run test` before every commit.

**General**
- TypeScript strict, no `any`. Use `unknown` and narrow.
- Single quotes, trailing commas (`all`), 2-space indent, Prettier formatting.
- Lint with oxlint (zero warnings). No ESLint.
- ESM. In `apps/api`, relative imports end in `.js` (e.g. `'./health.module.js'`).
- Import order: external packages, blank line, `@repo/*`, blank line, relative. Use `import type` for types.
- Names: `camelCase` values, `PascalCase` types and components, `UPPER_SNAKE_CASE` constants and enum members, `kebab-case` file names (API) and `PascalCase.tsx` for React components.
- One exported component or class per file. Keep files under about 200 lines. Extract when they grow.
- Comments explain why, not what. No commented-out code.

**Shared contract**
- Request and response shapes, enums, and status unions live in `packages/types`. API, web, and mobile import from `@repo/types`. Never redeclare them locally.
- Add a type-level test in `contract.test-d.ts` for new unions.

**API (`apps/api`, Nest)**
- Feature folder per use case (`hazard-reports/`, `dispatch/`, ...) with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `dto/`, `*.spec.ts`.
- Controller: routing and DTO validation only. Service: business rules. Repository: the only layer that touches Prisma.
- DTOs use `class-validator`. Global `ValidationPipe` with whitelist and `forbidNonWhitelisted`.
- Inject dependencies by constructor and by token for interfaces (`HAZARD_REPORT_REPOSITORY`). Services depend on interfaces, not implementations (SOLID).
- Errors: throw Nest HTTP exceptions (`NotFoundException`, `ConflictException`). One global filter shapes the response as `{ statusCode, error, message }`.
- Routes are plural nouns under the `/api` prefix. `PATCH /resource/:id/action` for state transitions.
- Secrets only from environment variables. Update `.env.example` (placeholders) when adding one.

**Web (`apps/web`, React 19 and Vite)**
- Function components and hooks. Data access in `src/api/*.ts`, hooks in `src/hooks/`, pages in `src/pages/`, shared UI in `src/components/`.
- Cancel requests with `AbortController` on unmount (see `HealthStatus.tsx`).
- Tailwind utilities with the tokens from section 8. Extract repeated class sets into a component, not a CSS file.
- Routing with `react-router-dom`. One route per page.

**Mobile (`apps/mobile`, Expo and React Native)**
- Same folder pattern: `src/api`, `src/components`, `src/screens`, `src/hooks`, `src/theme.ts`.
- `StyleSheet.create` with tokens from `theme.ts`.
- Read the API base URL from `EXPO_PUBLIC_API_URL`. Never hard-code `localhost`.

## 11. Testing Conventions

- Target 80% or more coverage on the code you write. Run with `--coverage`.
- Test names read as behavior: `it('rejects a report that was already decided')`.
- Arrange, act, assert. One behavior per test. No logic in tests.
- Cover positive, negative, edge, and error cases for each unit.
- API: Vitest, `*.spec.ts` next to the code. Mock the repository and external services (Cloudinary, notification). One e2e test per use case with `supertest`.
- Web: Vitest and Testing Library. Query by role and accessible name, not by class or test id. Mock `fetch` at the `src/api` boundary.
- Mobile: Jest, `jest-expo`, and React Native Testing Library. Mock native modules (location, image picker, network info) in `jest.setup.js`.
- Tests never call the real network or real cloud services.

## 12. Git and Review

- Branch from `dev/<name>`. Keep each commit small and focused.
- Conventional commits, as in the existing history: `feat(api): ...`, `fix(web): ...`, `chore: ...`, `test(mobile): ...`, `docs: ...`. Scope is `api`, `web`, `mobile`, or `types`.
- Do not commit `.env`, credentials, `node_modules`, or build output.
- Git hooks (husky) run automatically after `bun install`:
  - **pre-commit:** prettier formats the staged files, then lint runs on every workspace. Lint warnings fail the commit.
  - **pre-push:** `format:check`, lint, and type-check across all workspaces. Tests are not part of the hook, so run `bun run test` yourself.
  - Never bypass them with `--no-verify`. Fix the cause instead.
- Prettier config lives once at the repo root (`.prettierrc`). Do not add per-package configs. The `docs/` folder is excluded.
- Changing a shared token, shared type, or shared component? Say so in the commit message and tell the group, since it affects every use case.

## 13. Checklist Before You Open a PR

- [ ] Screens match their wireframes (plus documented report changes)
- [ ] Only theme tokens used, no hex values or arbitrary Tailwind colors
- [ ] Loading, empty, error, and offline states handled
- [ ] Status shown with the shared chip, never by color alone
- [ ] Labels, focus order, and accessible names checked
- [ ] Types come from `@repo/types`
- [ ] Tests added, coverage at or above 80% for new code
- [ ] `bun run lint`, `bun run check-types`, `bun run test` all pass
- [ ] No secrets in the diff
