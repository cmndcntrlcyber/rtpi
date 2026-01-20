/**
 * Agent Token Service
 *
 * Manages shareable download tokens for agent bundles.
 * Supports:
 * - Secure token generation
 * - Configurable download limits
 * - Token expiration
 * - Token revocation
 * - Download tracking
 */

import crypto from 'crypto';
import { db } from '@db';
import { agentDownloadTokens, agentBundles } from '@shared/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface TokenGenerationOptions {
  bundleId: string;
  userId: string;
  maxDownloads?: number;
  expiresInHours?: number;
  description?: string;
  allowedIpRanges?: string[];
  metadata?: Record<string, unknown>;
}

export interface GeneratedToken {
  tokenId: string;
  token: string;
  downloadUrl: string;
  expiresAt: Date;
  maxDownloads: number;
}

export interface TokenValidationResult {
  valid: boolean;
  bundleId?: string;
  filePath?: string;
  errorMessage?: string;
}

export interface TokenInfo {
  id: string;
  bundleId: string;
  bundleName?: string;
  maxDownloads: number;
  currentDownloads: number;
  expiresAt: Date;
  description?: string;
  createdAt: Date;
  lastUsedAt?: Date;
  isExpired: boolean;
  isExhausted: boolean;
  isRevoked: boolean;
}

// ============================================================================
// Agent Token Service
// ============================================================================

class AgentTokenService {
  private readonly baseUrl: string;
  private readonly defaultExpirationHours: number;
  private readonly defaultMaxDownloads: number;

  constructor() {
    this.baseUrl = process.env.PUBLIC_URL || 'https://localhost:3000';
    this.defaultExpirationHours = 24;
    this.defaultMaxDownloads = 1;
  }

  /**
   * Generate a new download token for a bundle
   */
  async generateToken(options: TokenGenerationOptions): Promise<GeneratedToken> {
    // Verify bundle exists and is active
    const bundle = await db.query.agentBundles.findFirst({
      where: eq(agentBundles.id, options.bundleId)
    });

    if (!bundle) {
      throw new Error(`Bundle ${options.bundleId} not found`);
    }

    if (!bundle.isActive) {
      throw new Error(`Bundle ${options.bundleId} is not active`);
    }

    // Generate secure token (URL-safe base64)
    const tokenBytes = crypto.randomBytes(32);
    const token = tokenBytes.toString('base64url');

    // Calculate expiration
    const expiresInHours = options.expiresInHours ?? this.defaultExpirationHours;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const maxDownloads = options.maxDownloads ?? this.defaultMaxDownloads;

    // Store token in database
    const [tokenRecord] = await db.insert(agentDownloadTokens).values({
      token,
      bundleId: options.bundleId,
      maxDownloads,
      currentDownloads: 0,
      expiresAt,
      description: options.description,
      allowedIpRanges: options.allowedIpRanges || [],
      createdBy: options.userId,
      metadata: options.metadata || {},
    }).returning();

    const downloadUrl = `${this.baseUrl}/api/v1/public/agents/download/${token}`;

    console.log(`[AgentTokenService] Generated token ${tokenRecord.id} for bundle ${options.bundleId}`);

    return {
      tokenId: tokenRecord.id,
      token,
      downloadUrl,
      expiresAt,
      maxDownloads,
    };
  }

  /**
   * Auto-generate a download token for a bundle with default settings
   */
  async autoGenerateToken(bundleId: string, userId: string): Promise<GeneratedToken> {
    const autoGenerate = process.env.AGENT_TOKEN_AUTO_GENERATE !== 'false';

    if (!autoGenerate) {
      throw new Error('Auto-generation disabled');
    }

    const expiresInHours = parseInt(
      process.env.AGENT_TOKEN_DEFAULT_EXPIRATION_HOURS || '24'
    );
    const maxDownloads = parseInt(
      process.env.AGENT_TOKEN_DEFAULT_MAX_DOWNLOADS || '1'
    );

    return this.generateToken({
      bundleId,
      userId,
      maxDownloads,
      expiresInHours,
      description: 'Auto-generated download token',
    });
  }

