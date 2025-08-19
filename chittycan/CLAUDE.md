# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (client + server bundle)
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Push database schema changes using Drizzle

## Architecture Overview

ChittyCan™ is a full-stack TypeScript application providing static IP tunneling services for Replit apps to interact with banking APIs. The architecture follows a client-server pattern with shared type definitions.

### Tech Stack
- **Frontend**: React 18 + TypeScript, Wouter (routing), Tailwind CSS, shadcn/ui components
- **Backend**: Express.js + TypeScript, Drizzle ORM, PostgreSQL (Neon Serverless)
- **Build**: Vite (client), esbuild (server)
- **State**: React Query for server state, session-based auth via Replit Auth

### Key Directories
- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared TypeScript schemas and types
- `client/src/components/ui/` - shadcn/ui component library

## Database

Uses Drizzle ORM with PostgreSQL (Neon Serverless). Schema defined in `shared/schema.ts` with four main tables:
- `sessions` - Session storage for Replit Auth (PostgreSQL session store)
- `users` - User accounts (Replit Auth integration)
- `tunnels` - IP tunnel configurations with status and settings
- `usageStats` - Tunnel usage metrics and monitoring data

Environment variables required:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption secret

## Authentication

Session-based authentication using Replit Auth:
- Setup in `server/replitAuth.ts`
- Protected routes use `isAuthenticated` middleware
- User data stored in PostgreSQL with session management

## API Structure

RESTful API at `/api/*` endpoints:
- `/api/auth/user` - Get current user info
- `/api/tunnels` - CRUD operations for tunnel management
- `/api/stats` - Usage statistics and monitoring data

All tunnel endpoints require authentication. Requests/responses use Zod validation.

## Frontend Patterns

- Route protection via `AuthenticatedRoute` wrapper
- React Query for API calls with automatic caching/invalidation
- shadcn/ui components for consistent design system
- Mobile-first responsive design with dark mode support
- Forms use react-hook-form with Zod validation

## Brand Guidelines

- Philosophy: "Never Sh*tty" - "Built for Us, Built for You, Built in Chicago"
- Design: Mobile-first, functional and trustworthy, hide complexity behind intuitive UI
- Language: Simple, everyday language avoiding technical jargon

## Development Notes

- Server runs on port 5000 (development and production)
- Vite dev server integrates with Express in development
- Production serves static files from `dist/public`
- All authentication flows go through Replit Auth system
- Database operations abstracted through storage layer (`server/storage.ts`)

## Configuration Files

- `vite.config.ts` - Client build configuration with React plugin
- `drizzle.config.ts` - Database migration configuration
- `tailwind.config.ts` - Design system with custom color palette
- `components.json` - shadcn/ui component installation settings
- `.replit` - Deployment configuration for Replit autoscale

## Testing

Currently no testing infrastructure is set up. When implementing tests in the future, consider adding Jest/Vitest for unit tests and Playwright for E2E tests.