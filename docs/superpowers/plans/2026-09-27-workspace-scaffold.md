# Workspace Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unused create-turbo boilerplate with a pnpm workspace containing a Vite web app, a Nest API, and an Expo mobile app, all sharing one typed contract package.

**Architecture:** One pnpm workspace driven by turbo. `@repo/types` is compiled to `dist/` with declarations and consumed as a `workspace:*` dependency by all three apps, so a contract change surfaces as a type error everywhere at once. No Metro configuration: Expo SDK 57 auto-detects pnpm workspaces.

**Tech Stack:** pnpm 12.6.0, turbo 2.11.4, Vite 8, React 19, Nest 12 (ESM), Expo 57 / React Native 0.86, oxlint, Vitest 5, TypeScript ~6.0.3.

**Spec:** `docs/superpowers/specs/2026-09-27-pnpm-turborepo-workspace-design.md`

## Global Constraints

- TypeScript is `~6.0.3` in the root, in every app, and in `packages/types`. Do not use 7.x.
- Linting is oxlint everywhere. `@repo/eslint-config` is deleted; do not reintroduce ESLint.
- `@repo/types` is consumed as compiled `dist/` output, never as raw TypeScript source.
- Every workspace dependency on a local package uses the `workspace:*` protocol.
- Exactly one lockfile (`pnpm-lock.yaml`) at the root. No nested installs.
- `engines.node` is `>=22.13.0`; `packageManager` is `pnpm@12.6.0`, pinned exactly.
- Do not create `metro.config.js`. If Metro misresolves, the fix is removing hand-written Metro properties and re-running with `--clear`.
- Lint runs with `--deny-warnings` equivalent for CI purposes: oxlint must report zero warnings.
- Ports: API `3000`, web dev `5173`. Mobile uses the Expo dev server, no fixed port.

## Review Focus

Failure modes the spec implies but no task's happy-path test covers. Each has a test pinned in the task listed.

1. **API process is down when a client loads** (port closed, crashed server) — the client must render a visible "API unreachable" state, never a blank screen or an unhandled rejection. Tested in Task 9 (web) and Task 10 (mobile).
2. **CORS preflight from a disallowed origin** — a request from an origin outside `CORS_ORIGIN` must receive no `Access-Control-Allow-Origin` header. Tested in Task 8.
3. **Dependency probe reports failure** — the health endpoint must return HTTP 503 with `status: "degraded"`, not a 200 with a healthy-looking body. Tested in Task 8.
4. **Stale `@repo/types/dist`** — a client could typecheck against an out-of-date contract. Mitigated by giving `test` and `check-types` a `dependsOn: ["^build"]` edge, asserted in Task 11.
5. **pnpm blocked a lifecycle build script** — install succeeds but `esbuild`'s binary is missing, so `vite` fails at startup rather than at install time. Asserted in Task 1 and Task 5.

## File Structure

Root:

- `package.json` — workspace scripts, engines, packageManager, TypeScript version
- `pnpm-workspace.yaml` — globs plus `onlyBuiltDependencies`
- `turbo.json` — build/lint/check-types/test/dev tasks, `dist/**` outputs
- `.gitignore` — adds `.expo/`, `*.tsbuildinfo`
- `README.md` — rewritten for the new workspace

`packages/typescript-config/` — `base.json` (kept), `vite.json` (new), `nest.json` (new); `nextjs.json` and `react-library.json` deleted.

`packages/types/` — the shared contract. `src/health.ts` holds `API_HEALTH_PATH` and `HealthResponse`; `src/alert.ts` holds `AlertSeverity` and `Alert`; `src/index.ts` re-exports both. `dist/` is built output, gitignored.

`apps/api/src/health/` — `health.module.ts`, `health.controller.ts` (HTTP boundary), `health.service.ts` (probe logic), `health.controller.spec.ts` (Vitest + Supertest).

`apps/web/src/` — `api/health.ts` (typed fetch), `components/HealthStatus.tsx` (rendering), `App.tsx` (router), plus colocated `*.test.ts(x)`.

`apps/mobile/src/` — `api/health.ts`, `components/HealthStatus.tsx`; `App.tsx` composes them.

---

