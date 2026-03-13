/**
 * Bug Bounty Program Import Service
 *
 * Parses bug bounty program scope files (HackerOne CSV + Burp project config JSON)
 * and creates operations with targets from the extracted scope data.
 *
 * Supports:
 * - HackerOne CSV scope export (comma-delimited)
 * - HackerOne Burp Suite project configuration JSON
 * - URL-based fetch from HackerOne teams endpoint
 * - Direct file upload
 */

import { db } from '../db';
import { operations, targets } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { buildOperationTag } from './operation-tag-helper';

// ============================================================================
// Types
// ============================================================================

export interface ParsedScopeEntry {
  identifier: string;
  assetType: string;
  rtpiTargetType: 'ip' | 'domain' | 'url' | 'network' | 'range' | null;
  eligibleForBounty: boolean;
  eligibleForSubmission: boolean;
  maxSeverity: string;
  environmentalModifiers: {
    availabilityRequirement: string;
    confidentialityRequirement: string;
    integrityRequirement: string;
  };
  tags: string[];
  instruction?: string;
}

export interface ParsedBountyScope {
  programName: string;
  platform: string;
  inScope: ParsedScopeEntry[];
  outOfScope: ParsedScopeEntry[];
  burpProjectConfig?: any;
}

export interface ImportOptions {
  operationName?: string;
  operationId?: string;
  autoActivate?: boolean;
  authHeaders?: Record<string, string>;
}

export interface BugBountyImportResult {
  success: boolean;
  operationId: string;
  operationName: string;
  targetsCreated: number;
  scopeEntriesTotal: number;
  scopeEntriesSkipped: number;
  burpConfigStored: boolean;
  autoActivated: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** HackerOne asset types that map to RTPI target types */
const ASSET_TYPE_MAP: Record<string, 'ip' | 'domain' | 'url' | 'network' | 'range' | null> = {
  'URL': 'url',
  'DOMAIN': 'domain',
  'WILDCARD': 'domain',
  'CIDR': 'network',
  // Non-targetable types
  'SOURCE_CODE': null,
  'EXECUTABLE': null,
  'HARDWARE': null,
  'OTHER': null,
  'GOOGLE_PLAY_APP_ID': null,
  'APPLE_STORE_APP_ID': null,
  'TESTFLIGHT': null,
  'IPA': null,
  'APK': null,
  'WINDOWS_STORE_APP_ID': null,
  'AI_MODEL': null,
  'SMART_CONTRACT': null,
};

const SEVERITY_PRIORITY: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
  none: 5,
};

// ============================================================================
// Service
// ============================================================================

class BugBountyImportService {

  /**
   * Fetch scope files from HackerOne by program slug and create operation.
   */
  async importFromUrl(
    programSlug: string,
    platform: 'hackerone',
    userId: string,
    options?: ImportOptions
  ): Promise<BugBountyImportResult> {
    const baseUrl = `https://hackerone.com/teams/${programSlug}/assets`;
    const csvUrl = `${baseUrl}/download_csv.csv`;
    const burpUrl = `${baseUrl}/download_burp_project_file.json`;

    const fetchOpts: RequestInit = {};
    if (options?.authHeaders) {
      fetchOpts.headers = options.authHeaders;
    }

    // Fetch CSV (required)
    let csvContent: string;
    try {
      const csvResponse = await fetch(csvUrl, fetchOpts);
      if (!csvResponse.ok) {
        throw new Error(`HackerOne CSV fetch failed (${csvResponse.status}). For private programs, provide auth headers or upload files directly.`);
      }
      csvContent = await csvResponse.text();
    } catch (err: any) {
      if (err.message.includes('HackerOne CSV fetch failed')) throw err;
      throw new Error(`Failed to fetch from HackerOne: ${err.message}. Try uploading files directly.`);
    }

    // Fetch Burp JSON (optional)
    let burpContent: string | undefined;
    try {
      const burpResponse = await fetch(burpUrl, fetchOpts);
      if (burpResponse.ok) {
        burpContent = await burpResponse.text();
      }
    } catch {
      // Burp config is optional
    }

    return this.importFromFiles({ csv: csvContent, burpJson: burpContent }, userId, {
      ...options,
      operationName: options?.operationName || `Bug Bounty: ${programSlug}`,
    });
  }

