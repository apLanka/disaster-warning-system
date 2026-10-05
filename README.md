# Disaster Warning System

A bun + Turborepo workspace holding three applications and one shared contract
package.

| Package | What it is | Dev port |
|---|---|---|
| `apps/web` | Vite 8 + React 19 + React Router 7 + Tailwind 4 | 5173 |
| `apps/api` | Nest 12 (ESM) | 3000 |
| `apps/mobile` | Expo 57 / React Native 0.86 | Expo dev server |
| `packages/types` | `@repo/types` — shared DTOs and constants, no runtime deps | — |

## Setup

Requires Node `>=22.13.0` and bun `1.2.20` or later version.

```sh
corepack enable          # or: npm i -g bun@1.2.20
bun install             # always from the repo root; one lockfile for the workspace
```

## Commands

Run from the root; turbo fans out across the workspace.

```sh
bun run dev            # all three dev servers
bun run build          # production builds
bun run test           # web + api (vitest) and mobile (jest)
bun run check-types    # tsc across every package
bun lint           # oxlint across every package
```

To run one app:

```sh
bun run --filter web dev
bun run --filter api dev
bun run --filter mobile dev
```

## Environment

| Variable | App | Default |
|---|---|---|
| `VITE_API_BASE_URL` | web | `http://localhost:3000` |
| `EXPO_PUBLIC_API_BASE_URL` | mobile | `http://localhost:3000` |
| `CORS_ORIGIN` | api | `http://localhost:5173` |
| `PORT` | api | `3000` |

The two client variables have different prefixes because Vite and Expo each
expose their own convention.

## The shared contract

`@repo/types` is compiled to `dist/` with declarations and consumed by all three
apps as a `workspace:*` dependency. Consumers get the built output, never the raw
TypeScript. `turbo` gives `test` and `check-types` a `dependsOn: ["^build"]` edge,
so the package is always rebuilt before anything that reads it — a contract change
surfaces as a type error in every app at once rather than as a runtime surprise in
one of them.

Metro needs no configuration. Expo SDK 52+ detects pnpm workspaces and wires up
module resolution itself; there is deliberately no `metro.config.js`. If Metro
ever misresolves, the fix is to remove any hand-written Metro properties and
re-run with `npx expo start --clear`.

## Temporary scaffolding

`GET /api/health` and the `HealthStatus` component in both clients exist to prove
the contract resolves in all three runtimes — Vite's bundler, Nest's `tsc`, and
Metro. They are not a feature. Replace them with the first real alert feature.