### Task 1: Toolchain and root package manager migration

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`, `.gitignore`
- Delete: `bun.lock`, `.npmrc`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a working `pnpm install` at the root, and `pnpm-workspace.yaml` globs that every later task's app must satisfy

- [ ] **Step 1: Enable pnpm via corepack**

Run: `corepack enable && corepack prepare pnpm@12.6.0 --activate && pnpm -v`
Expected: `12.6.0`. If `corepack` is unavailable, `npm i -g pnpm@12.6.0` and note the substitution in the commit message.

- [ ] **Step 2: Delete bun artifacts and create the workspace manifest**

`rm bun.lock .npmrc`, then write `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*

onlyBuiltDependencies:
  - esbuild
```

- [ ] **Step 3: Rewrite root `package.json`**

Remove the `workspaces` and `devEngines` keys. Set `engines.node` to `">=22.13.0"`, add `"packageManager": "pnpm@12.6.0"`, and change `typescript` from `7.0.2` to `~6.0.3`. Leave `build`/`dev`/`lint`/`check-types` scripts as they are; `test` is added in Task 11.

- [ ] **Step 4: Extend `.gitignore`**

Append `.expo/` and `*.tsbuildinfo`. `node_modules`, `dist`, and `.turbo` are already ignored.

- [ ] **Step 5: Verify install works with no packages present**

Run: `pnpm install`
Expected: exit 0. Note any package whose install script pnpm blocked; if a later task fails on a missing binary, add it to `onlyBuiltDependencies` here (Review Focus #5).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: migrate workspace from bun to pnpm"
```

---

### Task 2: Delete legacy apps and packages

**Files:**
- Delete: `apps/web/`, `apps/docs/`, `packages/ui/`, `packages/eslint-config/`
- Modify: `packages/typescript-config/` — remove `nextjs.json`, `react-library.json`

**Interfaces:**
- Consumes: Task 1's `pnpm-workspace.yaml`
- Produces: empty `apps/` directory and a `typescript-config` package containing only `base.json`

- [ ] **Step 1: Remove the Next.js apps, `ui`, and `eslint-config`**

Run: `rm -rf apps/web apps/docs packages/ui packages/eslint-config packages/typescript-config/nextjs.json packages/typescript-config/react-library.json`

- [ ] **Step 2: Confirm nothing still references them**

Run: `grep -rn "eslint-config\|@repo/ui\|@next/" --include="*.json" --include="*.ts" --include="*.js" . --exclude-dir=node_modules`
Expected: no matches. Any match means a dangling reference — fix it before committing.

- [ ] **Step 3: Verify the workspace still installs**

Run: `pnpm install && ls apps packages`
Expected: exit 0, `apps` empty, `packages` containing only `typescript-config`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove create-turbo boilerplate apps and packages"
```

---

### Task 3: Add typescript-config presets

**Files:**
- Create: `packages/typescript-config/vite.json`, `packages/typescript-config/nest.json`
- Read only: `packages/typescript-config/base.json`

**Interfaces:**
- Consumes: `base.json` (kept as-is, `module: NodeNext`)
- Produces: `@repo/typescript-config/vite.json` and `@repo/typescript-config/nest.json`, each extending `./base.json` with one runtime's overrides. Tasks 5, 6, and 7 extend these.

- [ ] **Step 1: Write `vite.json`**

Extend `./base.json`. Override to match what the Vite react-ts template actually ships, so extending this preset does not change app behaviour: `module` `esnext`, `moduleResolution` `bundler`, `lib` `["ES2023", "DOM", "DOM.Iterable"]`, `target` `es2023`, `jsx` `react-jsx`, `noEmit` true, `isolatedModules` true, `verbatimModuleSyntax` true, `moduleDetection` `force`, `allowImportingTsExtensions` true, `noUnusedLocals` true, `noUnusedParameters` true, `erasableSyntaxOnly` true, `types` `["vite/client"]`. Do not set `declaration` (inherited `true` conflicts with `noEmit`; the preset must set `"declaration": false` explicitly).

- [ ] **Step 2: Write `nest.json`**

Extend `./base.json`. `module` and `moduleResolution` stay `NodeNext`; set `types` `["node"]`, `emitDecoratorMetadata` true, `experimentalDecorators` true, `strictPropertyInitialization` false (required by Nest's constructor injection), `sourceMap` true, `incremental` true. `declaration` stays inherited `true`.

- [ ] **Step 3: Verify both presets parse and inherit correctly**

Run: `node -e "const v=require('./packages/typescript-config/vite.json');const n=require('./packages/typescript-config/nest.json');console.log(v.extends,n.extends,n.compilerOptions.strictPropertyInitialization)"`
Expected: `./base.json` `./base.json` `false`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add vite and nest tsconfig presets"
```

