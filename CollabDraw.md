%^# CollabDraw - Agent Instructions

## Project Overview

CollabDraw is a **real-time collaborative drawing application** that allows multiple users to draw together on a shared canvas in real-time. Users can create rooms, invite others, and collaborate on the same canvas with various drawing tools, colors, and features like zoom, pan, undo/redo, and live cursor tracking.

---

## What This Project Is About

### Core Functionality
- **Real-time collaborative drawing**: Multiple users can draw on the same canvas simultaneously
- **Room-based collaboration**: Users create or join rooms (identified by slugs) to collaborate with others
- **Live presence indicators**: See who else is in the room with you
- **Cursor tracking**: See other users' cursors in real-time
- **Shape drawing tools**: Draw rectangles, circles, lines, arrows, freehand (pencil), text, and use eraser
- **Color picker**: Choose from 9 predefined colors
- **Stroke width control**: Adjustable line thickness (1-20px)
- **Zoom and pan**: Zoom in/out (10% - 2000%) and pan around the canvas
- **Undo/Redo**: Full history support for all actions

### User Flow
1. **Sign Up**: Users create an account with username, password, and display name
2. **Sign In**: Authenticate to get a JWT token
3. **Create/Join Room**: Create a new room with a unique name or join an existing room using its slug
4. **Collaborate**: Draw on the shared canvas with real-time updates to all participants
5. **Share**: Copy the room URL to invite others

---

## Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **HTML5 Canvas API** - For drawing functionality

### Backend Services
- **Express.js** (Port 3001) - REST API for authentication, room management, chat
- **WebSocket** (ws library, Port 8080) - Real-time communication for drawing sync, cursors, presence

### Database
- **PostgreSQL** - Relational database
- **Prisma** - ORM for database operations

### Shared Packages
- **@repo/common** - Zod schemas for input validation
- **@repo/backend-common** - Shared JWT_SECRET
- **@repo/db** - Prisma client and database utilities
- **@repo/ui** - Reusable React components (Button, Card, Code)

### Build Tools
- **pnpm** - Package manager
- **Turborepo** - Monorepo build orchestration
- **TypeScript** - Type checking
- **ESLint** - Code linting
- **Prettier** - Code formatting

---

## Project Structure

```
CollabDraw/
├── apps/
│   ├── frontend/          # Next.js frontend (port 3000)
│   │   ├── app/          # App Router pages
│   │   ├── components/   # React components (Canvas, AuthPage, etc.)
│   │   ├── draw/        # Drawing logic (Game.ts, http.ts)
│   │   └── config.ts    # Frontend config
│   ├── http-backend/    # Express REST API (port 3001)
│   │   └── src/         # API routes and middleware
│   └── ws-backend/      # WebSocket server (port 8080)
│       └── src/         # WebSocket handlers
├── packages/
│   ├── common/          # Zod validation schemas
│   ├── backend-common/  # Shared backend utilities (JWT_SECRET)
│   ├── db/             # Prisma client and schema
│   └── ui/             # React component library
├── turbo.json          # Turborepo configuration
├── pnpm-workspace.yaml # pnpm workspace config
└── package.json        # Root package.json
```

---

## Database Schema

### Models

**User**
| Field    | Type    | Description           |
|----------|---------|----------------------|
| id       | String  | UUID, auto-generated |
| email    | String  | Unique, used as username |
| password | String  | Bcrypt hashed        |
| name     | String  | Display name         |
| photo    | String? | Optional avatar URL  |

**Room**
| Field    | Type    | Description                  |
|----------|---------|------------------------------|
| id       | Int     | Auto-increment              |
| slug     | String  | Unique room identifier      |
| createdAt| DateTime| Auto-set to creation time   |
| adminId  | String  | User who created the room   |

**Chat**
| Field  | Type    | Description              |
|--------|---------|--------------------------|
| id     | Int     | Auto-increment           |
| roomId | String  | Reference to room slug   |
| message| String  | Chat message content     |
| userId | String  | Reference to user        |

---

## API Endpoints

### Authentication

**POST /signup**
- Creates a new user account
- Request body: `{ username, password, name }`
- Response: `{ userId }`
- Validation: Zod schema checks username (3-20 chars), password, name

**POST /signin**
- Authenticates user and returns JWT
- Request body: `{ username, password }`
- Response: `{ token }`
- Uses bcrypt for password comparison

### Rooms

**POST /room** (Protected)
- Creates a new room
- Request body: `{ name }` (room slug)
- Response: `{ room: { id, slug } }`
- Only authenticated users can create rooms

**GET /room/:slug**
- Gets room details by slug
- Response: `{ room }`

**GET /rooms**
- Lists all rooms with admin info
- Response: `{ rooms: [...] }`

**DELETE /room/:id** (Protected)
- Deletes a room (admin only)
- Response: `{ message }`

### Chat

**GET /chats/:roomId**
- Retrieves last 1000 messages for a room
- Response: `{ messages: [...] }`

---

## WebSocket Messages

### Client → Server

**join_room**
```json
{ "type": "join_room", "roomId": "slug", "userName": "Display Name" }
```

