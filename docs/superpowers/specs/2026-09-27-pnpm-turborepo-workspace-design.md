# Turborepo Workspace: Vite Web, Nest API, Expo Mobile

Date: 2026-09-27
Status: Approved (amended 2026-09-27 after scaffolder verification)

## Purpose

The `disaster-warning-system` repo is currently an untouched `create-turbo` scaffold
(one commit, no application code) holding two Next.js templates that are unused.
This change replaces them with the three applications the project actually needs
and switches the workspace from bun to pnpm, so that a shared contract package can
back all three runtimes.

Success criteria:

- `apps/web` (Vite + React + TS), `apps/api` (Nest), `apps/mobile` (Expo) all exist
  and start from a single `pnpm install` at the root.
- `pnpm turbo run check-types`, `test`, and `build` pass across the workspace.
- All three dev servers run concurrently; the web and mobile clients render live
  data fetched from the Nest API, typed by a shared `@repo/types` package.

Out of scope: any real disaster-warning domain logic. Alerts exist only as a
typed fixture to prove the contract holds across the three runtimes.

## Context and constraints

- **Context7 is unavailable.** No MCP server is registered in `~/.pi/agent/settings.json`,
  so the `resolve-library-id` / `query-docs` tools do not exist in this session.
  Version facts below were taken from `registry.npmjs.org` via `npm view`; the Metro
  behaviour was read from `https://docs.expo.dev/guides/monorepos/`. If Context7 is
  registered later, re-verify before implementing.
- **Toolchain gap.** `pnpm` and the Nest CLI are not installed. `bun` and Node 22.19.0
  are present. The root `package.json` currently pins `engines.node: ">=24"` and a
  `devEngines` bun block, neither of which matches the machine or the target stack.
- **Node compatibility (verified from registry `engines`):**

  | Package | Required Node | 22.19.0 OK |
  |---|---|---|
  | `react-native@0.87.1` | `^22.13.0 \|\| ^24.3.0 \|\| >=26.0.0` | yes |
  | `vite@8.3.1` | `^20.19.0 \|\| >=22.12.0` | yes |
  | `vitest@5.0.2` | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | yes |
  | `@nestjs/core@12.1.0` | `>= 20` | yes |

  So the `>=24` engine constraint is relaxed rather than a new Node installed.
- **Scaffolder reality (verified by reading the published template tarballs, which
  supersedes several assumptions made before this amendment):**

  | Scaffolder | Version | Notable defaults |
  |---|---|---|
  | `create-vite` | 9.2.1 | react-ts template: `vite ^8.3.0`, `react ^19.2.8`, `typescript ~6.0.2`, `"lint": "oxlint"`, ships `_oxlintrc.json`, **no test runner** |
  | `@nestjs/cli` / `@nestjs/schematics` | 12.0.7 / 12.0.5 | `new` defaults to `type: 'esm'` (`application.factory.js`), selecting the `ts-esm` template: `"type": "module"`, `"test": "vitest run"`, ships `vitest.config.ts`, `"lint": "oxlint --type-aware src/ test/"`, `supertest` + `@nestjs/testing` in devDependencies, `typescript ^6.0.2` |
  | `create-expo-app` / `expo-template-blank-typescript` | 5.0.0 / 57.0.27 | `expo ~57.0.25`, `react-native 0.86.3`, `react 19.2.3`, `typescript ~6.0.3` |

  Consequences, all confirmed by the human partner:
  - **oxlint replaces ESLint workspace-wide.** Both Vite and Nest templates now emit
    oxlint; the repo's `@repo/eslint-config` is deleted rather than hand-adapted.
  - **Nest needs no Jest-to-Vitest migration.** The default ESM template is already
    Vitest-based, so the previously planned migration is dropped as unnecessary work.
  - **TypeScript is pinned to `~6.0.3` workspace-wide** (root, all apps, and
    `packages/types`), matching all three templates. The root's previous
    `typescript: 7.0.2` is downgraded; TS 7 is the native port and is not what any of
    the three toolchains are validated against.
  - **Expo's pinned `react-native 0.86.3` / `react 19.2.3` are taken as-is** rather than
    force-upgraded to latest during a scaffold commit.