---

### Task 4: Create the shared contract package

**Files:**
- Create: `packages/types/package.json`, `packages/types/tsconfig.json`, `packages/types/src/index.ts`, `packages/types/src/health.ts`, `packages/types/src/alert.ts`
- Test: `packages/types/src/contract.test-d.ts`

**Interfaces:**
- Consumes: Task 3's `base.json` via its own tsconfig
- Produces: the module `@repo/types`, with these exact exports consumed by Tasks 8, 9, and 10:
  - `API_HEALTH_PATH: "/api/health"`
  - `HealthResponse { status: "ok" | "degraded"; service: string; timestamp: string }`
  - `AlertSeverity = "info" | "warning" | "critical"`
  - `Alert { id: string; severity: AlertSeverity; message: string }`

- [ ] **Step 1: Write the type-level test first**

`contract.test-d.ts` asserts the contract cannot drift silently. It must fail to compile before `src/` exists:

```ts
import type { Alert, HealthResponse } from "./index";

const ok: HealthResponse = { status: "ok", service: "api", timestamp: "2026-01-01T00:00:00.000Z" };
const degraded: HealthResponse = { ...ok, status: "degraded" };
const alert: Alert = { id: "a1", severity: "critical", message: "Flood warning" };

// @ts-expect-error status is a closed union
const bad: HealthResponse = { ...ok, status: "unknown" };
// @ts-expect-error severity is a closed union
const badAlert: Alert = { ...alert, severity: "urgent" };

export { ok, degraded, alert, bad, badAlert };
```

- [ ] **Step 2: Run the type check to verify it fails**

Run: `cd packages/types && pnpm exec tsc --noEmit`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Write `src/health.ts`**

Export `API_HEALTH_PATH` as `export const API_HEALTH_PATH = "/api/health" as const;` and `HealthResponse` as an interface with `status: "ok" | "degraded"`, `service: string`, `timestamp: string`. `status` is a closed union, not `string`.

- [ ] **Step 4: Write `src/alert.ts`**

Export `AlertSeverity` as `"info" | "warning" | "critical"` and `Alert` as `{ id: string; severity: AlertSeverity; message: string }`.

- [ ] **Step 5: Write `src/index.ts`**

`export * from "./health";` and `export * from "./alert";`.

- [ ] **Step 6: Write `package.json` and `tsconfig.json`**

`package.json`: name `@repo/types`, `type: "module"`, `main` and `types` both `./dist/index.js` / `./dist/index.d.ts`, an `exports` map with `"."` pointing at those, scripts `build` (`tsc -p tsconfig.json`), `check-types` (`tsc --noEmit`), `lint` (`oxlint src`). devDependency `typescript: "~6.0.3"`.

`tsconfig.json`: extends `../typescript-config/base.json`, `compilerOptions.outDir` `./dist`, `rootDir` `./src`, include `["src"]`. Because `rootDir` is `./src`, `contract.test-d.ts` must live in `src/`.

- [ ] **Step 7: Verify the type test now passes**

Run: `cd packages/types && pnpm exec tsc --noEmit && pnpm build && ls dist`
Expected: exit 0, `dist/index.js` and `dist/index.d.ts` present. Both `@ts-expect-error` lines must be satisfied — an "unused `@ts-expect-error`" error means a union was widened.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(types): add shared health and alert contract"
```

---

### Task 5: Scaffold the Vite web app

**Files:**
- Create: `apps/web/` via `pnpm create vite@latest`, then modify `package.json`, `vite.config.ts`, `tsconfig.app.json`, `src/App.tsx`, `src/main.tsx`, `src/index.css`
- Create: `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: Task 3's `@repo/typescript-config/vite.json`
- Produces: a running Vite dev server on 5173 with oxlint, Tailwind 4, React Router 7, and a working Vitest setup. Task 9 adds the health feature.
- Env contract: reads `import.meta.env.VITE_API_BASE_URL`, defaulting to `http://localhost:3000`.

