# CollabDraw - Agent Instructions

## Project Overview

CollabDraw is a **real-time collaborative drawing application** that allows multiple users to draw together on a shared canvas in real-time. Users can create public or private rooms, invite others, and collaborate on the same canvas with drawing tools, colors, select/move, shared undo/redo, chat, PNG export, zoom/pan and live cursors.

---

## What This Project Is About

### Core Functionality
- **Real-time collaborative drawing**: Multiple users can draw on the same canvas simultaneously
- **Room-based collaboration**: Users create or join rooms (identified by slugs)
- **Private rooms**: Invite-only rooms; the admin invites members by email
- **Live presence and cursors**: See who is in the room and where their cursor is
- **Shape drawing tools**: Rectangle, circle, line, arrow, freehand (pencil), text, eraser
- **Select tool**: Select a shape, drag to move it, Delete/Backspace to remove it
- **Shared undo/redo**: Each user undoes their own actions; undo/redo is synced and persisted
- **Chat**: Text chat per room, stored with the room history
- **Export**: Download the whole drawing as a PNG
- **Zoom and pan**: Zoom in/out (10% - 2000%) and pan around the canvas
- **Reconnect**: The client reconnects with backoff and syncs anything drawn while offline

### User Flow
1. **Sign Up**: Create an account with email (username), password (8+ chars) and display name
2. **Sign In**: Authenticate to get a JWT token (expires after `JWT_EXPIRES_IN`, default 7 days)
3. **Create/Join Room**: Create a public or private room, or open an existing one by slug
4. **Collaborate**: Draw, move, erase, undo and chat with everyone in the room
5. **Share**: Copy the room URL; for private rooms, invite people from the Rooms page

---

## Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **HTML5 Canvas API** - For drawing functionality

### Backend Services
- **Express.js 5** (Port 3001) - REST API for auth, rooms, members and room history
- **WebSocket** (ws library, Port 8080) - Real-time drawing ops, cursors, presence and chat

### Database
- **PostgreSQL** - Relational database
- **Prisma** - ORM and migrations

### Shared Packages
- **@repo/common** - Zod schemas for input validation
- **@repo/backend-common** - Backend config from env (`JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_ALGORITHM`)
- **@repo/db** - Prisma client, schema, migrations and the shared room access rules (`canAccessRoom`, `visibleRoomsWhere`)
- **@repo/typescript-config** - Shared tsconfig presets

### Build Tools
- **pnpm** - Package manager
- **Turborepo** - Monorepo build orchestration
- **Vitest** - Tests (frontend logic, HTTP API, WebSocket server, schemas)
- **ESLint / Prettier** - Linting and formatting
- **Docker / docker-compose** - Containerised deployment
- **GitHub Actions** - CI (lint, types, tests, build, migration drift check)

---

## Project Structure

```
CollabDraw/
├── apps/
│   ├── frontend/          # Next.js frontend (port 3000)
│   │   ├── app/           # App Router pages (/, /signin, /signup, /rooms, /canvas/[roomId])
│   │   ├── components/    # Canvas, RoomCanvas, ChatPanel, MembersPanel, AuthPage, ...
│   │   ├── draw/          # Game.ts (canvas engine), shapes.ts (ops + replay), geometry.ts, http.ts
│   │   ├── lib/           # Small helpers (auth token, API error formatting)
│   │   └── config.ts      # Backend URLs from NEXT_PUBLIC_* env vars
│   ├── http-backend/      # Express REST API (port 3001)
│   │   ├── src/app.ts     # Routes (createApp)
│   │   ├── src/index.ts   # Server entry
│   │   └── test/          # supertest tests
│   └── ws-backend/        # WebSocket server (port 8080)
│       ├── src/server.ts  # createWsServer
│       ├── src/index.ts   # Server entry
│       └── test/          # socket-level tests
├── packages/
│   ├── common/            # Zod validation schemas
│   ├── backend-common/    # Env-based backend config
│   ├── db/                # Prisma schema, migrations, client, access rules
│   └── typescript-config/
├── Dockerfile             # One image per service via --target
├── docker-compose.yml     # Postgres + migrate + backends + frontend
├── .env.example           # Every environment variable, documented
├── turbo.json
└── package.json
```

---

## Database Schema

**User**
| Field    | Type    | Description              |
|----------|---------|--------------------------|
| id       | String  | UUID, auto-generated     |
| email    | String  | Unique, used as username |
| password | String  | Bcrypt hashed            |
| name     | String  | Display name             |
| photo    | String? | Optional avatar URL      |