**leave_room**
```json
{ "type": "leave_room", "roomId": "slug" }
```

**cursor**
```json
{ "type": "cursor", "roomId": "slug", "cursor": { "x": 100, "y": 200 } }
```

**chat** (drawing data)
```json
{ "type": "chat", "roomId": "slug", "message": "{\"shape\": {...}}" }
```

### Server → Client

**presence**
```json
{ "type": "presence", "roomId": "slug", "users": [{ "userId": "...", "userName": "..." }] }
```

**cursor**
```json
{ "type": "cursor", "roomId": "slug", "userId": "...", "userName": "...", "cursor": { "x": 100, "y": 200 } }
```

**chat** (forwards drawing data)
```json
{ "type": "chat", "message": "{\"shape\": {...}}", "roomId": "slug" }
```

---

## Drawing Tools

### Available Tools
1. **Pencil** - Freehand drawing
2. **Rectangle** - Draw rectangles
3. **Circle** - Draw circles
4. **Line** - Draw straight lines
5. **Arrow** - Draw arrows with arrowheads
6. **Eraser** - Remove shapes by clicking near them
7. **Text** - Add text labels to canvas

### Shape Types
- **rect**: `{ type: "rect", x, y, width, height, strokeColor, strokeWidth }`
- **circle**: `{ type: "circle", centerX, centerY, radius, strokeColor, strokeWidth }`
- **pencil**: `{ type: "pencil", points: [{x, y}, ...], strokeColor, strokeWidth }`
- **line**: `{ type: "line", startX, startY, endX, endY, strokeColor, strokeWidth }`
- **arrow**: `{ type: "arrow", startX, startY, endX, endY, strokeColor, strokeWidth }`
- **text**: `{ type: "text", x, y, text, fontSize, strokeColor }`

### Color Palette
```
#ffffff, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899
```

---

## Drawing Workflow

1. **Initialization**: User opens a room (`/canvas/[roomId]`)
2. **WebSocket Connection**: Connect to WS server with JWT token
3. **Join Room**: Send `join_room` message to subscribe to room updates
4. **Initial Load**: Fetch existing shapes from server (stored in chat messages as JSON)
5. **Drawing**:
   - User selects a tool and draws on canvas
   - Mouse events create Shape objects
   - Shapes are pushed to `existingShapes` array
   - Shapes are saved to history stack (for undo/redo)
   - Shapes are broadcast via WebSocket to all room participants
6. **Receiving Updates**:
   - WebSocket receives shape updates from other users
   - Shapes are merged into local `existingShapes`
   - Canvas is redrawn
7. **Presence**: Server broadcasts user list, UI shows connected users

---

## Key Features

### Real-time Sync
- Shapes broadcast via WebSocket chat messages
- Cursor positions throttled to 50ms intervals
- Presence updates on join/leave

### Camera System
- Pan: Middle mouse button or Space + drag
- Zoom: Mouse wheel (Ctrl for finer control), zoom buttons, keyboard shortcuts (Ctrl+=, Ctrl+-, Ctrl+0)
- Zoom range: 10% to 2000%
- Grid background for reference

### History (Undo/Redo)
- Full undo/redo stack maintained per session
- History stored as array of shape arrays
- Undo: removes last shape, moves history index back
- Redo: moves history index forward, restores shapes

### User Interface
- Glassmorphism toolbar with tool selection
- Color picker with 9 preset colors
- Stroke width slider (1-20)
- User presence avatars
- Room modal for creating/joining rooms

---

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages (Turbo handles dependency order)
pnpm build

# Run all apps in dev mode
pnpm dev

# Lint all packages
pnpm lint

# Type-check all packages
pnpm check-types

# Format code with Prettier
pnpm format

# Run individual apps
cd apps/frontend && pnpm dev      # Frontend (port 3000)
cd apps/http-backend && pnpm dev  # HTTP Backend (port 3001, requires DATABASE_URL)
cd apps/ws-backend && pnpm dev     # WebSocket Backend (port 8080)
```

---

## Important Notes

- **Database**: PostgreSQL via Prisma. Set `DATABASE_URL` in environment before running backends.
- **Build order**: Turbo automatically builds dependencies first (`^build` dependsOn).
- **Environment**: `.env` files are tracked in build inputs (turbo.json:7).
- **TypeScript**: All packages are TypeScript.
- **Shared code**: `@repo/backend-common` exports `JWT_SECRET` used by both HTTP and WS backends.
- **WebSocket**: Requires JWT authentication via query parameter `?token=...`
- **Shape storage**: Shapes are stored as JSON in chat messages (not in dedicated field).

---

## Development Workflow

1. Set up PostgreSQL database and configure `DATABASE_URL` in `.env`
2. Run `pnpm install` to install dependencies
3. Run `pnpm build` to generate Prisma client and build packages
4. Run `pnpm dev` to start all services
5. Access frontend at `http://localhost:3000`
6. Create account, create/join rooms, start drawing

---

## Security Considerations

- Passwords are hashed with bcrypt (10 salt rounds)
- JWT tokens used for authentication
- WebSocket connections validated against JWT
- Input validation using Zod schemas
- Room deletion restricted to room admin only