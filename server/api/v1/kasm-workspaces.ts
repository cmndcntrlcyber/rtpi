import { Router } from 'express';
import { ensureAuthenticated, ensureRole } from '../../auth/middleware';
import { kasmWorkspaceManager } from '../../services/kasm-workspace-manager';
import type { WorkspaceConfig } from '../../services/kasm-workspace-manager';

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

/**
 * Kasm Workspaces API
 * Provides endpoints for managing browser-based containerized workspaces
 */

// ============================================================================
// Workspace Management
// ============================================================================

/**
 * List all workspaces for the authenticated user
 * GET /api/v1/kasm-workspaces
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const includeTerminated = req.query.includeTerminated === 'true';
    const workspaces = await kasmWorkspaceManager.listUserWorkspaces(userId, includeTerminated);

    res.json(workspaces);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to list workspaces' });
  }
});

/**
 * Get a specific workspace by ID
 * GET /api/v1/kasm-workspaces/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await kasmWorkspaceManager.getWorkspace(req.params.id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user owns the workspace or has access via sharing
    const metadata = workspace.metadata as Record<string, any> || {};
    const sharedWith = metadata.sharedWith || [];
    const hasAccess = workspace.userId === userId || sharedWith.some((s: any) => s.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(workspace);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get workspace' });
  }
});

/**
 * Provision a new workspace
 * POST /api/v1/kasm-workspaces
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      workspaceType,
      workspaceName,
      operationId,
      cpuLimit,
      memoryLimit,
      expiryHours,
      metadata,
    } = req.body;

    if (!workspaceType) {
      return res.status(400).json({ error: 'workspaceType is required' });
    }

    const validTypes = ['vscode', 'burp', 'kali', 'firefox', 'empire'];
    if (!validTypes.includes(workspaceType)) {
      return res.status(400).json({
        error: `Invalid workspaceType. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const config: WorkspaceConfig = {
      userId,
      workspaceType,
      workspaceName,
      operationId,
      cpuLimit,
      memoryLimit,
      expiryHours,
      metadata,
    };

    const result = await kasmWorkspaceManager.provisionWorkspace(config);

    res.status(201).json(result);
  } catch (error: any) {
    // Error logged for debugging
    const message = error instanceof Error ? error.message : 'Failed to provision workspace';
    res.status(500).json({ error: message });
  }
});

/**
 * Terminate a workspace
 * DELETE /api/v1/kasm-workspaces/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await kasmWorkspaceManager.getWorkspace(req.params.id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Only the owner can terminate the workspace
    if (workspace.userId !== userId) {
      return res.status(403).json({ error: 'Only the workspace owner can terminate it' });
    }

    await kasmWorkspaceManager.terminateWorkspace(req.params.id);

    res.json({ message: 'Workspace terminated successfully' });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to terminate workspace' });
  }
});

/**
 * Extend workspace expiry
 * POST /api/v1/kasm-workspaces/:id/extend
 */
router.post('/:id/extend', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await kasmWorkspaceManager.getWorkspace(req.params.id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (workspace.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { hours } = req.body;
    if (!hours || hours <= 0) {
      return res.status(400).json({ error: 'hours must be a positive number' });
    }

    const newExpiry = await kasmWorkspaceManager.extendWorkspaceExpiry(req.params.id, hours);

    res.json({ expiresAt: newExpiry });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to extend workspace expiry' });
  }
});

// ============================================================================
// Session Management
// ============================================================================

/**
 * Create a new session for accessing a workspace
 * POST /api/v1/kasm-workspaces/:id/sessions
 */