- [ ] **Step 1: Scaffold**

Run: `pnpm create vite@latest apps/web --template react-ts`
Expected: `apps/web` created with `_gitignore` already renamed to `.gitignore`. The template names the package `vite-react-typescript-starter`; rename it to `web` in Step 4.

- [ ] **Step 2: Add Vitest, Testing Library, Tailwind, and the router**

Run: `pnpm --filter web add react-router-dom tailwindcss @tailwindcss/vite` and `pnpm --filter web add -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`.
Expected: exit 0. The Vite template ships no test runner, so this step is what makes Task 9 possible.

- [ ] **Step 3: Write `vitest.config.ts` and the setup file**

`vitest.config.ts` uses `defineConfig` from `vitest/config`, merges the Vite config, and sets `test.environment` to `jsdom`, `test.setupFiles` to `["./src/test/setup.ts"]`, and `test.globals` true.

`src/test/setup.ts` contains `import "@testing-library/jest-dom/vitest";`.

- [ ] **Step 4: Rename the package and add scripts**

In `apps/web/package.json`: set `"name": "web"`, keep `"dev"`, `"build"`, `"preview"`, `"lint"` (`oxlint`); add `"test": "vitest run"`, `"test:watch": "vitest"`, and `"check-types": "tsc -b --noEmit"`. Add `"@repo/typescript-config": "workspace:*"` to devDependencies.

- [ ] **Step 5: Point `tsconfig.app.json` at the shared preset**

Replace its `compilerOptions` block with `{ "extends": "@repo/typescript-config/vite.json" }`, keeping `"include": ["src"]`. Verify `tsconfig.node.json` still covers `vite.config.ts`; if it extends the app config, give it the same treatment.

- [ ] **Step 6: Wire Tailwind and the router**

In `vite.config.ts`, add `tailwindcss()` from `@tailwindcss/vite` to `plugins`. Replace `src/index.css` with `@import "tailwindcss";`. Delete the template's `src/App.css` and `src/assets/react.svg`, and remove the logo import from `App.tsx`.

- [ ] **Step 7: Write the passing smoke test**

`src/App.test.tsx` renders `<App />` inside `MemoryRouter` and asserts the heading "Disaster Warning System" is present. This is a smoke test, not the feature test; it proves the runner, jsdom, and Testing Library are wired before Task 9 adds behaviour.

- [ ] **Step 8: Run the full web verification**

Run: `pnpm --filter web test && pnpm --filter web lint && pnpm --filter web check-types`
Expected: all exit 0, oxlint reports zero warnings.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold vite app with router, tailwind, and vitest"
```

---

### Task 6: Scaffold the Nest API

**Files:**
- Create: `apps/api/` via `pnpm create @nestjs/cli@latest`, then modify `package.json`, `src/main.ts`, `src/app.module.ts`
- Delete: `apps/api/src/app.controller.ts`, `apps/api/src/app.service.ts`, `apps/api/src/app.controller.spec.ts`

**Interfaces:**
- Consumes: Task 3's `@repo/typescript-config/nest.json`
- Produces: a Nest app on port 3000 with ESM + Vitest. Task 8 adds the health module. Tasks 9 and 10 depend on the final URL being exactly `API_HEALTH_PATH` (`/api/health`).
- Env contract: reads `process.env.CORS_ORIGIN`, defaulting to `http://localhost:5173`.

- [ ] **Step 1: Scaffold with every interactive or nested-install flag suppressed**

Run: `pnpm create @nestjs/cli@latest api --directory apps/api --package-manager pnpm --skip-git --skip-install --no-observe`
Expected: `apps/api` created with no nested `node_modules` and no nested lockfile. `--no-observe` is mandatory: without it the CLI prompts about `@nestjs/observe` and hangs. Confirm the template is the ESM one — `apps/api/package.json` must contain `"type": "module"` and `"test": "vitest run"`. If it contains `jest` instead, `nest new` picked the CJS template; re-run with the ESM type and stop to report.

- [ ] **Step 2: Remove the template's demo controller**

