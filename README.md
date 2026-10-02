# CollabDraw

A real-time collaborative whiteboard. Create a room, share the link, and draw together: everyone sees each other's shapes, cursors and messages live.

## Features

- **Drawing tools**: pencil, rectangle, circle, line, arrow, text and eraser, with 9 colours and adjustable stroke width.
- **Select and move**: click a shape to select it, drag to move it, press Delete to remove it.
- **Real-time sync**: shapes, live cursors and who's in the room, over WebSockets.
- **Shared undo/redo**: Ctrl+Z / Ctrl+Y undo *your* last change for everyone, and it's saved.
- **Persistent rooms**: reload or come back later and the drawing is exactly as you left it.
- **Chat**: a chat panel per room, with an unread badge.
- **Export**: download the whole drawing as a PNG.
- **Private rooms**: invite-only rooms; the owner invites people by email and can remove them.
- **Infinite canvas**: pan (Space + drag or middle mouse) and zoom (wheel, Ctrl +/-, Ctrl 0 to reset).
- **Reconnects automatically**: if the connection drops, keep drawing; changes sync when it's back.

## Architecture

```
apps/
  frontend/       Next.js app (port 3000): pages, canvas engine (draw/), UI
  http-backend/   Express REST API (port 3001): auth, rooms, members, room history
  ws-backend/     WebSocket server (port 8080): live drawing ops, cursors, presence, chat
packages/
  db/             Prisma schema, migrations, client and shared access rules
  common/         Zod schemas shared by the API
  backend-common/ Shared backend config (JWT secret/expiry, loaded from env)
  typescript-config/
```

Each change to a canvas is a small **op** (`add`, `update` or `delete` a shape by id). The client applies it immediately and sends it over the WebSocket. The server stores it and forwards it to everyone else in the room. Loading a room replays its stored ops in order. Undo and redo are just more ops, so they sync and persist like everything else. See [CollabDraw.md](./CollabDraw.md) for the protocol, API and data model.

## Getting started

### With Docker (quickest)

```sh
cp .env.example .env        # then set JWT_SECRET, e.g. `openssl rand -base64 48`
docker compose up --build
```

Open http://localhost:3000. This starts Postgres, applies migrations, and runs both backends and the frontend.

### Locally

Requirements: Node 18+ (22 recommended), pnpm 9, and PostgreSQL.

```sh
pnpm install                # also generates the Prisma client
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
pnpm db:migrate             # create/update the database tables
pnpm dev                    # frontend :3000, HTTP API :3001, WebSocket :8080
```

The backends read `.env` from the repo root. For the frontend, `NEXT_PUBLIC_HTTP_BACKEND` and `NEXT_PUBLIC_WS_URL` default to localhost; set them in `apps/frontend/.env.local` if your backends live elsewhere.

### Configuration

All variables are documented in [.env.example](./.env.example). The important ones:

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | backends, migrations | PostgreSQL connection string |
| `JWT_SECRET` | backends | **Required.** Long random string; the servers refuse to start without it |
| `JWT_EXPIRES_IN` | http-backend | Token lifetime, default `7d` |
| `CORS_ORIGIN` | http-backend | Allowed frontend origin(s), comma-separated |
| `AUTH_RATE_LIMIT` | http-backend | Sign-in/up attempts per IP per 15 min, default 10 |
| `NEXT_PUBLIC_HTTP_BACKEND`, `NEXT_PUBLIC_WS_URL` | frontend | Public URLs of the backends, baked in at build time |

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run all apps in watch/dev mode |
| `pnpm build` | Build everything (Turborepo handles the order) |
| `pnpm test` | Unit and integration tests (Vitest) |
| `pnpm lint` / `pnpm check-types` | Lint and type-check |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:migrate:dev` | Create a new migration after editing `schema.prisma` |

CI (GitHub Actions) runs lint, type checks, tests and the build on every pull request. It also checks that the migrations produce exactly `schema.prisma`, so a schema change can't ship without its migration.

## Upgrading an existing deployment

- Set a new `JWT_SECRET` in the environment. Earlier versions used a hardcoded secret that is in the repo's history, so treat it as leaked. Everyone will need to sign in again.
- Run `pnpm db:migrate`. If you previously ran `packages/db/migrate.js` by hand, the new migrations still apply cleanly.
- Existing drawings keep working: the old storage format is still understood when rooms load.