  /**
   * Import from directly uploaded files.
   */
  async importFromFiles(
    files: { csv?: string; burpJson?: string },
    userId: string,
    options?: ImportOptions
  ): Promise<BugBountyImportResult> {
    if (!files.csv && !files.burpJson) {
      throw new Error('At least one file (CSV or Burp JSON) is required.');
    }

    const scope = this.parseFiles(files);

    // Apply operation name override
    if (options?.operationName) {
      scope.programName = options.operationName;
    }

    return this.createOperationAndTargets(scope, userId, options);
  }

  /**
   * Import scope into an existing operation (add targets without creating a new operation).
   */
  async importIntoExistingOperation(
    files: { csv?: string; burpJson?: string },
    operationId: string,
    userId: string,
  ): Promise<BugBountyImportResult> {
    if (!files.csv && !files.burpJson) {
      throw new Error('At least one file (CSV or Burp JSON) is required.');
    }

    // Verify operation exists
    const [operation] = await db.select().from(operations).where(eq(operations.id, operationId)).limit(1);
    if (!operation) {
      throw new Error('Operation not found.');
    }

    const scope = this.parseFiles(files);

    const targetableInScope = scope.inScope.filter(e => e.rtpiTargetType !== null);
    const nonTargetableInScope = scope.inScope.filter(e => e.rtpiTargetType === null);

    // Get existing target values for this operation to avoid duplicates
    const existingTargets = await db.select({ value: targets.value }).from(targets).where(eq(targets.operationId, operationId));
    const existingValues = new Set(existingTargets.map(t => t.value));

    const opTag = buildOperationTag(operation.name);
    let targetsCreated = 0;

    for (const entry of targetableInScope) {
      const value = this.normalizeIdentifierForTarget(entry.identifier, entry.rtpiTargetType!);
      if (!value || existingValues.has(value)) continue;
      existingValues.add(value);

      try {
        const priority = SEVERITY_PRIORITY[entry.maxSeverity] || 3;

        await db.insert(targets).values({
          name: value,
          type: entry.rtpiTargetType!,
          value,
          description: entry.instruction || `Imported from ${scope.platform} bug bounty program`,
          priority,
          tags: ['auto-created', 'bug-bounty', scope.platform, opTag],
          operationId,
          autoCreated: true,
          metadata: {
            source: 'bug-bounty-import',
            platform: scope.platform,
            bounty: {
              originalIdentifier: entry.identifier,
              eligibleForBounty: entry.eligibleForBounty,
              eligibleForSubmission: entry.eligibleForSubmission,
              maxSeverity: entry.maxSeverity,
              environmentalModifiers: entry.environmentalModifiers,
              instruction: entry.instruction,
            },
            originalAssetType: entry.assetType,
            autoCreatedAt: new Date().toISOString(),
          },
        });
        targetsCreated++;
      } catch (err) {
        console.warn(`[BugBountyImport] Failed to create target for ${value}:`, err);
      }
    }

    // Merge bug bounty metadata into operation
    const existingMeta = (operation.metadata as any) || {};
    const updatedMeta = {
      ...existingMeta,
      bugBounty: {
        ...(existingMeta.bugBounty || {}),
        platform: scope.platform,
        importedAt: new Date().toISOString(),
        inScope: [
          ...(existingMeta.bugBounty?.inScope || []),
          ...scope.inScope.map(e => ({
            identifier: e.identifier,
            assetType: e.assetType,
            eligibleForBounty: e.eligibleForBounty,
            eligibleForSubmission: e.eligibleForSubmission,
            maxSeverity: e.maxSeverity,
            instruction: e.instruction,
          })),
        ],
        outOfScope: [
          ...(existingMeta.bugBounty?.outOfScope || []),
          ...scope.outOfScope.map(e => ({
            identifier: e.identifier,
            assetType: e.assetType,
            instruction: e.instruction,
          })),
        ],
        nonTargetableAssets: [
          ...(existingMeta.bugBounty?.nonTargetableAssets || []),
          ...nonTargetableInScope.map(e => ({
            identifier: e.identifier,
            assetType: e.assetType,
            eligibleForBounty: e.eligibleForBounty,
            maxSeverity: e.maxSeverity,
          })),
        ],
      },
    };

    if (scope.burpProjectConfig) {
      updatedMeta.burpProjectConfig = scope.burpProjectConfig;
    }

    await db.update(operations).set({
      metadata: updatedMeta as any,
      updatedAt: new Date(),
    }).where(eq(operations.id, operationId));

    return {
      success: true,
      operationId,
      operationName: operation.name,
      targetsCreated,
      scopeEntriesTotal: scope.inScope.length + scope.outOfScope.length,
      scopeEntriesSkipped: nonTargetableInScope.length,
      burpConfigStored: !!scope.burpProjectConfig,
      autoActivated: false,
    };
  }

