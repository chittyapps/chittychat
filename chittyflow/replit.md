# Flow - ADHD-Friendly Executive Assistant

## Overview

Flow is a web application designed as an ADHD-friendly executive assistant that helps users manage tasks, track energy levels, and celebrate wins. The application follows a full-stack architecture with a React frontend, Express backend, PostgreSQL database using Drizzle ORM, and Replit authentication. Now includes ChittyBeacon integration for privacy-focused usage analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with custom ADHD-friendly color palette (sage, mint, coral, warm-blue)
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **API Pattern**: RESTful endpoints under `/api` prefix
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage
- **Database Access**: Drizzle ORM with type-safe queries
- **Error Handling**: Centralized error middleware

### Database Architecture
- **Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle ORM with schema-first approach
- **Migrations**: Drizzle Kit for schema migrations
- **Connection**: Connection pooling with Neon serverless driver

## Key Components

### Authentication System
- **Provider**: Replit Auth integration
- **Flow**: OpenID Connect with automatic user provisioning
- **Sessions**: Persistent sessions stored in PostgreSQL
- **Security**: HTTP-only cookies with secure configuration

### Task Management
- **Gentle Tasks**: ADHD-friendly task management with energy-level awareness
- **Energy Tracking**: Three-level energy system (low, medium, high)
- **Auto-handling**: Background task automation features
- **Categories**: Flexible task categorization system

### User Experience Features
- **Celebration System**: Win tracking and positive reinforcement
- **Energy Meter**: Visual energy level tracking and adjustment
- **Motivational Content**: Rotating encouraging messages
- **Quick Actions**: One-click common actions (breaks, hydration, etc.)
- **Floating Assistant**: Persistent help interface
- **Transition Rituals**: Gentle step-by-step rituals for task switching, break returns, focus preparation, and daily transitions

### Analytics and Tracking
- **ChittyBeacon Integration**: Privacy-focused usage analytics
- **Feature Usage Tracking**: Anonymous monitoring of executive function tool usage
- **Pattern Learning**: Automatic detection and tracking of productivity patterns
- **Platform Detection**: Automatic environment and deployment platform identification
- **Privacy Protection**: No personal data collection, only anonymous usage metrics

### UI/UX Design Principles
- **ADHD-Friendly**: Reduced cognitive load with clear visual hierarchy
- **Color Psychology**: Calming sage/mint/coral palette
- **Responsive Design**: Mobile-first approach
- **Accessibility**: High contrast, clear typography, keyboard navigation

## Data Flow

1. **Authentication Flow**: User authenticates via Replit → Session created → User record upserted
2. **Task Flow**: Create task → Store with energy level → Display in appropriate section → Complete → Celebrate
3. **Energy Flow**: User sets energy level → System adapts task suggestions → Tracks patterns
4. **Analytics Flow**: Actions tracked → Celebrations generated → Insights provided
5. **Transition Flow**: User selects ritual → Session created → Step-by-step guidance → Completion tracking → Helpful feedback
6. **Analytics Flow**: Anonymous usage tracking → Privacy-focused insights → Feature usage patterns → Platform detection → No personal data collection

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL serverless
- **Authentication**: Replit Auth services
- **UI Components**: Radix UI primitives
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Native fetch with TanStack Query
- **Analytics**: ChittyBeacon for privacy-focused usage tracking

### Development Tools
- **TypeScript**: Full type safety across stack
- **Vite**: Development server and build tool
- **Drizzle Kit**: Database schema management
- **ESBuild**: Server-side bundling for production

## Deployment Strategy

### Development
- **Frontend**: Vite dev server with HMR
- **Backend**: tsx for TypeScript execution
- **Database**: Direct connection to Neon database
- **Environment**: Replit development environment

### Production
- **Frontend**: Static build served by Express
- **Backend**: Bundled with ESBuild for Node.js
- **Database**: Production Neon PostgreSQL instance
- **Hosting**: Replit production deployment

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string
- **SESSION_SECRET**: Session encryption key
- **REPL_ID**: Replit application identifier
- **ISSUER_URL**: OpenID Connect issuer endpoint

### Build Process
1. Frontend assets built with Vite
2. Backend bundled with ESBuild
3. Static files served from Express
4. Database migrations applied via Drizzle

The application emphasizes user well-being and ADHD-friendly design patterns throughout, with gentle language, positive reinforcement, and respect for varying energy levels and productivity patterns.