`rm apps/api/src/app.controller.ts apps/api/src/app.service.ts apps/api/src/app.controller.spec.ts`, and strip their references from `app.module.ts`, leaving it as a module that imports `HealthModule` (created in Task 8; until then an empty module is fine).

- [ ] **Step 3: Set CORS in `src/main.ts`**

`app.enableCors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" })`. The single-origin string is deliberate: a wildcard would silently satisfy Review Focus #2 in the wrong direction. Do **not** call `app.setGlobalPrefix("api")` — the full path comes from `API_HEALTH_PATH` in Task 8, and a global prefix would compose into `/api/api/health`.

- [ ] **Step 4: Add the shared typescript-config and align the tsconfig**

Add `"@repo/typescript-config": "workspace:*"` to devDependencies. Point `tsconfig.json` at `@repo/typescript-config/nest.json`, keeping `include`/`exclude` as scaffolded so `test/` stays in the type check.

- [ ] **Step 5: Verify the scaffolded state**

Run: `pnpm --filter api test && pnpm --filter api lint && pnpm --filter api check-types`
Expected: all exit 0. The scaffolded `test/app.e2e-spec.ts` targets the demo route removed in Step 2 and will fail; delete it, since Task 8's Supertest spec covers the endpoint properly.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): scaffold nest app with esm and vitest"
```

---

### Task 7: Scaffold the Expo mobile app

**Files:**
- Create: `apps/mobile/` via `pnpm create expo-app`, then modify `package.json`, `App.tsx`, `app.json`

**Interfaces:**
- Consumes: nothing from other tasks; deliberately isolated, because Expo's own scaffolder manages `apps/mobile` more than the others
- Produces: a bundleable Expo app. Task 10 adds the health feature.
- Env contract: reads `process.env.EXPO_PUBLIC_API_BASE_URL`, defaulting to `http://localhost:3000`. Note the different prefix from web's `VITE_` — this asymmetry is Expo's, not ours.

- [ ] **Step 1: Scaffold**

Run: `pnpm create expo-app apps/mobile`
Expected: `apps/mobile` created with `expo ~57.0.25`, `react-native 0.86.3`, `react 19.2.3`, `typescript ~6.0.3`. If the scaffolder ran its own install and created a nested lockfile, delete it — the root install is the only one (Global Constraints).

- [ ] **Step 2: Align TypeScript with the workspace**

The template already pins `~6.0.3`; leave it. Verify with `grep typescript apps/mobile/package.json`.

- [ ] **Step 3: Add lint and check-types scripts**

Add `"lint": "oxlint"` and `"check-types": "tsc --noEmit"` to `apps/mobile/package.json`, and `oxlint` to devDependencies. The Expo template ships no linter, and `turbo run lint` must not silently skip this app.

- [ ] **Step 4: Verify the app bundles**

Run: `cd apps/mobile && pnpm exec expo export --platform ios`
Expected: exit 0 and a `dist/` directory. This is the real proof that Metro resolves the workspace; a bundle failure here is the Review Focus #5 / monorepo-detection signal, and the fix is `pnpm exec expo start --clear` with no `metro.config.js` present.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): scaffold expo app"
```

---

### Task 8: Health endpoint in the API (TDD)

**Files:**
- Create: `apps/api/src/health/health.module.ts`, `health.controller.ts`, `health.service.ts`
- Test: `apps/api/src/health/health.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: `@repo/types` (`API_HEALTH_PATH`, `HealthResponse`) from Task 4; `CORS_ORIGIN` from Task 6
- Produces: `HealthService` with constructor `constructor(probe?: () => boolean)` — the probe defaults to `() => true` — and `check(): HealthResponse`, which returns `status: "ok"` when the probe passes and `status: "degraded"` when it returns `false`. `HealthController` exposes `GET /api/health`, with **no** global prefix, so the route equals `API_HEALTH_PATH` exactly. Tasks 9 and 10 consume this HTTP contract.

- [ ] **Step 1: Add the dependency and write the failing test**

Add `"@repo/types": "workspace:*"` to `apps/api` dependencies. Write `health.controller.spec.ts` using `vitest`, `@nestjs/testing`, and `supertest`. It must contain three cases:

