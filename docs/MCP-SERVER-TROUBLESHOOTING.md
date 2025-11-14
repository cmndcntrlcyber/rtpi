# MCP Server Troubleshooting & Fix

## Problem Identified

The Tavily Search server was showing "stopped" status with 0 connections because:
- The MCP server endpoints were only updating database status
- No actual process management was implemented
- Servers were never being started as actual child processes

## Solution Implemented

### 1. Created MCP Server Manager Service
**File:** `server/services/mcp-server-manager.ts`

Features:
- **Process Spawning**: Actually spawns MCP server processes using Node's `child_process.spawn()`
- **Process Tracking**: Maintains a Map of running processes with PIDs
- **Health Monitoring**: 30-second health check interval
- **Auto-Restart**: Handles server failures with configurable retry limits
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT

### 2. Updated API Endpoints
**File:** `server/api/v1/mcp-servers.ts`

Changes:
- **Start Endpoint**: Now calls `mcpServerManager.startServer(id)`
- **Stop Endpoint**: Now calls `mcpServerManager.stopServer(id)`
- **Restart Endpoint**: Now calls `mcpServerManager.restartServer(id)`

All endpoints:
- Actually manage real processes
- Update database status based on real process state
- Return proper success/failure responses

### 3. Added UI Controls
**File:** `client/src/pages/Agents.tsx`

Features:
- **Start Button**: Appears when server status is "stopped"
- **Stop Button**: Appears when server status is "running"
- **Auto-refresh**: Server status refreshes every 3 seconds
- **Success Alerts**: User feedback when operations complete

## How to Use

### Starting the Tavily Server:

1. Navigate to Agents page → MCP Servers tab
2. Find "Tavily Search server" card
3. Click "Start Server" button
4. Wait for success alert
5. Status should change to "running" (green)
6. "Connected" count should increment to 1

### Stopping the Server:

1. Click "Stop Server" button on running server
2. Wait for success alert
3. Status changes to "stopped" (gray)
4. "Connected" count decrements

### Health Monitoring:

The server manager automatically:
- Checks all servers every 30 seconds
- Detects dead processes
- Auto-restarts if enabled (default: enabled)
- Maximum retry attempts: 3 (configurable)

## Technical Details

### Process Spawning
```typescript
spawn(command, args, {
  env: { ...process.env, ...customEnv },
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

### Database Tracking
```typescript
{
  status: "running" | "stopped" | "error",
  pid: number | null,
  uptime: Date | null,
  restartCount: number,
  lastError: string | null
}
```

### Error Handling
- Process errors trigger auto-restart
- Exit events are logged and handled
- Status updates reflect actual process state
- Failed restarts are limited by maxRestarts

## Testing

To verify the fix works:

1. **Check Initial State**
   - Server should show "stopped"
   - Connected should be 0

2. **Start Server**
   - Click "Start Server"
   - Check browser console for PID
   - Status should change to "running"
   - Connected should change to 1

3. **Verify Process**
   ```bash
   # Check if npx process is running
   ps aux | grep tavily-mcp
   ```

4. **Test Auto-Restart**
   - Kill the process manually
   - Server should auto-restart within 2 seconds
   - Status should remain "running"

5. **Stop Server**
   - Click "Stop Server"
   - Process should be killed
   - Status should change to "stopped"

## Next Steps

After starting the server:
- Configure agents to use the MCP server
- Test Tavily tool calls (search, extract, crawl, map)
- Verify AI Assist feature in vulnerability dialog
- Check that configuration persists across sessions

## Troubleshooting

### Server Won't Start
- Check server logs for errors
- Verify `npx -y tavily-mcp@latest` works manually
- Check database for `lastError` field
- Ensure Node.js has permission to spawn processes

### Auto-Restart Not Working
- Check `autoRestart` is enabled in database
- Verify `restartCount` < `maxRestarts`
- Check server logs for failure reasons

### Status Not Updating
- Verify health check is running (30s interval)
- Check database connection
- Refresh the page to trigger re-fetch

## Files Modified/Created

1. ✅ `server/services/mcp-server-manager.ts` - NEW
2. ✅ `server/api/v1/mcp-servers.ts` - UPDATED
3. ✅ `client/src/pages/Agents.tsx` - UPDATED
4. ✅ `docs/MCP-SERVER-TROUBLESHOOTING.md` - NEW

All TypeScript errors have been resolved and the implementation is complete!
