# Project Overview

## Overview

This project is ChittyPM - a comprehensive project management system built as a full-stack web application. The application serves as a centralized platform for managing projects, tasks, and AI agents with real-time collaboration capabilities. It features a React-based frontend with shadcn/ui components, an Express.js backend with WebSocket support, and PostgreSQL database integration through Drizzle ORM. The system is designed to integrate with external services like ChittyID and registry.chitty.cc for enhanced functionality and AI agent coordination.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: WebSocket client for live updates

### Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful API with additional WebSocket endpoints for real-time features
- **Database ORM**: Drizzle ORM with type-safe schema definitions
- **Session Management**: PostgreSQL-based session storage using connect-pg-simple
- **Background Processing**: Custom background job system for periodic tasks
- **MCP Protocol**: Model Context Protocol server implementation for AI agent communication

### Database Schema Design
- **Users**: Authentication and user profile management
- **Projects**: Hierarchical project organization with categories and metadata
- **Tasks**: Task management with status tracking, priority levels, and agent assignment
- **Agents**: AI agent registration and capability tracking
- **Activities**: Audit trail and activity feed for all system events
- **Integrations**: External service integration status and configuration
- **MCP Tools**: Registry of available Model Context Protocol tools

### Real-time Features
- **WebSocket Server**: Handles agent connections, client updates, and broadcasts
- **Live Updates**: Project progress, task status changes, and agent activity
- **Background Sync**: Automated synchronization with external services
- **Activity Broadcasting**: Real-time notifications for system events

### Service Integrations
- **ChittyID Client**: Synchronizes projects and tasks with external ChittyID service
- **Registry Client**: Discovers and manages MCP tools from registry.chitty.cc
- **Background Jobs**: Automated data integrity checks and cleanup processes
- **ETH Registry Client**: Blockchain-based agent discovery with ENS resolution and fuzzy search
- **Smart Recommendations Service**: Personalized agent matching with natural language alignment and deduplication
- **Blockchain Reputation System**: Transparent, verifiable agent reputation scoring with on-chain verification

## External Dependencies

### Core Framework Dependencies
- **@tanstack/react-query**: Server state management and caching
- **express**: Web application framework for Node.js
- **drizzle-orm**: Type-safe SQL database ORM
- **@neondatabase/serverless**: Neon PostgreSQL serverless driver
- **ws**: WebSocket library for real-time communication

### ChittyBeacon Integration
- **ChittyBeacon**: Custom application tracking and monitoring system
- **Platform Detection**: Automatically detects Replit, GitHub Actions, Vercel, and other platforms
- **Heartbeat Monitoring**: Sends periodic status updates every 5 minutes
- **Usage Analytics**: Tracks application startup, uptime, and system metrics

### UI and Styling Dependencies
- **@radix-ui/react-***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library with consistent design

### Development and Build Tools
- **vite**: Fast build tool and development server
- **typescript**: Static type checking
- **drizzle-kit**: Database migration and schema management tools
- **esbuild**: JavaScript bundler for server-side code

### External Services
- **ChittyID API**: External project management service integration
- **registry.chitty.cc**: MCP tool discovery and registry service
- **Neon Database**: Serverless PostgreSQL hosting platform
- **ETH Registry**: Ethereum-based agent registry with ENS domain resolution
- **Smart Recommendations**: AI-powered agent and tool recommendations with natural alignment

### Authentication and Session Management
- **connect-pg-simple**: PostgreSQL session store for Express
- **nanoid**: Unique ID generation for various entities