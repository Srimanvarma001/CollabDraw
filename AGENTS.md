# CollabDraw - Agent Instructions

## Project Structure

This is a Turborepo monorepo with pnpm. The project is a real-time collaborative drawing app.

**Apps:**
- `apps/frontend` - Next.js 15 frontend (port 3000)
- `apps/http-backend` - Express REST API (port 3001)
- `apps/ws-backend` - WebSocket server (port 8080)

**Packages:**
- `packages/db` - Prisma with PostgreSQL
- `packages/common` - Zod schemas for validation
- `packages/backend-common` - Shared JWT_SECRET
- `packages/ui` - React component library

## Commands

```bash
pnpm build          # Build all packages (Turbo handles dependency order)
pnpm dev            # Run all apps in dev mode
pnpm lint           # Lint all packages
pnpm check-types    # Type-check all packages
pnpm format         # Format code with Prettier
```

## Running Individual Apps

```bash
# Frontend
cd apps/frontend && pnpm dev

# HTTP Backend (requires DATABASE_URL)
cd apps/http-backend && pnpm dev

# WebSocket Backend
cd apps/ws-backend && pnpm dev
```

## Important Notes

- **Database**: PostgreSQL via Prisma. Set `DATABASE_URL` in environment before running backends.
- **Build order**: Turbo automatically builds dependencies first (`^build` dependsOn).
- **Environment**: `.env` files are tracked in build inputs (turbo.json:7).
- **TypeScript**: All packages are TypeScript.
- **Shared code**: `@repo/backend-common` exports `JWT_SECRET` used by both HTTP and WS backends.