- **Other current versions:** `vite@8.3.1`, `@vitejs/plugin-react@6.1.1`,
  `@nestjs/core@12.1.0`, `react-router-dom@7.18.4`, `tailwindcss@4.3.3`,
  `vitest@5.0.2`, `turbo@2.11.4`, `pnpm@12.6.0`, `supertest@7.3.0`.
- **Expo monorepo support is automatic at this SDK.** Per Expo's monorepo guide, SDK
  52+ detects pnpm workspaces and configures Metro itself; the manual `watchFolders` /
  `resolver.nodeModulesPaths` recipe is the pre-SDK-52 path. No `metro.config.js` is
  written, and none should be added later without re-reading that guide.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Topology | All three apps in one pnpm workspace + turbo | Shared contract across web, api, and native is the reason to use a monorepo |
| `packages/` | `types`, `typescript-config` | `@repo/types` is the payoff; a shared UI lib needs platform-split entry points and `react-native-web`, deferred |
| Linting | oxlint everywhere; delete `@repo/eslint-config` | Both scaffolders now emit oxlint; ESLint 10 config would be hand-written for three toolchains to no benefit |
| TypeScript | `~6.0.3` workspace-wide | The version all three scaffolder templates agree on; TS 7 is unvalidated against these toolchains |
| Nest module system | ESM, as scaffolded | `nest new` defaults to it and it already ships Vitest |
| Delete | `apps/web` (Next), `apps/docs`, `packages/ui` | Unused boilerplate from `create-turbo` |
| Shared types distribution | Compiled `dist/` + declarations | Raw TS source breaks Nest's `tsc` rootDir and yields no declarations |
| Scope | Scaffolding plus a thin proof-of-wiring slice | Nothing else verifies Metro and the shared types until real features land |
| Web stack | React Router 7, Tailwind 4 | Approved as defaults |
| Tests | Vitest for web and api; Expo default for mobile | Consistent across the two Node apps |
| Metro config | None | Automatic at SDK 57 |

## Layout

```
apps/
  web/      Vite 8 + React 19 + TS, React Router 7, Tailwind 4
  api/      Nest 12 (ESM, Vitest)
  mobile/   Expo 57 / React Native 0.86
packages/
  types/    @repo/types — shared DTOs and enums, no runtime dependencies
  typescript-config/
docs/superpowers/specs/
docs/superpowers/plans/
```

## Root configuration

- Delete `bun.lock` and the empty `.npmrc`.
- Root `package.json`: drop `workspaces` (pnpm ignores it) and `devEngines`; set
  `engines.node` to `>=22.13.0`; set `packageManager` to `pnpm@12.6.0`, pinned to an
  exact version rather than a range; change `typescript` from `7.0.2` to `~6.0.3`.
- Add `pnpm-workspace.yaml` with `packages: [apps/*, packages/*]` and an
  `onlyBuiltDependencies` allowlist. pnpm >= 10 skips lifecycle build scripts by
  default, and Vite's esbuild binary is delivered by postinstall: without the
  allowlist, `pnpm install` succeeds and `vite` then fails at startup. Entries are
  added reactively from actual install output rather than guessed up front.
- `turbo.json`: `build.outputs` changes from `.next/**` to `dist/**`; add a `test`
  task; keep `dev` persistent and uncached; keep `dependsOn: ["^build"]` so
  `@repo/types` is built before dependents compile or run. `lint` keeps calling each
  app's own `lint` script, which is now `oxlint` everywhere.

## Scaffolding sequence

Scaffold with git init and nested installs suppressed, then run one root install so
the repo ends with a single lockfile:

1. Delete `apps/web`, `apps/docs`, `packages/ui`, and `packages/eslint-config`; prune
   `nextjs.json` and `react-library.json` from `typescript-config`.
