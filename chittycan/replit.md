# ChittyCan - Static IP Tunnel Service

## Overview

ChittyCan™ is a web application that provides static IP tunneling services, allowing Replit apps to safely interact with banking APIs. The application features a React frontend with a modern UI using shadcn/ui components, an Express backend, and uses Drizzle ORM for database operations. The app follows a client-server architecture with a shared schema for type consistency.

Brand philosophy: "Never Sh*tty" - "Built for Us, Built for You, Built in Chicago"
Design goal: Interface should be "mobile first, slick not grade, but functional and trustworthy"
User experience: Make it so intuitive that "whether you know what a tunnel or proxy is, you get in and you want it"

## User Preferences

Preferred communication style: Simple, everyday language.
Design preference: Hide complexity behind intuitive design - "cow≠steak" minimalist philosophy
Interface requirements: Simple, clean, and intuitive - focus on core functionality without overwhelming users

## System Architecture

### Frontend

- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: React Query for server state management
- **UI Component Library**: shadcn/ui (based on Radix UI primitives)
- **Styling**: Tailwind CSS with a customized theme
- **Build Tool**: Vite

### Backend

- **Framework**: Express.js with TypeScript
- **API Structure**: RESTful API with JSON responses
- **Database Abstraction**: Drizzle ORM
- **Database**: PostgreSQL (configured for use with Neon Serverless)
- **Authentication**: Session-based (infrastructure in place but implementation incomplete)

### Data Layer

- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Definition**: Shared schema between frontend and backend for type consistency
- **Validation**: Zod for input validation

## Key Components

### Frontend Components

1. **Layout**: 
   - NavBar and Footer for consistent page structure
   - Theme provider for light/dark mode support

2. **Dashboard**:
   - TunnelTable for displaying active IP tunnels
   - MonitoringStats for usage metrics
   - QuickSetup guide for new users

3. **Forms**:
   - NewTunnelForm for creating IP tunnel configurations

4. **UI Components**:
   - Extensive collection of shadcn/ui components
   - Custom components like StatusBadge and SecretDiscount

### Backend Components

1. **API Routes**:
   - Tunnel management endpoints (CRUD operations)
   - Stats collection and reporting

2. **Storage Layer**:
   - Abstract interface for data operations
   - Implementation for both memory storage and database storage

3. **Server Configuration**:
   - Vite integration for development
   - Static file serving

## Data Flow

1. **User Interaction**:
   - User interacts with the UI components
   - React Query hooks manage API requests and state updates

2. **API Communication**:
   - Frontend sends requests to Express backend endpoints
   - Backend validates input using Zod schemas

3. **Data Persistence**:
   - Backend uses Drizzle ORM to interact with PostgreSQL
   - Data is returned to frontend as JSON responses

4. **State Updates**:
   - React Query invalidates and refetches data when mutations occur
   - Components re-render with updated data

## External Dependencies

### Frontend Libraries

- **@tanstack/react-query**: For server state management
- **@radix-ui components**: For accessible UI primitives
- **class-variance-authority**: For component styling variants
- **wouter**: For client-side routing
- **zod**: For schema validation
- **react-hook-form**: For form handling

### Backend Libraries

- **express**: Web server framework
- **drizzle-orm**: Database ORM
- **@neondatabase/serverless**: PostgreSQL driver for serverless environments
- **connect-pg-simple**: PostgreSQL session store

## Deployment Strategy

The application is configured for deployment on Replit with several key features:

1. **Build Process**:
   - Frontend: Vite builds static assets to the `dist/public` directory
   - Backend: esbuild bundles the server code to the `dist` directory

2. **Runtime Configuration**:
   - Development mode: Uses Vite dev server with HMR
   - Production mode: Serves static assets and runs the bundled server

3. **Database Handling**:
   - Uses Drizzle ORM with schema migrations
   - Expects DATABASE_URL environment variable for connection

4. **Environment Variables**:
   - NODE_ENV: Controls development vs production mode
   - DATABASE_URL: PostgreSQL connection string

5. **Replit-specific**:
   - Uses .replit configuration for proper execution
   - Configured for the Replit deployment system
   - Includes Replit-specific Vite plugins for error handling

## Database Schema

The application has three main database tables:

1. **users**: User accounts for authentication
   - id (PK)
   - username
   - password

2. **tunnels**: IP tunnel configurations
   - id (PK)
   - name
   - staticIp
   - status
   - serviceProvider
   - targetApi
   - region
   - Various configuration fields

3. **usageStats**: Metrics for tunnel usage
   - id (PK)
   - tunnelId (FK)
   - date
   - Various metric fields

## Future Development

The current implementation appears to have a solid foundation but may need:

1. **Authentication**: Complete implementation of user authentication
2. **More Robust Error Handling**: Enhanced error handling for API requests
3. **Testing**: Add unit and integration tests
4. **Enhanced Monitoring**: Expand the monitoring capabilities for tunnels