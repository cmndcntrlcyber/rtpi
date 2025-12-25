# Empire C2 Integration - User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Server Management](#server-management)
4. [Listener Management](#listener-management)
5. [Agent Management](#agent-management)
6. [Task Execution](#task-execution)
7. [Credential Harvesting](#credential-harvesting)
8. [AI Agent Integration](#ai-agent-integration)
9. [Best Practices](#best-practices)
10. [FAQs](#faqs)

## Introduction

The Empire C2 integration allows RTPI to connect to PowerShell Empire command and control servers for advanced post-exploitation operations. This integration provides:

- **Server Management:** Connect to multiple Empire servers
- **Listener Control:** Create and manage Empire listeners
- **Agent Operations:** Control Empire agents and execute tasks
- **Credential Harvesting:** Collect and view harvested credentials
- **AI Integration:** Autonomous task execution through Operation Lead agent

### Prerequisites

- RTPI platform installed and running
- Access to an Empire C2 server (version 4.x or later)
- Empire REST API enabled and accessible
- Valid Empire admin credentials

## Getting Started

### Accessing the Empire Interface

1. Log into RTPI
2. Navigate to **External Services** in the left sidebar
3. Click the **Empire** tab

You'll see three main sections:
- **Stats Cards:** Server, listener, and agent counts
- **Navigation Tabs:** Servers, Listeners, Agents, Credentials
- **Action Buttons:** Create, refresh, and sync operations

## Server Management

### Adding an Empire Server

1. Click **Servers** tab
2. Click **Add Server** button
3. Fill in the server details:
   - **Name:** Descriptive name (e.g., "Production Empire")
   - **Host:** Empire server hostname or IP
   - **Port:** REST API port (default: 1337)
   - **REST API URL:** Full URL (e.g., `https://empire.example.com:1337`)
   - **Admin Username:** Empire admin username
   - **Admin Password:** Empire admin password

4. Click **Create Server**

**Note:** The server will initially show as "disconnected" until you check the connection.

### Checking Server Connection

1. Find your server card in the Servers view
2. Click **Check Connection**
3. Status indicators:
   - 🟢 **Connected:** Server is online and accessible
   - 🔴 **Disconnected:** Cannot reach server
   - 🟡 **Error:** Authentication or configuration issue

### Refreshing Server Token

If your connection becomes stale:

1. Click **Refresh Token** on the server card
2. A new authentication token will be generated
3. Connection status updates automatically

### Server Status Information

Each server card displays:
- **Name and URL**
- **Connection Status**
- **Empire Version** (when connected)
- **Last Heartbeat** timestamp
- **Active/Inactive** toggle

## Listener Management

### Understanding Listeners

Empire listeners are the components that wait for agent callbacks. Common listener types:
- **HTTP:** Standard HTTP listener
- **HTTPS:** Encrypted HTTP listener
- **HTTP_COM:** HTTP with COM objects
- **HTTP_HOP:** HTTP hop listener (redirector)

### Creating a Listener

1. Navigate to **Listeners** tab
2. Click **Create Listener**
3. Configure listener settings:
   - **Name:** Unique listener name
   - **Type:** Select listener type
   - **Host:** Listener bind address (0.0.0.0 for all interfaces)
   - **Port:** Listener port (e.g., 8080)
   - **Cert Path:** SSL certificate path (for HTTPS)
   - **Staging Key:** Encryption key for staging
   - **Default Delay:** Agent callback delay (seconds)
   - **Default Jitter:** Randomization percentage (0-1)

4. Click **Create Listener**

### Managing Listeners

**View Active Listeners:**
- The Listeners table shows all configured listeners
- Green indicators show active/running listeners
- Port and type information displayed

**Stop a Listener:**
1. Find the listener in the table
2. Click the **Stop** button (trash icon)
3. Confirm the action

**Refresh Listeners:**
- Click the **Refresh** button to update the list

## Agent Management

### Viewing Agents

Navigate to the **Agents** tab to see all Empire agents:

**Agent Information Displayed:**
- **Agent Name:** Unique identifier
- **Host:** Hostname and internal IP
- **User:** Current user context
- **Integrity:** HIGH (admin) or LOW (user)
- **Process:** Running process (PID)
- **OS:** Operating system details
- **Status:** Active, Stale, or Lost
- **Last Seen:** Last callback timestamp

### Agent Status Indicators

- 🟢 **Active:** Checked in within last 5 minutes
- 🟡 **Stale:** Last seen 5-60 minutes ago
- ⚠️ **Lost:** No callback for over 1 hour

### Syncing Agents to Database

1. Click **Sync to Database** button
2. All Empire agents are imported to RTPI database
3. Agents become available for AI agent workflows
4. Use refresh button to update agent list

## Task Execution

### Executing Shell Commands

1. Navigate to **Agents** tab
2. Find the target agent
3. Click **Shell** button
4. In the dialog:
   - Select **Shell Command** mode
   - Enter your command (e.g., `whoami`)
   - Click **Execute Shell Command**

5. Result notification shows:
   - ✅ **Task Submitted:** Command queued successfully
   - ❌ **Execution Failed:** Error occurred
   - **Task ID:** Reference number for tracking

### Executing Empire Modules

1. Click **Shell** button on target agent
2. Select **Module Execution** mode
3. Choose a module from dropdown
4. Configure module options:
   - Required parameters marked with *
   - Descriptions provided for each option
   - Default values pre-filled

5. Click **Execute Module**

**Popular Modules:**
- `powershell/situational_awareness/host/winenum` - Windows enumeration
- `powershell/credentials/mimikatz/logonpasswords` - Credential dumping
- `powershell/lateral_movement/invoke_wmi` - WMI lateral movement
- `powershell/collection/screenshot` - Take screenshot

### Viewing Task Results

Task results are displayed in:
- Real-time notifications during execution
- Empire web interface (if enabled)
- RTPI workflow logs (for AI agent tasks)

**Note:** Shell command outputs appear in the Empire agent's task queue, not directly in RTPI.

### Killing an Agent

⚠️ **Warning:** This action cannot be undone.

1. Find the agent in the Agents table
2. Click the **Kill** button (skull icon)
3. Confirm the action
4. Agent will execute kill command on next callback

## Credential Harvesting

### Viewing Harvested Credentials

1. Navigate to **Credentials** tab
2. View all credentials collected by Empire agents

**Information Displayed:**
- **Type:** Plaintext, Hash, Token, Kerberos
- **Username:** Account name
- **Host:** Source computer (if available)
- **Secret:** Password or hash (hidden by default)
- **OS:** Operating system
- **Harvested At:** Timestamp

### Managing Credentials

**Show/Hide Secrets:**
- Click the eye icon to reveal passwords/hashes
- Click again to hide

**Copy to Clipboard:**
- Click the copy icon next to any secret
- Green checkmark confirms copy success

**Sync Credentials:**
1. Click **Sync from Empire** button
2. Latest credentials fetched from Empire server
3. Database updated with new entries

**Refresh View:**
- Click **Refresh** to reload credential list

### Credential Summary

The footer shows:
- **Total:** All credentials count
- **Plaintext:** Clear-text passwords count
- **Hashes:** NTLM/SHA256 hashes count

## AI Agent Integration

### How Empire Integrates with AI Agents

The Operation Lead agent can automatically leverage Empire infrastructure for post-exploitation:

1. **Detection:** Agent detects available Empire servers and agents
2. **Planning:** Includes Empire tasks in execution plan alongside Metasploit
3. **Execution:** Runs Empire modules and shell commands autonomously
4. **Reporting:** Results included in penetration test reports

### Workflow Integration

When you start a penetration test workflow:

**Phase 1 - Operation Lead:**
- Analyzes target
- Detects Empire infrastructure
- Creates execution plan with:
  - Metasploit exploits (initial access)
  - Empire tasks (post-exploitation)

**Phase 2 - Senior Cyber Operator:**
- Executes Metasploit modules
- Executes Empire tasks on available agents
- Collects results from both frameworks

**Phase 3 - Technical Writer:**
- Generates report including:
  - Exploitation attempts
  - Empire post-exploitation activities
  - Harvested credentials
  - Technical findings

### Example Workflow Output

```json
{
  "metasploitModules": [
    {
      "priority": 1,
      "path": "exploit/windows/smb/ms17_010_eternalblue",
      "reasoning": "EternalBlue exploitation for initial access"
    }
  ],
  "empireTasks": [
    {
      "priority": 2,
      "agentName": "AGENT_XYZ",
      "taskType": "module",
      "command": "powershell/credentials/mimikatz/logonpasswords",
      "reasoning": "Harvest credentials from LSASS"
    }
  ]
}
```

### Viewing AI Agent Logs

1. Navigate to **Operations** → **Agent Workflows**
2. Select a workflow
3. View **Workflow Logs** tab
4. Filter for Empire-related events:
   - "Empire infrastructure"
   - "Empire task"
   - "credentials harvested"

## Best Practices

### Security

1. **Use HTTPS:** Always configure Empire servers with HTTPS
2. **Strong Passwords:** Use complex admin passwords (12+ characters)
3. **Network Isolation:** Keep Empire servers on isolated networks
4. **Token Rotation:** Regularly refresh authentication tokens
5. **Audit Logs:** Review Empire operations regularly

### Operational

1. **Name Conventions:** Use descriptive names for servers, listeners, and agents
2. **Listener Ports:** Document all listener ports to avoid conflicts
3. **Agent Tracking:** Sync agents to database for better tracking
4. **Credential Management:** Export credentials regularly for backup
5. **Clean Up:** Remove old listeners and kill inactive agents

### Performance

1. **Callback Delay:** Balance between stealth (higher delay) and responsiveness (lower delay)
2. **Jitter:** Use 20-30% jitter to randomize callbacks
3. **Limit Tasks:** Don't queue too many tasks on one agent
4. **Sync Frequency:** Sync agents/credentials periodically, not continuously

### Compliance

1. **Authorization:** Ensure written authorization for all operations
2. **Scope:** Only target systems within approved scope
3. **Documentation:** Log all actions for audit trail
4. **Data Handling:** Securely store and dispose of harvested data
5. **Reporting:** Include Empire operations in final reports

## FAQs

### General

**Q: Can I connect to multiple Empire servers?**
A: Yes, RTPI supports multiple Empire server connections. Each server is managed independently.

**Q: Does RTPI support Empire 4.x and 5.x?**
A: Yes, the integration is compatible with Empire 4.x and later versions.

**Q: Can I use Empire without AI agents?**
A: Yes, you can manually create listeners, manage agents, and execute tasks through the UI.

### Connectivity

**Q: My server shows "disconnected" even though Empire is running.**
A: Check:
- REST API is enabled in Empire config
- Firewall allows connection to port 1337
- Correct URL format (https://host:port)
- Valid admin credentials

**Q: How do I fix "Token expired" errors?**
A: Click **Refresh Token** on the server card to generate a new authentication token.

### Operations

**Q: Why don't I see my agent's task output?**
A: Task outputs appear in the Empire server's interface, not directly in RTPI. RTPI shows task submission confirmation only.

**Q: Can AI agents create new listeners?**
A: Not currently. Listeners must be created manually. AI agents can only use existing listeners and agents.

**Q: How long are credentials stored?**
A: Credentials are stored indefinitely until manually deleted or server is removed (CASCADE delete).

### Troubleshooting

**Q: Tasks fail with "Agent not found"**
A: The agent may have been killed or lost connection. Check agent status and last seen time.

**Q: Cannot execute modules**
A: Ensure:
- Agent is active (checked in recently)
- Module name is correct
- Required parameters are provided

**Q: Sync operations fail**
A: Verify server connection status and check RTPI backend logs for detailed error messages.

## Support

For additional help:
- **Documentation:** `/docs/admin-guides/empire-c2-admin-guide.md`
- **Troubleshooting:** `/docs/troubleshooting/empire-c2-troubleshooting.md`
- **Security:** `/docs/security/empire-security-audit.md`
- **Issue Tracker:** https://github.com/anthropics/rtpi/issues

**Version:** 1.0.0-beta.1
**Last Updated:** 2025-12-25