  /**
   * Preview mode: parse files without creating anything.
   */
  preview(files: { csv?: string; burpJson?: string }): ParsedBountyScope {
    if (!files.csv && !files.burpJson) {
      throw new Error('At least one file (CSV or Burp JSON) is required.');
    }
    return this.parseFiles(files);
  }

  // ==========================================================================
  // File Parsing
  // ==========================================================================

  private parseFiles(files: { csv?: string; burpJson?: string }): ParsedBountyScope {
    let csvEntries: ParsedScopeEntry[] = [];
    let burpScope: ParsedBountyScope | null = null;

    if (files.csv) {
      csvEntries = this.parseScopeCSV(files.csv);
    }

    if (files.burpJson) {
      burpScope = this.parseBurpProjectConfig(files.burpJson);
    }

    // CSV is primary; Burp is secondary for scope but stores config
    if (csvEntries.length > 0) {
      // Split CSV entries into in-scope and out-of-scope
      const inScope = csvEntries.filter(e => e.eligibleForSubmission);
      const outOfScope = csvEntries.filter(e => !e.eligibleForSubmission);

      return {
        programName: burpScope?.programName || 'Bug Bounty Program',
        platform: 'hackerone',
        inScope,
        outOfScope,
        burpProjectConfig: burpScope?.burpProjectConfig,
      };
    }

    // Burp-only import
    if (burpScope) {
      return burpScope;
    }

    throw new Error('No valid scope data found in provided files.');
  }

  /**
   * Parse HackerOne CSV export into scope entries.
   * Format is comma-delimited with header row.
   */
  private parseScopeCSV(csvContent: string): ParsedScopeEntry[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows.');
    }

    // Parse header to find column indices
    const header = this.parseCSVLine(lines[0]);
    const colIndex: Record<string, number> = {};
    header.forEach((col, i) => {
      colIndex[col.trim().toLowerCase()] = i;
    });

    // Validate required columns
    if (!('identifier' in colIndex) || !('asset_type' in colIndex)) {
      throw new Error('CSV missing required columns: identifier, asset_type');
    }

    const entries: ParsedScopeEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = this.parseCSVLine(line);
      const get = (name: string) => cols[colIndex[name]] || '';

      const identifier = get('identifier').trim();
      const assetType = get('asset_type').trim().toUpperCase();
      if (!identifier) continue;

      const rtpiTargetType = this.mapAssetTypeToTargetType(assetType, identifier);