  /**
   * Validate a download token
   */
  async validateToken(token: string, clientIp?: string): Promise<TokenValidationResult> {
    // Find token
    const tokenRecord = await db.query.agentDownloadTokens.findFirst({
      where: eq(agentDownloadTokens.token, token)
    });

    if (!tokenRecord) {
      return { valid: false, errorMessage: 'Token not found' };
    }

    // Check if revoked
    if (tokenRecord.revokedAt) {
      return { valid: false, errorMessage: 'Token has been revoked' };
    }

    // Check expiration
    if (new Date() > tokenRecord.expiresAt) {
      return { valid: false, errorMessage: 'Token has expired' };
    }

    // Check download limit
    if (tokenRecord.currentDownloads >= tokenRecord.maxDownloads) {
      return { valid: false, errorMessage: 'Download limit exceeded' };
    }

    // Check IP restrictions (if configured)
    if (clientIp && tokenRecord.allowedIpRanges && (tokenRecord.allowedIpRanges as string[]).length > 0) {
      const isAllowed = this.isIpAllowed(clientIp, tokenRecord.allowedIpRanges as string[]);
      if (!isAllowed) {
        return { valid: false, errorMessage: 'IP address not allowed' };
      }
    }

    // Get bundle
    const bundle = await db.query.agentBundles.findFirst({
      where: eq(agentBundles.id, tokenRecord.bundleId)
    });

    if (!bundle) {
      return { valid: false, errorMessage: 'Associated bundle not found' };
    }

    if (!bundle.isActive) {
      return { valid: false, errorMessage: 'Bundle is no longer active' };
    }

    return {
      valid: true,
      bundleId: bundle.id,
      filePath: bundle.filePath,
    };
  }

  /**
   * Record a successful download
   */
  async recordDownload(token: string): Promise<void> {
    const tokenRecord = await db.query.agentDownloadTokens.findFirst({
      where: eq(agentDownloadTokens.token, token)
    });

    if (tokenRecord) {
      await db.update(agentDownloadTokens)
        .set({
          currentDownloads: tokenRecord.currentDownloads + 1,
          lastUsedAt: new Date(),
        })
        .where(eq(agentDownloadTokens.id, tokenRecord.id));

      // Also increment bundle download count
      const bundle = await db.query.agentBundles.findFirst({
        where: eq(agentBundles.id, tokenRecord.bundleId)
      });

      if (bundle) {
        await db.update(agentBundles)
          .set({ downloadCount: (bundle.downloadCount || 0) + 1 })
          .where(eq(agentBundles.id, bundle.id));
      }
    }
  }

  /**
   * Revoke a token
   */
  async revokeToken(tokenId: string, userId: string): Promise<boolean> {
    const result = await db.update(agentDownloadTokens)
      .set({
        revokedAt: new Date(),
        revokedBy: userId,
      })
      .where(eq(agentDownloadTokens.id, tokenId));

    console.log(`[AgentTokenService] Token ${tokenId} revoked by user ${userId}`);
    return true;
  }

  /**
   * Get token info
   */
  async getTokenInfo(tokenId: string): Promise<TokenInfo | null> {
    const tokenRecord = await db.query.agentDownloadTokens.findFirst({
      where: eq(agentDownloadTokens.id, tokenId)
    });

    if (!tokenRecord) {
      return null;
    }

    // Get bundle name
    const bundle = await db.query.agentBundles.findFirst({
      where: eq(agentBundles.id, tokenRecord.bundleId)
    });

    const now = new Date();

    return {
      id: tokenRecord.id,
      bundleId: tokenRecord.bundleId,
      bundleName: bundle?.name,
      maxDownloads: tokenRecord.maxDownloads,
      currentDownloads: tokenRecord.currentDownloads,
      expiresAt: tokenRecord.expiresAt,
      description: tokenRecord.description || undefined,
      createdAt: tokenRecord.createdAt,
      lastUsedAt: tokenRecord.lastUsedAt || undefined,
      isExpired: now > tokenRecord.expiresAt,
      isExhausted: tokenRecord.currentDownloads >= tokenRecord.maxDownloads,
      isRevoked: !!tokenRecord.revokedAt,
    };
  }