**Room**
| Field     | Type     | Description                               |
|-----------|----------|-------------------------------------------|
| id        | Int      | Auto-increment                            |
| slug      | String   | Unique room name, used in URLs            |
| createdAt | DateTime | Auto-set to creation time                 |
| adminId   | String   | User who created the room                 |
| isPrivate | Boolean  | Private rooms are for admin + members only |

**RoomMember** (invites to private rooms; deleted with the room or user)
| Field     | Type     | Description               |
|-----------|----------|---------------------------|
| id        | Int      | Auto-increment            |
| roomId    | Int      | Room.id                   |
| userId    | String   | User.id                   |
| createdAt | DateTime | When they were invited    |

Unique on `(roomId, userId)`.

**Chat** (the room's history: every drawing op and chat message)
| Field   | Type   | Description                                  |
|---------|--------|----------------------------------------------|
| id      | Int    | Auto-increment; defines replay order         |
| roomId  | String | Room **slug** (foreign key to Room.slug)     |
| message | String | JSON-encoded op (see "Room messages" below)  |
| userId  | String | Author                                       |

Change the schema with `pnpm db:migrate:dev` (creates a migration). CI fails if `schema.prisma` and the migrations disagree.

---

## API Endpoints

Errors are JSON `{ message }`. Validation errors are `400` with `{ message, errors: { field: [msg] } }`. Protected routes take `Authorization: Bearer <token>` and return `401` for a missing, invalid or expired token.

### Authentication (rate limited per IP: `AUTH_RATE_LIMIT` per 15 min, then 429)

**POST /signup** - `{ username, password, name }` → `201 { userId }`; `409` if the username is taken.

**POST /signin** - `{ username, password }` → `{ token, name }`; `401` for a wrong username or password.

### Rooms

**POST /room** (protected) - `{ name, isPrivate? }` → `201 { room: { id, slug, isPrivate } }`; `409` if the name is taken. Names are 3-50 chars of letters, digits, `-` and `_`.

**GET /rooms** (optional auth) - Public rooms, plus private rooms the caller owns or is a member of.

**GET /room/:slug** (optional auth) - `{ room }`; `404` unknown, `403` private and no access.

**PATCH /room/:id** (admin) - `{ isPrivate }` → `{ room }`.

**DELETE /room/:id** (admin) - Deletes the room, its history and members.

### Members (admin of the room only)

**GET /room/:id/members** → `{ members: [{ userId, name, username }] }`

**POST /room/:id/members** - `{ username }` → `201 { member }`; `404` no such user, `409` already a member.

**DELETE /room/:id/members/:userId** → `{ message }`; `404` if not a member.

### History

**GET /chats/:roomId** (protected, room access required) - Every stored message for the room slug, **oldest first**, no limit. Clients replay it to rebuild the canvas and chat.

---

## WebSocket Protocol

Connect to `ws://<host>:8080?token=<jwt>`. A bad token closes the socket with code **4001**. Messages from one connection are handled in order.

### Client → Server

```json
{ "type": "join_room", "roomId": "slug" }
{ "type": "leave_room", "roomId": "slug" }
{ "type": "cursor", "roomId": "slug", "cursor": { "x": 100, "y": 200 } }
{ "type": "chat", "roomId": "slug", "message": "<JSON room message>" }
```

`chat` carries every persisted room message (drawing ops and chat text), and is only accepted after a successful `join_room`.

### Server → Client

```json
{ "type": "joined", "roomId": "slug" }
{ "type": "error", "code": "room_not_found" | "forbidden" | "not_in_room", "roomId": "slug", "message": "..." }
{ "type": "presence", "roomId": "slug", "users": [{ "userId": "...", "userName": "..." }] }
{ "type": "cursor", "roomId": "slug", "userId": "...", "userName": "...", "cursor": { "x": 1, "y": 2 } }
{ "type": "chat", "roomId": "slug", "message": "<JSON room message>" }
```

- Presence goes to everyone in the room, including the user who joined. Each user appears once, however many tabs they have open.
- Drawing ops are forwarded to everyone in the room **except the sending connection**, which already applied them.
- Chat messages are forwarded to everyone **including** the sender, because the server adds the id, name and timestamp.

### Room messages (the `message` string, also what is stored in `Chat.message`)

```json
{ "op": "add",    "shape": { "id": "...", "type": "rect", ... } }
{ "op": "update", "shape": { "id": "...", ... } }
{ "op": "delete", "ids": ["...", "..."] }
{ "op": "chat",   "id": "...", "text": "hi", "userId": "...", "userName": "Ann", "sentAt": "ISO date" }
```

- Ops are idempotent by shape id: re-adding an existing id replaces it, deleting a missing id does nothing, and updating a deleted shape does nothing.
- For `chat`, clients send only `{ "op": "chat", "text": "..." }`. The server rebuilds the message with its own id, the sender's real name and a timestamp, and caps the text at 1000 characters.
- Legacy rows from before shapes had ids (`{ "shape": {...} }` and full snapshots `{ "shapes": [...] }`) are still understood when a room loads.

---

## Drawing

### Tools
Select, Pencil, Rectangle, Circle, Line, Arrow, Eraser, Text.

### Shape Types (all have an `id` and `strokeColor`)
- **rect**: `x, y, width, height, strokeWidth` (width/height may be negative)
- **circle**: `centerX, centerY, radius, strokeWidth`
- **pencil**: `points: [{x, y}, ...], strokeWidth`
- **line** / **arrow**: `startX, startY, endX, endY, strokeWidth`
- **text**: `x, y` (baseline), `text, fontSize`

Coordinates are world coordinates, independent of zoom and pan.

### Color Palette
```
#ffffff, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #2563eb, #ec4899
```

### How sync works (`apps/frontend/draw`)
1. `RoomCanvas` opens the socket, sends `join_room`, and waits for `joined`. It shows "room not found" or "private" pages on those errors, redirects to sign-in on close code 4001, and reconnects with exponential backoff otherwise.
2. `Game` loads `/chats/:roomId` and replays it (`replayRoom` in `shapes.ts`). Ops that arrive while it loads are queued and reapplied on top.
3. Every local change is an op: applied locally with `applyOp`, then sent. Ops made while disconnected go into an outbox and are sent after reconnecting, followed by a reload of the room.
4. Undo/redo is a per-user stack of `{ undo: ops, redo: ops }`. Undoing sends the inverse ops, so it syncs and persists. Other users' changes are never undone.
5. The eraser sends deletes live while dragging and records the whole stroke as one undo step. The select tool sends one `update` when the drag ends.

### Keyboard shortcuts
- Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo
- Delete/Backspace deletes the selected shape, Escape clears the selection
- Space + drag (or middle mouse) to pan; wheel to zoom; Ctrl +/-/0 to zoom in/out/reset
- Shortcuts are ignored while typing in an input (text tool, chat).

---

## Commands

```bash
pnpm install          # install deps and generate the Prisma client
pnpm db:migrate       # apply migrations (needs DATABASE_URL)
pnpm dev              # all apps in dev mode
pnpm build            # build everything
pnpm test             # all tests
pnpm lint             # lint
pnpm check-types      # type-check
pnpm format           # prettier

docker compose up --build   # whole stack with Postgres (set JWT_SECRET in .env)
```

---

## Important Notes

- **Environment**: See `.env.example`. `JWT_SECRET` is required; the backends refuse to start without it. Backends load `.env` from their own folder or the repo root.
- **Frontend URLs**: `NEXT_PUBLIC_HTTP_BACKEND` / `NEXT_PUBLIC_WS_URL` are inlined at build time.
- **Room history** lives in the `Chat` table as JSON ops, keyed by room slug, and is replayed in id order.
- **Access control**: Use `canAccessRoom` / `visibleRoomsWhere` from `@repo/db` for anything that reads or writes a room.

---

## Security Considerations

- Passwords hashed with bcrypt (10 rounds); 8-128 characters on sign-up
- JWTs signed with HS256 from `JWT_SECRET` (env), expiring after `JWT_EXPIRES_IN`; verification is pinned to HS256
- Sign-in/sign-up rate limited per IP; set `TRUST_PROXY` behind a reverse proxy
- CORS restricted to `CORS_ORIGIN` when set; JSON bodies capped at 100 kB; WebSocket messages capped at 1 MB
- Input validation with Zod; drawing messages are checked to be known ops before they are stored
- Private rooms enforced on the API (`/chats`, `/room/:slug`, `/rooms`) and on WebSocket join
- Room admins' emails are not exposed by `/rooms`