router.post('/:id/sessions', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await kasmWorkspaceManager.getWorkspace(req.params.id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check access rights
    const metadata = workspace.metadata as Record<string, any> || {};
    const sharedWith = metadata.sharedWith || [];
    const hasAccess = workspace.userId === userId || sharedWith.some((s: any) => s.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const session = await kasmWorkspaceManager.createSession(req.params.id, userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(session);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * Get active sessions for a workspace
 * GET /api/v1/kasm-workspaces/:id/sessions
 */
router.get('/:id/sessions', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await kasmWorkspaceManager.getWorkspace(req.params.id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Only owner can view all sessions
    if (workspace.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sessions = await kasmWorkspaceManager.getActiveSessions(req.params.id);

    res.json(sessions);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * Update session activity (heartbeat)
 * POST /api/v1/kasm-workspaces/sessions/:token/heartbeat
 */
router.post('/sessions/:token/heartbeat', async (req, res) => {
  try {
    await kasmWorkspaceManager.updateSessionActivity(req.params.token);
    res.json({ message: 'Activity updated' });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to update session activity' });
  }
});

/**
 * Terminate a session
 * DELETE /api/v1/kasm-workspaces/sessions/:token
 */
router.delete('/sessions/:token', async (req, res) => {
  try {
    await kasmWorkspaceManager.terminateSession(req.params.token);
    res.json({ message: 'Session terminated' });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

// ============================================================================
// Resource Management
// ============================================================================

/**
 * Get user's resource usage and quota
 * GET /api/v1/kasm-workspaces/resources/usage
 */
router.get('/resources/usage', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const usage = await kasmWorkspaceManager.getUserResourceUsage(userId);

    res.json(usage);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get resource usage' });
  }
});

/**
 * Get workspaces expiring soon
 * GET /api/v1/kasm-workspaces/expiring
 */
router.get('/expiring', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const allExpiring = await kasmWorkspaceManager.getExpiringSoonWorkspaces();

    // Filter to only user's workspaces
    const userExpiring = allExpiring.filter(ws => ws.userId === userId);

    res.json(userExpiring);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get expiring workspaces' });
  }
});

// ============================================================================
// Workspace Sharing
// ============================================================================

/**
 * Share workspace with another user
 * POST /api/v1/kasm-workspaces/:id/share
 */
router.post('/:id/share', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await kasmWorkspaceManager.getWorkspace(req.params.id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Only owner can share
    if (workspace.userId !== userId) {
      return res.status(403).json({ error: 'Only the workspace owner can share it' });
    }

    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const session = await kasmWorkspaceManager.shareWorkspace(req.params.id, targetUserId);

    res.status(201).json(session);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to share workspace' });
  }
});

/**
 * Revoke workspace sharing
 * DELETE /api/v1/kasm-workspaces/:id/share/:targetUserId
 */
router.delete('/:id/share/:targetUserId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await kasmWorkspaceManager.getWorkspace(req.params.id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Only owner can revoke sharing
    if (workspace.userId !== userId) {
      return res.status(403).json({ error: 'Only the workspace owner can revoke sharing' });
    }

    await kasmWorkspaceManager.revokeWorkspaceSharing(req.params.id, req.params.targetUserId);

    res.json({ message: 'Workspace sharing revoked' });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to revoke workspace sharing' });
  }
});

// ============================================================================
// Workspace Snapshots
// ============================================================================

/**
 * Create a snapshot of a workspace
 * POST /api/v1/kasm-workspaces/:id/snapshots
 */
router.post('/:id/snapshots', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await kasmWorkspaceManager.getWorkspace(req.params.id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Only owner can create snapshots
    if (workspace.userId !== userId) {
      return res.status(403).json({ error: 'Only the workspace owner can create snapshots' });
    }

    const { snapshotName, metadata } = req.body;
    if (!snapshotName) {
      return res.status(400).json({ error: 'snapshotName is required' });
    }

    const snapshot = await kasmWorkspaceManager.createSnapshot(req.params.id, snapshotName, metadata);

    res.status(201).json(snapshot);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

/**
 * List snapshots for a workspace
 * GET /api/v1/kasm-workspaces/:id/snapshots
 */
router.get('/:id/snapshots', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await kasmWorkspaceManager.getWorkspace(req.params.id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (workspace.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const snapshots = await kasmWorkspaceManager.listSnapshots(req.params.id);

    res.json(snapshots);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to list snapshots' });
  }
});

/**
 * Restore workspace from snapshot
 * POST /api/v1/kasm-workspaces/:id/snapshots/:snapshotName/restore
 */
router.post('/:id/snapshots/:snapshotName/restore', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await kasmWorkspaceManager.getWorkspace(req.params.id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Only owner can restore snapshots
    if (workspace.userId !== userId) {
      return res.status(403).json({ error: 'Only the workspace owner can restore snapshots' });
    }

    await kasmWorkspaceManager.restoreFromSnapshot(req.params.id, req.params.snapshotName);

    res.json({ message: 'Workspace restored from snapshot' });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to restore from snapshot' });
  }
});

// ============================================================================
// Admin/Maintenance Endpoints
// ============================================================================

/**
 * Manually trigger cleanup of expired workspaces (admin only)
 * POST /api/v1/kasm-workspaces/admin/cleanup
 */
router.post('/admin/cleanup', ensureRole('admin'), async (_req, res) => {
  try {
    const workspacesCount = await kasmWorkspaceManager.cleanupExpiredWorkspaces();
    const sessionsCount = await kasmWorkspaceManager.cleanupExpiredSessions();

    res.json({
      message: 'Cleanup completed',
      workspacesTerminated: workspacesCount,
      sessionsTerminated: sessionsCount,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to run cleanup' });
  }
});

export default router;
