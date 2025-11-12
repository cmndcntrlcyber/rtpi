# API Documentation

## Overview

The Unified RTPI API provides a RESTful interface for managing red team operations, including target management, agent deployment, vulnerability tracking, and operational orchestration. The API uses JSON for request and response bodies and implements role-based access control (RBAC) for secure operations.

**Base URL**: `http://localhost:3000/api/v1`

**API Version**: v1

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Targets](#targets-endpoints)
  - [Agents](#agents-endpoints)
  - [Containers](#containers-endpoints)
  - [Devices](#devices-endpoints)
  - [MCP Servers](#mcp-servers-endpoints)
  - [Operations](#operations-endpoints)
  - [Vulnerabilities](#vulnerabilities-endpoints)
  - [Health Checks](#health-checks-endpoints)
- [WebSocket API](#websocket-api)

---

## Authentication

The RTPI API supports two authentication methods:

### 1. Local Authentication (Username/Password)

Traditional username and password authentication with session-based cookies.

### 2. Google OAuth 2.0

OAuth authentication via Google for streamlined user access.

### Authentication Flow

All API endpoints (except authentication endpoints) require a valid session. Sessions are managed using Redis and express-session with the following characteristics:

- **Session Duration**: Configurable via environment variables
- **Cookie Settings**: HttpOnly, Secure (in production), SameSite
- **Session Storage**: Redis for distributed session management

### User Roles

The API implements role-based access control with three roles:

- **Admin**: Full access to all endpoints and operations
- **Operator**: Access to operational endpoints, limited administrative access
- **Viewer**: Read-only access to most resources

---

## Response Format

All API responses follow a consistent JSON format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### List Response
```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 150
  }
}
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `204 No Content` - Request succeeded with no response body
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate)
- `422 Unprocessable Entity` - Validation error
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

### Error Codes

Common error codes returned in the `code` field:

- `AUTH_REQUIRED` - Authentication required
- `INVALID_CREDENTIALS` - Invalid username or password
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `VALIDATION_ERROR` - Request validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Internal server error

---

## Rate Limiting

API endpoints are protected by rate limiting to prevent abuse:

- **Authentication endpoints**: 5 requests per 15 minutes per IP
- **Password change**: 3 requests per 15 minutes per user
- **General API endpoints**: 100 requests per 15 minutes per user

When rate limit is exceeded, the API returns a `429 Too Many Requests` response with a `Retry-After` header.

---

## API Endpoints

### Authentication Endpoints

#### Get CSRF Token

```http
GET /api/v1/auth/csrf-token
```

Returns a CSRF token required for state-changing operations.

**Response:**
```json
{
  "csrfToken": "abc123..."
}
```

---

#### Login (Local)

```http
POST /api/v1/auth/login
```

Authenticate with username and password.

**Request Body:**
```json
{
  "username": "admin",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "authMethod": "local"
  }
}
```

**Rate Limit:** 5 requests per 15 minutes

---

#### Login (Google OAuth)

```http
GET /api/v1/auth/google
```

Initiates Google OAuth flow. Redirects to Google authentication.

**OAuth Callback:**
```http
GET /api/v1/auth/google/callback
```

Handles OAuth callback from Google. On success, redirects to dashboard.

---

#### Logout

```http
POST /api/v1/auth/logout
```

Terminates the current session.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### Get Current User

```http
GET /api/v1/auth/me
```

Returns information about the currently authenticated user.

**Response:**
```json
{
  "user": {
    "id": "user_123",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "authMethod": "local",
    "isActive": true,
    "mustChangePassword": false,
    "lastLogin": "2025-01-11T09:15:30Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

#### Change Password

```http
PUT /api/v1/auth/password
```

Changes the current user's password.

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

**Password Requirements:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)
- Cannot reuse last 5 passwords

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Rate Limit:** 3 requests per 15 minutes

---

### Targets Endpoints

#### List All Targets

```http
GET /api/v1/targets
```

Returns a list of all targets.

**Required Role:** Authenticated user

**Response:**
```json
{
  "targets": [
    {
      "id": "target_001",
      "name": "Production Server",
      "ipAddress": "192.168.1.100",
      "hostname": "prod-server-01",
      "osType": "Linux",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-11T09:00:00Z"
    }
  ]
}
```

---

#### Get Target Details

```http
GET /api/v1/targets/:id
```

Returns detailed information about a specific target.

**Required Role:** Authenticated user

**Response:**
```json
{
  "target": {
    "id": "target_001",
    "name": "Production Server",
    "ipAddress": "192.168.1.100",
    "hostname": "prod-server-01",
    "osType": "Linux",
    "status": "active",
    "ports": [22, 80, 443],
    "services": ["ssh", "http", "https"],
    "vulnerabilities": ["CVE-2024-1234"],
    "notes": "Critical infrastructure component",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-11T09:00:00Z"
  }
}
```

---

#### Create Target

```http
POST /api/v1/targets
```

Creates a new target.

**Required Role:** Admin or Operator

**Request Body:**
```json
{
  "name": "New Target Server",
  "ipAddress": "192.168.1.101",
  "hostname": "new-server-01",
  "osType": "Linux",
  "ports": [22, 80, 443],
  "notes": "Development environment"
}
```

**Response:**
```json
{
  "target": {
    "id": "target_002",
    "name": "New Target Server",
    "ipAddress": "192.168.1.101",
    "hostname": "new-server-01",
    "osType": "Linux",
    "status": "pending",
    "ports": [22, 80, 443],
    "createdAt": "2025-01-11T09:30:00Z",
    "updatedAt": "2025-01-11T09:30:00Z"
  }
}
```

**Status Code:** `201 Created`

---

#### Update Target

```http
PUT /api/v1/targets/:id
```

Updates an existing target.

**Required Role:** Admin or Operator

**Request Body:**
```json
{
  "name": "Updated Server Name",
  "status": "active",
  "notes": "Updated notes"
}
```

**Response:**
```json
{
  "target": {
    "id": "target_002",
    "name": "Updated Server Name",
    "status": "active",
    "updatedAt": "2025-01-11T09:35:00Z"
  }
}
```

---

#### Delete Target

```http
DELETE /api/v1/targets/:id
```

Deletes a target.

**Required Role:** Admin

**Response:**
```json
{
  "message": "Target deleted successfully"
}
```

**Status Code:** `200 OK`

---

#### Initiate Target Scan

```http
POST /api/v1/targets/:id/scan
```

Initiates a scan operation on the specified target.

**Required Role:** Admin or Operator

**Request Body:**
```json
{
  "scanType": "full",
  "options": {
    "portRange": "1-65535",
    "intensity": "aggressive"
  }
}
```

**Response:**
```json
{
  "message": "Scan initiated",
  "targetId": "target_001",
  "scanId": "scan_123"
}
```

---

### Agents Endpoints

#### List All Agents

```http
GET /api/v1/agents
```

Returns a list of all deployed agents.

**Required Role:** Authenticated user

**Response:**
```json
{
  "agents": [
    {
      "id": "agent_001",
      "name": "Agent Alpha",
      "type": "beacon",
      "status": "active",
      "targetId": "target_001",
      "lastSeen": "2025-01-11T09:30:00Z",
      "capabilities": ["shell", "file-transfer", "screenshot"]
    }
  ]
}
```

---

#### Get Agent Details

```http
GET /api/v1/agents/:id
```

Returns detailed information about a specific agent.

---

#### Deploy Agent

```http
POST /api/v1/agents
```

Deploys a new agent to a target.

**Required Role:** Admin or Operator

---

#### Update Agent

```http
PUT /api/v1/agents/:id
```

Updates agent configuration.

**Required Role:** Admin or Operator

---

#### Delete Agent

```http
DELETE /api/v1/agents/:id
```

Removes an agent.

**Required Role:** Admin

---

### Containers Endpoints

#### List Containers

```http
GET /api/v1/containers
```

Returns a list of all containers.

---

#### Get Container Details

```http
GET /api/v1/containers/:id
```

Returns detailed information about a container.

---

#### Create Container

```http
POST /api/v1/containers
```

Creates a new container.

**Required Role:** Admin or Operator

---

#### Start Container

```http
POST /api/v1/containers/:id/start
```

Starts a stopped container.

---

#### Stop Container

```http
POST /api/v1/containers/:id/stop
```

Stops a running container.

---

#### Delete Container

```http
DELETE /api/v1/containers/:id
```

Deletes a container.

**Required Role:** Admin

---

### Devices Endpoints

#### List Devices

```http
GET /api/v1/devices
```

Returns a list of all managed devices.

---

#### Get Device Details

```http
GET /api/v1/devices/:id
```

Returns detailed information about a device.

---

#### Register Device

```http
POST /api/v1/devices
```

Registers a new device.

---

#### Update Device

```http
PUT /api/v1/devices/:id
```

Updates device information.

---

#### Unregister Device

```http
DELETE /api/v1/devices/:id
```

Unregisters a device.

---

### MCP Servers Endpoints

#### List MCP Servers

```http
GET /api/v1/mcp-servers
```

Returns a list of all MCP (Model Context Protocol) servers.

---

#### Get MCP Server Details

```http
GET /api/v1/mcp-servers/:id
```

Returns detailed information about an MCP server.

---

#### Register MCP Server

```http
POST /api/v1/mcp-servers
```

Registers a new MCP server.

---

#### Update MCP Server

```http
PUT /api/v1/mcp-servers/:id
```

Updates MCP server configuration.

---

#### Delete MCP Server

```http
DELETE /api/v1/mcp-servers/:id
```

Removes an MCP server.

---

### Operations Endpoints

#### List Operations

```http
GET /api/v1/operations
```

Returns a list of all operations.

---

#### Get Operation Details

```http
GET /api/v1/operations/:id
```

Returns detailed information about an operation.

---

#### Create Operation

```http
POST /api/v1/operations
```

Creates a new operation.

**Required Role:** Admin or Operator

---

#### Update Operation

```http
PUT /api/v1/operations/:id
```

Updates an operation.

---

#### Close Operation

```http
POST /api/v1/operations/:id/close
```

Closes an active operation.

---

### Vulnerabilities Endpoints

#### List Vulnerabilities

```http
GET /api/v1/vulnerabilities
```

Returns a list of all discovered vulnerabilities.

---

#### Get Vulnerability Details

```http
GET /api/v1/vulnerabilities/:id
```

Returns detailed information about a vulnerability.

---

#### Report Vulnerability

```http
POST /api/v1/vulnerabilities
```

Reports a new vulnerability.

---

#### Update Vulnerability

```http
PUT /api/v1/vulnerabilities/:id
```

Updates vulnerability information.

---

#### Mark Vulnerability as Fixed

```http
POST /api/v1/vulnerabilities/:id/fix
```

Marks a vulnerability as fixed.

---

### Health Checks Endpoints

#### System Health

```http
GET /api/v1/health-checks
```

Returns overall system health status.

**Response:**
```json
{
  "status": "healthy",
  "components": {
    "database": "healthy",
    "redis": "healthy",
    "disk": "healthy",
    "memory": "healthy"
  },
  "timestamp": "2025-01-11T09:30:00Z"
}
```

---

#### Database Health

```http
GET /api/v1/health-checks/database
```

Returns database health status.

---

#### Redis Health

```http
GET /api/v1/health-checks/redis
```

Returns Redis cache health status.

---

## WebSocket API

The RTPI platform provides real-time updates via WebSocket connections.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
```

### Authentication

WebSocket connections are authenticated using the session cookie from HTTP authentication.

### Message Format

All WebSocket messages follow this format:

```json
{
  "type": "EVENT_TYPE",
  "data": { ... },
  "timestamp": "2025-01-11T09:30:00Z"
}
```

### Event Types

- `agent.status` - Agent status updates
- `target.scan.progress` - Scan progress updates
- `operation.update` - Operation status changes
- `vulnerability.discovered` - New vulnerability discovered
- `system.alert` - System alerts and notifications

### Example: Agent Status Update

```json
{
  "type": "agent.status",
  "data": {
    "agentId": "agent_001",
    "status": "active",
    "lastSeen": "2025-01-11T09:30:00Z"
  },
  "timestamp": "2025-01-11T09:30:00Z"
}
```

---

## Code Examples

### JavaScript/Node.js

```javascript
// Authenticate
const response = await fetch('http://localhost:3000/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'password123',
  }),
  credentials: 'include', // Important for session cookies
});

const data = await response.json();
console.log('Logged in:', data.user);

// List targets
const targetsResponse = await fetch('http://localhost:3000/api/v1/targets', {
  credentials: 'include',
});

const targets = await targetsResponse.json();
console.log('Targets:', targets);
```

### Python

```python
import requests

# Create session for cookie persistence
session = requests.Session()

# Authenticate
response = session.post(
    'http://localhost:3000/api/v1/auth/login',
    json={
        'username': 'admin',
        'password': 'password123'
    }
)

user = response.json()['user']
print(f"Logged in as: {user['username']}")

# List targets
targets_response = session.get('http://localhost:3000/api/v1/targets')
targets = targets_response.json()['targets']
print(f"Found {len(targets)} targets")
```

### cURL

```bash
# Login and save cookies
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  -c cookies.txt

# List targets using saved cookies
curl http://localhost:3000/api/v1/targets \
  -b cookies.txt
```

---

## Security Considerations

1. **HTTPS Required in Production**: Always use HTTPS in production environments
2. **CSRF Protection**: Include CSRF token in state-changing requests
3. **Rate Limiting**: Respect rate limits to avoid account lockouts
4. **Session Management**: Sessions expire after inactivity
5. **Audit Logging**: All operations are logged for security audit trails
6. **Role-Based Access**: Ensure users have minimum required permissions
7. **Password Requirements**: Enforce strong password policies
8. **OAuth Scopes**: Limit OAuth scopes to required permissions only

---

## Support

For API support and questions:
- Review the main [README.md](../README.md)
- Check the [Development Guide](DEVELOPMENT.md)
- Consult the [Deployment Guide](DEPLOYMENT.md)
