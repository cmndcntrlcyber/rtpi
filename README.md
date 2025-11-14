# Red Team Portable Infrastructure (RTPI)

Unified platform for red team operations, combining attack-node, MCP-Nexus, and pen_attack-node capabilities.

## Quick Start

```bash
# Install dependencies
npm install

# Start database and Redis services
docker compose up -d

# Run database migrations
npm run db:push

# Start development servers (requires two terminals)

# Terminal 1: Start backend API server
npm run dev

# Terminal 2: Start frontend UI server
npm run dev:frontend
```

**Access the application:**
- Frontend UI: http://localhost:5000 (or 5001 if 5000 is busy)
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api/v1

**Note:** Always access the full application through the frontend URL. The backend API serves JSON responses only.

## Available Commands

```bash
# Development
npm run dev              # Start backend API server
npm run dev:frontend     # Start frontend UI server

# Testing
npm test                 # Run unit tests
npm run test:e2e         # Run E2E tests

# Building
npm run build            # Build frontend for production

# Database
npm run db:generate      # Generate migrations
npm run db:push          # Apply migrations
npm run db:studio        # Open database studio

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

## Documentation

- [Development Guide](docs/DEVELOPMENT.md)
- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## License

MIT License - See LICENSE file for details
