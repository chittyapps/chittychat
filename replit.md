# Project Overview

## Overview

This project is ChittyPM - an MCP-based todo and project management system designed to replace Claude's "todowrite" function seamlessly across various channels. The application serves as a comprehensive, self-organizing platform for managing tasks, projects, and AI agents with blockchain-powered reputation scoring and smart recommendations. It features a mobile-first React frontend with glass morphism design, an Express.js backend with WebSocket support, and PostgreSQL database integration through Drizzle ORM. The system integrates with ChittyID, The Registry (blockchain layer), and registry.chitty.cc (MCP tool discovery) for enhanced functionality and cross-platform compatibility.

## Recent Changes (January 2025)

### ✓ Complete Sleek UI Transformation
- **Date**: January 18, 2025
- **Changes**: Completely redesigned with custom glass morphism, zero template dependencies
- **Impact**: Premium aesthetic with Geist fonts, cosmic gradients, and floating animations
- **Status**: Fully operational sleek interface with mobile-first responsive design

### ✓ Registry.chitty.cc Integration Complete
- **Date**: January 18, 2025
- **Changes**: Successfully integrated registry.chitty.cc as the central hub for MCP tool discovery and agent management
- **Impact**: ChittyPM now discovers MCP tools and agents from registry.chitty.cc with real-time recommendations
- **Status**: Fully operational with TodoWrite replacement working via MCP protocol

### ✓ ChittyInsight Integration Complete
- **Date**: August 19, 2025
- **Changes**: Successfully integrated ChittyInsight as advanced analytics and intelligence dashboard
- **Impact**: Comprehensive performance analysis, agent analytics, workflow insights, and system health monitoring
- **Status**: Fully operational with multi-tab interface and real-time metrics

### ✓ Integrations Status Overview
- **ChittyBeacon**: ✅ ACTIVE - Application monitoring and analytics running automatically
- **registry.chitty.cc**: ✅ ACTIVE - MCP tool discovery and agent management connected
- **ChittyInsight**: ✅ ACTIVE - Advanced analytics and intelligence dashboard operational
- **ChittyID**: ⚠️ NEEDS API KEY - Project synchronization ready but requires configuration

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
- **Background Jobs**: Automated data integrity checks and cleanup processes with self-organizing capabilities
- **The Registry Client**: Blockchain-based agent discovery with ENS resolution and fuzzy search
- **Smart Recommendations Service**: Personalized agent matching with natural language alignment and deduplication
- **Blockchain Reputation System**: Transparent, verifiable agent reputation scoring with on-chain verification
- **MCP Server**: Model Context Protocol server for todowrite function replacement across channels
- **Self-Organizing System**: Automatic categorization and intelligent task management

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
- **ChittyID API**: External project management service integration for Neon database ingestion
- **registry.chitty.cc**: MCP tool discovery and registry service
- **Neon Database**: Serverless PostgreSQL hosting platform
- **The Registry**: Ethereum-based agent registry with ENS domain resolution
- **Smart Recommendations**: AI-powered agent and tool recommendations with natural alignment
- **MCP Protocol Integration**: Model Context Protocol for seamless todowrite replacement functionality

### Authentication and Session Management
- **connect-pg-simple**: PostgreSQL session store for Express
- **nanoid**: Unique ID generation for various entities