1. `GET /api/health` with a passing probe → 200, body matching `HealthResponse` with `status: "ok"`, `service: "api"`, and an ISO-8601 `timestamp`.
2. `GET /api/health` with a probe returning `false` → 503, body `status: "degraded"` (Review Focus #3).
3. An `OPTIONS /api/health` preflight from `http://localhost:5173` → response carries `access-control-allow-origin: http://localhost:5173`; the same preflight from `http://evil.example` → response does **not** carry that header (Review Focus #2).

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test`
Expected: FAIL — cannot resolve `@repo/types` or missing `HealthService`.

- [ ] **Step 3: Implement `health.service.ts`**

`HealthService` takes an optional `probe: () => boolean` defaulting to `() => true`. `check()` returns `{ status: probe() ? "ok" : "degraded", service: "api", timestamp: new Date().toISOString() }`, typed as `HealthResponse` imported from `@repo/types`.

- [ ] **Step 4: Implement `health.controller.ts` and `health.module.ts`**

`@Controller()` with `@Get(API_HEALTH_PATH)`, using the imported constant so the route and the client-side path cannot drift. The controller must produce 503 for the degraded case — use `@Res({ passthrough: true })` and set the status code explicitly rather than throwing, so the body shape stays `HealthResponse` on both paths. `health.module.ts` provides `HealthService` and declares `HealthController`. Register `HealthModule` in `app.module.ts` imports.

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm --filter api test && pnpm --filter api check-types`
Expected: PASS, all three cases, exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): add typed health endpoint with degraded path"
```

---

### Task 9: Health status in the web app (TDD)

**Files:**
- Create: `apps/web/src/api/health.ts`, `apps/web/src/components/HealthStatus.tsx`
- Test: `apps/web/src/api/health.test.ts`, `apps/web/src/components/HealthStatus.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `@repo/types` from Task 4; the `GET /api/health` contract from Task 8
- Produces: `fetchHealth(signal?: AbortSignal): Promise<HealthResponse>` in `apps/web/src/api/health.ts`, which throws on non-2xx and reads its base URL from `import.meta.env.VITE_API_BASE_URL` defaulting to `http://localhost:3000`; `<HealthStatus />`, which renders the service status or an error message.

- [ ] **Step 1: Add the dependency and write the failing tests**

Add `"@repo/types": "workspace:*"` to `apps/web` dependencies.

`health.test.ts`: with `global.fetch` stubbed to resolve `{ ok: true, json: async () => ({ status: "ok", service: "api", timestamp: "..." }) }`, `fetchHealth()` resolves to that object; with a rejected fetch it rejects rather than resolving to a falsy placeholder.

`HealthStatus.test.tsx`: given a mocked `fetchHealth` that resolves, the component shows the service name; given one that rejects, it shows the text "API unreachable" (Review Focus #1) and does not render a blank screen.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter web test`
Expected: FAIL — cannot resolve `./api/health`.

- [ ] **Step 3: Implement `fetchHealth`**

`export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse>` calling `${base}${API_HEALTH_PATH}`. Throw when `!response.ok`. The return type is imported from `@repo/types` — not redeclared locally — so a contract change breaks this file at compile time.

- [ ] **Step 4: Implement `HealthStatus`**

`useEffect` calling `fetchHealth` with an `AbortController`, local state for `HealthResponse | null` and `error | null`, and a render that shows "API unreachable" when `error` is set. Use Tailwind classes; no new CSS file.

- [ ] **Step 5: Mount it in `App.tsx`**

Render `<HealthStatus />` on the index route, keeping the smoke-test heading from Task 5 so `App.test.tsx` still passes.

- [ ] **Step 6: Run it to verify it passes**

Run: `pnpm --filter web test && pnpm --filter web check-types && pnpm --filter web lint`
Expected: PASS, exit 0, oxlint clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): render api health from shared contract"
```

---

### Task 10: Health status in the mobile app (TDD)

**Files:**
- Create: `apps/mobile/src/api/health.ts`, `apps/mobile/src/components/HealthStatus.tsx`
- Test: `apps/mobile/src/components/HealthStatus.test.tsx`
- Modify: `apps/mobile/App.tsx`, `apps/mobile/package.json`

**Interfaces:**
- Consumes: `@repo/types` from Task 4; the `GET /api/health` contract from Task 8
- Produces: `fetchHealth(signal?: AbortSignal): Promise<HealthResponse>` reading `process.env.EXPO_PUBLIC_API_BASE_URL` (default `http://localhost:3000`), and a `<HealthStatus />` component matching the web app's two states. This is also the first real test of Metro resolving `@repo/types`.

- [ ] **Step 1: Add the dependency and the test runner**

Add `"@repo/types": "workspace:*"` to dependencies. Add `vitest` to devDependencies and a `"test": "vitest run"` script. Keep the Expo default test setup otherwise untouched.

- [ ] **Step 2: Write the failing test**

`HealthStatus.test.tsx`: mocked `fetchHealth` resolving renders the service name; rejecting renders "API unreachable" (Review Focus #1). Use `@testing-library/react-native` if the template provides it, otherwise assert via the component's rendered output with `react-test-renderer`.

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter mobile test`
Expected: FAIL — cannot resolve `../api/health`.

- [ ] **Step 4: Implement `fetchHealth` and `HealthStatus`**

Same contract as Task 9's, differing only in reading `process.env.EXPO_PUBLIC_API_BASE_URL`. Use `View` and `Text`; do not introduce `react-native-web` or a shared UI package (deferred per the spec's Decisions table).

- [ ] **Step 5: Mount it in `App.tsx`**

Replace the template body with `<HealthStatus />` inside the existing `SafeAreaView`, keeping `StatusBar`.

- [ ] **Step 6: Verify tests and the bundle together**

Run: `pnpm --filter mobile test && pnpm --filter mobile exec tsc --noEmit && pnpm --filter mobile exec expo export --platform ios`
Expected: all exit 0. A bundle failure here means Metro cannot resolve `@repo/types` — re-run with `--clear` and confirm no `metro.config.js` exists.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(mobile): render api health from shared contract"
```

---

### Task 11: Turbo wiring, README, and full verification

**Files:**
- Modify: `turbo.json`, `package.json`, `README.md`

**Interfaces:**
- Consumes: every script defined in Tasks 5–10
- Produces: the workspace-level commands the spec's success criteria name, and the guarantee that `@repo/types` builds before anything consumes it

- [ ] **Step 1: Rewrite `turbo.json` tasks**

`build.outputs` becomes `["dist/**"]`. Add `"test": { "dependsOn": ["^build"] }` and change `check-types` to `"dependsOn": ["^build"]`. Both edges are what make a stale `@repo/types/dist` impossible in CI (Review Focus #4). Keep `dev` `cache: false, persistent: true`.

- [ ] **Step 2: Add the root `test` script**

Add `"test": "turbo run test"` alongside the existing `build`, `dev`, `lint`, and `check-types` scripts.

- [ ] **Step 3: Rewrite `README.md`**

Replace the create-turbo text. Document: the three apps and their ports, `corepack enable` as the first step, `pnpm install` from the root only, `pnpm dev` to run all three, the env vars `VITE_API_BASE_URL`, `EXPO_PUBLIC_API_BASE_URL`, and `CORS_ORIGIN`, and a note that the health fixture is scaffolding to be deleted.

- [ ] **Step 4: Verify the stale-dist guard actually works**

Run: `pnpm --filter types build`, then edit `packages/types/src/health.ts` to add a field to `HealthResponse`, then run `pnpm turbo run check-types` from a clean `.turbo` cache.
Expected: the api fails to compile because its `HealthResponse` no longer matches. Revert the edit and re-run to confirm green. Skipping this step leaves Review Focus #4 asserted only on paper.

- [ ] **Step 5: Run the full verification suite**

Run, in order, showing output for each: `pnpm install`, `pnpm turbo run check-types`, `pnpm turbo run test`, `pnpm turbo run lint`, `pnpm turbo run build`.
Expected: all exit 0, oxlint reports zero warnings, and `dist/` exists in `apps/web`, `apps/api`, and `packages/types`.

- [ ] **Step 6: Boot all three and confirm live data**

Start `pnpm turbo run dev`. Run `curl -i http://localhost:3000/api/health` (expect 200 and a `HealthResponse` body) and `curl -s http://localhost:5173` (expect the Vite HTML shell). Confirm `packages/types/dist` was rebuilt before the apps started. Stop the servers.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: wire turbo tasks and rewrite readme"
```
