<img width="2048" height="2048" alt="image" src="https://github.com/user-attachments/assets/b93f59d5-7f06-43ad-b0f7-4f0255f4f695" />

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

# Demo Images
## Operations Management
<img width="1894" height="865" alt="image" src="https://github.com/user-attachments/assets/58cd1d9f-1bbb-44f5-a532-962aa9ba2c6b" />

## Target Management
<img width="1894" height="701" alt="image" src="https://github.com/user-attachments/assets/0d1b3f43-faeb-4dfc-8abd-9fa263b273ef" />

## AI Provider Integration
<img width="1894" height="886" alt="image" src="https://github.com/user-attachments/assets/29c598dd-db9d-4631-8b79-115942568954" />

## Dynamic Agent Configuration
<img width="1894" height="886" alt="image" src="https://github.com/user-attachments/assets/e42b6e53-8786-42ee-a1d5-03f17e4c6dfb" />

## Agent Workflow
<img width="980" height="668" alt="image" src="https://github.com/user-attachments/assets/a8ef8f02-0f5f-4d33-9620-7ded1d1e454e" />

## Agentic Report Production
<img width="980" height="668" alt="image" src="https://github.com/user-attachments/assets/d112c365-b994-4c95-a5ba-10b33391bee9" />

## Dynamic Tool Management
<img width="1894" height="886" alt="image" src="https://github.com/user-attachments/assets/6bfa969e-a4b0-49cd-acf8-a304607988e0" />

## Tool Workflows
<img width="1894" height="886" alt="image" src="https://github.com/user-attachments/assets/af335a70-53be-4e2a-b44c-3d30945496e2" />

## Logic Monitoring
<img width="992" height="865" alt="image" src="https://github.com/user-attachments/assets/9a683d9a-afed-477f-b3ee-09038bab88b7" />