2. `pnpm create vite@latest apps/web --template react-ts`
3. `pnpm create @nestjs/cli@latest api --directory apps/api --package-manager pnpm
   --skip-git --skip-install --no-observe` — `--skip-install` avoids a nested
   lockfile, and `--no-observe` is required because `nest new` otherwise prompts
   interactively about `@nestjs/observe`, which would hang a non-interactive run.
4. `pnpm create expo-app apps/mobile` (per Expo's documented pnpm command)
5. Create `packages/types` by hand; add it as a `workspace:*` dependency of all three apps.
6. `pnpm install` once, at the root.
7. Rewire each app's tsconfig to extend `@repo/typescript-config`, adding `vite.json`
   and `nest.json` presets alongside `base.json`.

## Proof-of-wiring slice

`@repo/types` exports:

- `HealthResponse` — `status`, `service`, `timestamp`
- `Alert` — `id`, `severity`, `message`, returned as a fixture

`GET /api/health` returns a `HealthResponse`. CORS allows the Vite dev origin
(`http://localhost:5173`), read from an environment variable. React Native's `fetch` is
not subject to browser CORS, so the mobile client needs no origin grant. The web app fetches and renders the
status; the mobile app does the same. Both import the response type from
`@repo/types`, so a contract mismatch surfaces as a type error rather than a runtime
surprise. This fixture is expected to be deleted once a real feature replaces it.

## Error handling

Scope-appropriate, not aspirational:

- The API returns a `HealthResponse` with `status: "degraded"` and HTTP 503 when its
  own dependency check fails, rather than throwing an unhandled rejection.
- The web and mobile clients render a visible "API unreachable" state when the fetch
  rejects; neither client may show a blank screen on network failure.
- CORS origins come from a single environment variable, not a hardcoded list.

## Testing

- `apps/api`: Vitest (already scaffolded, with `supertest` and `@nestjs/testing` in
  devDependencies) covering the 200 and 503 health paths.
- `apps/web`: Vitest, which the Vite template does **not** scaffold and must be added,
  covering the health fetch's success and failure rendering.
- `apps/mobile`: Expo's default test setup, untouched.
- Workspace-level: `turbo run test` and `turbo run check-types` must pass.

## Verification

Before reporting completion, run and show output for:

1. `pnpm install` (watch for blocked build scripts)
2. `pnpm turbo run check-types`
3. `pnpm turbo run test`
4. `pnpm turbo run build`
5. Boot all three dev servers; `curl` the API and confirm both clients compiled their
   `@repo/types` import — the actual test of the Metro and tsconfig wiring.

## Risks

- **Stale `@repo/types/dist`.** Consuming compiled output means a source edit is not
  picked up until the package rebuilds. `turbo`'s `dependsOn: ["^build"]` covers
  `dev` and `build`; `check-types` will not, and may report against a stale `dist`.
- **Expo monorepo detection.** Automatic at SDK 57, but if Metro fails to resolve
  `@repo/types`, the documented remedy is to remove any hand-written Metro properties
  and re-run with `--clear` to drop a stale cache.
- **pnpm build-script allowlist.** An incomplete `onlyBuiltDependencies` surfaces as a
  confusing runtime failure, not an install error. Expect to add entries on first run.
- **Node 22 vs 24.** Relaxing `engines` to `>=22.13.0` is safe for the current package
  set, but future majors may require 24; this is a deliberate, reversible choice.
- **TypeScript downgrade.** Root moves from `7.0.2` to `~6.0.3`. Anything in the repo
  relying on TS 7 behaviour would break, but the only existing TypeScript is the
  create-turbo boilerplate being deleted.
- **Nest ESM in a pnpm workspace.** The `ts-esm` template emits `"type": "module"`
  with decorator metadata (`emitDecoratorMetadata`). This is the officially supported
  template, but it is the least-trodden of the three stacks here; if `nest build` or
  runtime fails, the CJS `ts` template is the fallback and the cost is migrating its
  Jest setup to Vitest.