      entries.push({
        identifier,
        assetType: get('asset_type').trim(),
        rtpiTargetType,
        eligibleForBounty: get('eligible_for_bounty').toLowerCase() === 'true',
        eligibleForSubmission: get('eligible_for_submission').toLowerCase() === 'true',
        maxSeverity: get('max_severity').toLowerCase() || 'none',
        environmentalModifiers: {
          availabilityRequirement: get('availability_requirement') || 'none',
          confidentialityRequirement: get('confidentiality_requirement') || 'none',
          integrityRequirement: get('integrity_requirement') || 'none',
        },
        tags: get('system_tags') ? get('system_tags').split(',').map(t => t.trim()).filter(Boolean) : [],
        instruction: get('instruction') || undefined,
      });
    }

    return entries;
  }

  /**
   * Parse a single CSV line handling quoted fields.
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Parse Burp project config JSON, converting regex hosts to domains.
   */
  private parseBurpProjectConfig(jsonContent: string): ParsedBountyScope {
    let config: any;
    try {
      config = JSON.parse(jsonContent);
    } catch {
      throw new Error('Invalid Burp project config JSON.');
    }

    const includeEntries = config?.target?.scope?.include || [];
    const excludeEntries = config?.target?.scope?.exclude || [];

    const seenInclude = new Set<string>();
    const inScope: ParsedScopeEntry[] = [];

    for (const entry of includeEntries) {
      if (!entry.enabled || !entry.host) continue;
      const domain = this.regexHostToDomain(entry.host);
      if (!domain || seenInclude.has(domain)) continue;
      seenInclude.add(domain);

      inScope.push({
        identifier: domain,
        assetType: domain.startsWith('*.') ? 'WILDCARD' : 'Domain',
        rtpiTargetType: 'domain',
        eligibleForBounty: true,
        eligibleForSubmission: true,
        maxSeverity: 'critical',
        environmentalModifiers: {
          availabilityRequirement: 'none',
          confidentialityRequirement: 'none',
          integrityRequirement: 'none',
        },
        tags: [],
        instruction: undefined,
      });
    }

    const seenExclude = new Set<string>();
    const outOfScope: ParsedScopeEntry[] = [];

    for (const entry of excludeEntries) {
      if (!entry.host) continue;
      const domain = this.regexHostToDomain(entry.host);
      if (!domain || seenExclude.has(domain)) continue;
      seenExclude.add(domain);

      outOfScope.push({
        identifier: domain,
        assetType: domain.startsWith('*.') ? 'WILDCARD' : 'Domain',
        rtpiTargetType: null, // out-of-scope don't become targets
        eligibleForBounty: false,
        eligibleForSubmission: false,
        maxSeverity: 'none',
        environmentalModifiers: {
          availabilityRequirement: 'none',
          confidentialityRequirement: 'none',
          integrityRequirement: 'none',
        },
        tags: [],
        instruction: undefined,
      });
    }

    return {
      programName: 'Bug Bounty Program',
      platform: 'hackerone',
      inScope,
      outOfScope,
      burpProjectConfig: config,
    };
  }

  /**
   * Convert Burp regex host pattern to clean domain string.
   */
  private regexHostToDomain(regexHost: string): string | null {
    if (!regexHost) return null;

    let domain = regexHost;

    // Strip anchors
    domain = domain.replace(/^\^/, '').replace(/\$$/, '');

    // Unescape dots
    domain = domain.replace(/\\\./g, '.');

    // Convert wildcard pattern: ^.*\. prefix -> *.
    domain = domain.replace(/^\.\*\./, '*.');

    // If it still contains regex metacharacters, store as-is
    if (/[\\^$*+?{}[\]|()]/.test(domain) && !domain.startsWith('*.')) {
      return null; // too complex to convert
    }

    return domain || null;
  }

  /**
   * Map HackerOne asset_type to RTPI targetTypeEnum.
   */
  private mapAssetTypeToTargetType(
    h1AssetType: string,
    identifier: string
  ): 'ip' | 'domain' | 'url' | 'network' | 'range' | null {
    // Check the direct mapping
    const mapped = ASSET_TYPE_MAP[h1AssetType];
    if (mapped !== undefined) {
      // For URL type, check if identifier is actually a URL or bare domain
      if (mapped === 'url' && !identifier.startsWith('http://') && !identifier.startsWith('https://')) {
        return 'domain'; // bare hostname like "help.doordash.com"
      }
      return mapped;
    }

    // Fallback: try to infer from the identifier value
    if (identifier.includes('/') && !identifier.includes('://')) return 'network';
    if (/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(identifier)) return 'network';
    if (/^\d+\.\d+\.\d+\.\d+$/.test(identifier)) return 'ip';
    if (identifier.startsWith('http://') || identifier.startsWith('https://')) return 'url';
    if (identifier.startsWith('*.')) return 'domain';

    return null;
  }

  // ==========================================================================
  // Value Normalization
  // ==========================================================================

  private normalizeIdentifierForTarget(identifier: string, targetType: string): string {
    let value = identifier.trim();

    if (targetType === 'domain') {
      // Strip wildcard prefix: *.example.com → example.com
      value = value.replace(/^\*\./, '');
      // Strip protocol if present
      value = value.replace(/^https?:\/\//, '');
      // Strip path and everything after
      value = value.split('/')[0];
      // Strip port
      value = value.replace(/:\d+$/, '');
    }

    return value;
  }

  // ==========================================================================
  // Operation & Target Creation
  // ==========================================================================

  private async createOperationAndTargets(
    scope: ParsedBountyScope,
    userId: string,
    options?: ImportOptions
  ): Promise<BugBountyImportResult> {
    const operationName = scope.programName;

    // Build scope text from in-scope identifiers (for existing extractScopeTargets compatibility)
    const targetableInScope = scope.inScope.filter(e => e.rtpiTargetType !== null);
    const nonTargetableInScope = scope.inScope.filter(e => e.rtpiTargetType === null);

    const scopeDomains = targetableInScope
      .filter(e => e.rtpiTargetType === 'domain')
      .map(e => this.normalizeIdentifierForTarget(e.identifier, 'domain'));
    const scopeUrls = targetableInScope
      .filter(e => e.rtpiTargetType === 'url')
      .map(e => e.identifier);
    const scopeNetworks = targetableInScope
      .filter(e => e.rtpiTargetType === 'network')
      .map(e => e.identifier);
    const allScopeValues = targetableInScope.map(e =>
      this.normalizeIdentifierForTarget(e.identifier, e.rtpiTargetType!)
    );

    // Build operation metadata
    const metadata: Record<string, any> = {
      bugBounty: {
        platform: scope.platform,
        programSlug: operationName.replace(/^Bug Bounty:\s*/, ''),
        programUrl: `https://hackerone.com/${operationName.replace(/^Bug Bounty:\s*/, '')}`,
        importedAt: new Date().toISOString(),
        inScope: scope.inScope.map(e => ({
          identifier: e.identifier,
          assetType: e.assetType,
          eligibleForBounty: e.eligibleForBounty,
          eligibleForSubmission: e.eligibleForSubmission,
          maxSeverity: e.maxSeverity,
          instruction: e.instruction,
          systemTags: e.tags,
        })),
        outOfScope: scope.outOfScope.map(e => ({
          identifier: e.identifier,
          assetType: e.assetType,
          instruction: e.instruction,
        })),
        nonTargetableAssets: nonTargetableInScope.map(e => ({
          identifier: e.identifier,
          assetType: e.assetType,
          eligibleForBounty: e.eligibleForBounty,
          maxSeverity: e.maxSeverity,
        })),
      },
      // Populate fields that operation-lifecycle-automation.ts reads
      applicationOverview: {
        inScopeDomains: [...scopeDomains, ...scopeNetworks].join('\n'),
      },
      scopeData: {
        assetUrlInScope: scopeUrls.join('\n'),
        assetUrlOutScope: scope.outOfScope.map(e => e.identifier).join('\n'),
      },
    };

    // Store Burp project config if available
    if (scope.burpProjectConfig) {
      metadata.burpProjectConfig = scope.burpProjectConfig;
    }

    // Create operation
    const status = options?.autoActivate ? 'active' : 'planning';
    const [operation] = await db
      .insert(operations)
      .values({
        name: operationName,
        description: `Imported from ${scope.platform} bug bounty program`,
        status,
        scope: allScopeValues.join('\n'),
        objectives: `Bug bounty program assessment: ${targetableInScope.length} targetable assets in scope`,
        ownerId: userId,
        metadata: metadata as any,
        automationEnabled: true,
        startDate: new Date(),
      })
      .returning();

    const operationId = operation.id;

    // Create targets for targetable in-scope assets
    let targetsCreated = 0;
    const existingValues = new Set<string>();
    const opTag = buildOperationTag(operationName);

    for (const entry of targetableInScope) {
      const value = this.normalizeIdentifierForTarget(entry.identifier, entry.rtpiTargetType!);
      if (!value || existingValues.has(value)) continue;
      existingValues.add(value);

      try {
        const priority = SEVERITY_PRIORITY[entry.maxSeverity] || 3;

        await db.insert(targets).values({
          name: value,
          type: entry.rtpiTargetType!,
          value,
          description: entry.instruction || `Imported from ${scope.platform} bug bounty program`,
          priority,
          tags: ['auto-created', 'bug-bounty', scope.platform, opTag],
          operationId,
          autoCreated: true,
          metadata: {
            source: 'bug-bounty-import',
            platform: scope.platform,
            bounty: {
              originalIdentifier: entry.identifier,
              eligibleForBounty: entry.eligibleForBounty,
              eligibleForSubmission: entry.eligibleForSubmission,
              maxSeverity: entry.maxSeverity,
              environmentalModifiers: entry.environmentalModifiers,
              instruction: entry.instruction,
            },
            originalAssetType: entry.assetType,
            autoCreatedAt: new Date().toISOString(),
          },
        });
        targetsCreated++;
      } catch (err) {
        console.warn(`[BugBountyImport] Failed to create target for ${value}:`, err);
      }
    }

    // If auto-activate, trigger the pipeline
    let autoActivated = false;
    if (options?.autoActivate) {
      try {
        const { operationLifecycleAutomation } = await import('./operation-lifecycle-automation');
        await operationLifecycleAutomation.handleOperationActivated(operationId, userId);
        autoActivated = true;
      } catch (err) {
        console.error('[BugBountyImport] Auto-activation failed:', err);
      }
    }

    return {
      success: true,
      operationId,
      operationName,
      targetsCreated,
      scopeEntriesTotal: scope.inScope.length + scope.outOfScope.length,
      scopeEntriesSkipped: nonTargetableInScope.length,
      burpConfigStored: !!scope.burpProjectConfig,
      autoActivated,
    };
  }
}

export const bugBountyImportService = new BugBountyImportService();
