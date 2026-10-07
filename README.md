# Disaster Warning System

A bun + Turborepo workspace holding three applications and one shared contract
package.

| Package          | What it is                                                | Dev port        |
| ---------------- | --------------------------------------------------------- | --------------- |
| `apps/web`       | Vite 8 + React 19 + React Router 7 + Tailwind 4           | 5173            |
| `apps/api`       | Nest 12 (ESM)                                             | 3000            |
| `apps/mobile`    | Expo 57 / React Native 0.86                               | Expo dev server |
| `packages/types` | `@repo/types`: shared DTOs and constants, no runtime deps | —               |

## Quick start

Requires Node `>=22.13.0` and bun `1.2.20` or later. For the phone app you also need Xcode (iOS simulator) or the Expo Go app on a real phone.

You also need two accounts, both free:

- **MongoDB Atlas**: a cluster with two databases, `dws_dev` (the app) and `dws_test` (automated tests).
- **Cloudinary**: where report photos are stored.

```sh
bun install                         # always from the repo root; one lockfile for the workspace
cp apps/api/.env.example apps/api/.env              # then fill it in (see Configuration)
cp apps/web/.env.example apps/web/.env.local        # then fill it in
cd apps/api && bun run prisma:push && cd ../..      # creates the collections and indexes in dws_dev
```

Then start the three apps, each in its own terminal, **API first**:

```sh
bun run --filter api dev        # 1. http://localhost:3000   (docs at /api/docs)
bun run --filter web dev        # 2. http://localhost:5173   (the DMC Portal for officers)
bun run --filter mobile dev     # 3. Expo; press i for the iOS simulator, or scan the QR code with Expo Go
```

Check it works: open `http://localhost:3000/api/health` (it should say `"status":"ok"`), then the portal, then submit a report from the phone app and refresh the portal's pending list.

## Configuration

Nothing secret is committed. Each app reads its own file, and each has a `.env.example` to copy.

### API: `apps/api/.env`

| Variable                | Required  | What to put                                                                                       |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | yes       | Atlas connection string with the database name in the path, ending `/dws_dev?...`                 |
| `DATABASE_URL_TEST`     | for tests | Same cluster, database name containing `test`, e.g. `/dws_test?...`. Tests refuse any other name. |
| `OFFICER_API_KEY`       | yes       | Any random string of 16+ characters (`openssl rand -hex 24`). Stand-in for officer login.         |
| `CLOUDINARY_CLOUD_NAME` | yes       | From the Cloudinary dashboard                                                                     |
| `CLOUDINARY_API_KEY`    | yes       | From the Cloudinary dashboard                                                                     |
| `CLOUDINARY_API_SECRET` | yes       | From the Cloudinary dashboard. Server only: never put it in the web or mobile app.                |
| `PORT`                  | no        | Default `3000`                                                                                    |
| `CORS_ORIGIN`           | no        | Web origin allowed to call the API. Default `http://localhost:5173`                               |

The API validates these at start-up and lists every problem at once. In Atlas, add your IP address under Network Access, or the connection will time out.

### Web: `apps/web/.env.local`

| Variable            | What to put                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:3000`                                                                                                                                        |
| `VITE_OFFICER_KEY`  | **The same value as `OFFICER_API_KEY`.** Without it every portal request is rejected with 401. It ends up in the built JavaScript, so it is not a real secret. |
| `VITE_OFFICER_NAME` | Name recorded on decisions. Default `Duty Officer`.                                                                                                            |

### Mobile: `apps/mobile/.env.local`

| Variable                   | What to put                                                                  |
| -------------------------- | ---------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL` | Default `http://localhost:3000`, which works for the **iOS simulator only**. |

On a **real phone**, `localhost` means the phone itself. Use your computer's address on the same Wi-Fi:

```sh
ipconfig getifaddr en0                                   # e.g. 192.168.2.216
echo 'EXPO_PUBLIC_API_BASE_URL=http://192.168.2.216:3000' > apps/mobile/.env.local
```

Restart Expo after changing it. The phone and computer must be on the same network, and your firewall must allow port 3000. The app asks for location (and the camera, if you take a photo); allow location or it will show how to open Settings.

## Running each app

