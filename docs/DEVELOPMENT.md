# Development Guide

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Start services: `docker-compose up -d`
4. Run migrations: `npm run db:push`
5. Start development servers (requires two terminals):
   - Terminal 1: `npm run dev` (backend API)
   - Terminal 2: `npm run dev:frontend` (frontend UI)

**Access Points:**
- Frontend UI: http://localhost:5000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api/v1

## Available Commands

### Development
- `npm run dev` - Start backend API server (port 3001)
- `npm run dev:frontend` - Start frontend UI server (port 5000)

### Testing
- `npm test` - Run unit tests
- `npm run test:e2e` - Run E2E tests

### Code Quality
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Building
- `npm run build` - Build frontend for production

## Docker Commands

- `docker-compose up -d` - Start all services
- `docker-compose down` - Stop all services
- `docker-compose logs -f` - View logs

## Database Commands

- `npm run db:generate` - Generate migrations
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio

## Project Structure

See main README.md for detailed structure.
