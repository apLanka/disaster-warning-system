# API

NestJS API for hazard reports: citizens submit, a Duty Officer verifies or rejects, and the citizen is notified. Data is in MongoDB Atlas (through Prisma 6, which is the last major version that supports MongoDB), and photos are in Cloudinary.

## Setup

1. Create two Atlas databases, for example `dws_dev` and `dws_test`, and allow your IP address.
2. Copy the example environment file and fill in every value:

   ```bash
   cp .env.example .env
   ```

   `DATABASE_URL_TEST` must point at a database whose name contains "test". Integration tests wipe it, and refuse to run against anything else.

3. Install, generate the Prisma client, and create the collections and indexes:

   ```bash
   bun install
   bun run prisma:push        # dws_dev
   bun run prisma:push:test   # dws_test
   ```

## Run

```bash
bun run start:dev     # http://localhost:3000, docs at /api/docs
```

The web portal needs `VITE_OFFICER_KEY` to equal `OFFICER_API_KEY`. A phone cannot reach `localhost`: set `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env.local` to your computer's address.

## Test

```bash
bun run test        # unit tests; database suites skip if DATABASE_URL_TEST is unset
bun run test:cov    # fails below 80% overall or in hazard-reports/ and notifications/
```

## Endpoints

| Method and path                        | Who                            | Purpose                                                                           |
| -------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| `POST /api/hazard-reports`             | citizen                        | Submit (multipart, up to 5 photos). 201, or 200 for a replayed `clientRequestId`. |
| `GET /api/hazard-reports/mine`         | citizen                        | Own reports                                                                       |
| `GET /api/hazard-reports/:id`          | officer, or the owning citizen | One report                                                                        |
| `GET /api/hazard-reports`              | officer                        | List with `status`, `type`, `sort`, `page`, `limit`                               |
| `GET /api/hazard-reports/stats`        | officer                        | Counts                                                                            |
| `PATCH /api/hazard-reports/:id/verify` | officer                        | Verify (409 if already decided)                                                   |
| `PATCH /api/hazard-reports/:id/reject` | officer                        | Reject with a reason (409 if already decided)                                     |
| `GET /api/notifications`               | citizen                        | Results, optionally `?unread=true`                                                |
| `PATCH /api/notifications/:id/read`    | citizen                        | Mark read                                                                         |

## Identity is a stand-in

Login is out of scope. Citizens send a device-generated UUID in `x-reporter-id`. Officers send `x-officer-key`, which must equal `OFFICER_API_KEY` (and optionally `x-officer-name`). Neither is real authentication.