  /**
   * List tokens for a bundle
   */
  async listTokensForBundle(bundleId: string): Promise<TokenInfo[]> {
    const tokens = await db.select()
      .from(agentDownloadTokens)
      .where(eq(agentDownloadTokens.bundleId, bundleId))
      .orderBy(agentDownloadTokens.createdAt);

    const bundle = await db.query.agentBundles.findFirst({
      where: eq(agentBundles.id, bundleId)
    });

    const now = new Date();

    return tokens.map(token => ({
      id: token.id,
      bundleId: token.bundleId,
      bundleName: bundle?.name,
      maxDownloads: token.maxDownloads,
      currentDownloads: token.currentDownloads,
      expiresAt: token.expiresAt,
      description: token.description || undefined,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt || undefined,
      isExpired: now > token.expiresAt,
      isExhausted: token.currentDownloads >= token.maxDownloads,
      isRevoked: !!token.revokedAt,
    }));
  }

  /**
   * List all active tokens
   */
  async listActiveTokens(limit = 50): Promise<TokenInfo[]> {
    const now = new Date();

    const tokens = await db.select()
      .from(agentDownloadTokens)
      .where(
        and(
          gt(agentDownloadTokens.expiresAt, now),
          isNull(agentDownloadTokens.revokedAt)
        )
      )
      .orderBy(agentDownloadTokens.createdAt)
      .limit(limit);

    const bundleIds = [...new Set(tokens.map(t => t.bundleId))];
    const bundles = await Promise.all(
      bundleIds.map(id => db.query.agentBundles.findFirst({
        where: eq(agentBundles.id, id)
      }))
    );

    const bundleMap = new Map(bundles.filter(Boolean).map(b => [b!.id, b!]));

    return tokens.map(token => ({
      id: token.id,
      bundleId: token.bundleId,
      bundleName: bundleMap.get(token.bundleId)?.name,
      maxDownloads: token.maxDownloads,
      currentDownloads: token.currentDownloads,
      expiresAt: token.expiresAt,
      description: token.description || undefined,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt || undefined,
      isExpired: now > token.expiresAt,
      isExhausted: token.currentDownloads >= token.maxDownloads,
      isRevoked: !!token.revokedAt,
    }));
  }

  /**
   * Cleanup expired tokens
   */
  async cleanupExpiredTokens(olderThanDays = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    // Find and count expired tokens older than cutoff
    const expiredTokens = await db.select()
      .from(agentDownloadTokens)
      .where(gt(cutoff, agentDownloadTokens.expiresAt));

    // Note: In production, you might want to soft delete or archive instead
    console.log(`[AgentTokenService] Found ${expiredTokens.length} expired tokens`);

    return expiredTokens.length;
  }

  /**
   * Check if IP is in allowed ranges (CIDR notation)
   */
  private isIpAllowed(ip: string, allowedRanges: string[]): boolean {
    // Simple implementation - for production, use a proper CIDR library
    for (const range of allowedRanges) {
      if (range === ip) {
        return true;
      }
      // For CIDR ranges, would need proper subnet checking
      // This is a simplified version
      if (range.includes('/')) {
        const [network] = range.split('/');
        if (ip.startsWith(network.substring(0, network.lastIndexOf('.')))) {
          return true;
        }
      }
    }
    return false;
  }
}

// Singleton export
export const agentTokenService = new AgentTokenService();