| App    | Command                       | Notes                                                                                                |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| API    | `bun run --filter api dev`    | Must be running first. Reloads on change.                                                            |
| Web    | `bun run --filter web dev`    | Officer pages: Pending, Verified and Rejected reports, and a review page with the decision.          |
| Mobile | `bun run --filter mobile dev` | In the iOS simulator, set a location first: Simulator menu, Features, Location. Press `r` to reload. |

`bun run dev` starts all three through turbo, but turbo's combined terminal makes Expo's key prompts awkward, so separate terminals are easier.

## Try the whole flow

1. **Phone:** Home, Report a Hazard, choose a type, describe it, optionally add a photo, Review report, Submit Report.
2. **Portal:** Pending Reports shows it. Open it, add a note, then Verify, or choose a reason and Reject (it asks to confirm).
3. **Phone:** open Home or the Reports tab. The result shows as a notice on Home and in the report's status.
4. **Offline:** stop the API and submit again. The phone shows "Report Saved / Pending Synchronization". Start the API and it sends by itself (retries start at 30 s and back off to 15 min).

### Post-disaster analysis (portal only)

After `bun run prisma:push` and `cd apps/api && bun run seed:analysis`, open **Analysis & Reports** in the portal. Pick a completed event, choose all districts or one, and read the report (Overview, Shelter Occupancy, Resource Distribution). The data is generated sample data and the portal says so. Event 6 (Batticaloa Flood) fails on purpose to show the retry path. See `apps/api/README.md` for the seven events.

## Commands

Run from the root; turbo fans out across the workspace.

```sh
bun run dev            # all three dev servers
bun run build          # production builds
bun run test           # api, web (vitest) and mobile (jest)
bun run check-types    # tsc across every package
bun run lint           # oxlint across every package (warnings fail)
bun run format:check   # prettier
```

Coverage (fails below 80%) is run per app: `bun run test:cov` inside `apps/api`, `apps/web` or `apps/mobile`. Database suites in the API skip themselves unless `DATABASE_URL_TEST` is set, and they wipe that database, so never point it at real data.

Git hooks run automatically after `bun install`: pre-commit formats and lints, pre-push also type-checks. Do not bypass them.

## Troubleshooting

| Symptom                                               | Cause and fix                                                                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| API exits with "Invalid environment"                  | A variable in `apps/api/.env` is missing or still a `<placeholder>`. The message lists each one.                              |
| API cannot connect, or hangs on start                 | Your IP is not allowed in Atlas Network Access, or the password in `DATABASE_URL` needs URL-encoding.                         |
| `EADDRINUSE: address already in use :::3000`          | An old API is still running. `lsof -nP -iTCP:3000 -sTCP:LISTEN`, then `kill <pid>`.                                           |
| Portal shows "not authorised"                         | `VITE_OFFICER_KEY` is empty or differs from `OFFICER_API_KEY`. Restart the web dev server after editing.                      |
| Portal shows "Cannot reach the server"                | API is not running, or `CORS_ORIGIN` does not match the portal's address.                                                     |
| Phone saves every report as "Pending Synchronization" | It cannot reach the API: wrong `EXPO_PUBLIC_API_BASE_URL` (see above) or the API is stopped. Reports are kept and sent later. |
| Photo upload fails with 502                           | Check the three `CLOUDINARY_*` values.                                                                                        |
| Expo says port 8081 is in use                         | Another Expo is already running. Use it, or stop it first.                                                                    |
| Type errors about `@repo/types` after pulling         | Rebuild it: `bun run --filter @repo/types build`.                                                                             |

## The shared contract

`@repo/types` is compiled to `dist/` with declarations and consumed by all three
apps as a `workspace:*` dependency. Consumers get the built output, never the raw
TypeScript. `turbo` gives `test` and `check-types` a `dependsOn: ["^build"]` edge,
so the package is always rebuilt before anything that reads it — a contract change
surfaces as a type error in every app at once rather than as a runtime surprise in
one of them.

Metro needs no configuration. Expo detects bun workspaces and wires up
module resolution itself; there is deliberately no `metro.config.js`. If Metro
ever misresolves, the fix is to remove any hand-written Metro properties and
re-run with `npx expo start --clear`.
