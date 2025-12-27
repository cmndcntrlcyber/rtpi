import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { empireListeners, kasmWorkspaces } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const execAsync = promisify(exec);

/**
 * Kasm Nginx Configuration Manager
 *
 * Manages dynamic nginx proxy routes for:
 * 1. Empire C2 listeners - External implant connections
 * 2. Kasm Workspaces - User workspace access
 *
 * Architecture:
 * - Empire: External Implant → Cloudflare (optional) → Kasm Nginx Proxy → Empire Listener
 * - Workspace: User Browser → Kasm Nginx Proxy → Workspace Container
 *
 * Example Routes:
 * - listener-abc123.kasm.attck.nexus:8443 → http://empire:8080
 * - workspace-def456.kasm.attck.nexus:8443 → http://kasm-guac:6901
 */

export type ProxyType = 'empire-listener' | 'kasm-workspace';

export interface ProxyRoute {
  subdomain: string;
  port: number;
  target: string;
  ssl?: boolean;
  type: ProxyType;
  listenerId?: string;
  workspaceId?: string;
}

export interface ProxyAccessLog {
  timestamp: Date;
  subdomain: string;
  clientIp: string;
  method: string;
  path: string;
  statusCode: number;
  userAgent?: string;
}

export interface ProxyStats {
  routeCount: number;
  empireListenerRoutes: number;
  workspaceRoutes: number;
  totalRequests: number;
  avgResponseTime: number;
}

export interface ProxyConfig {
  subdomain: string;
  targetHost: string;
  targetPort: number;
  ssl: boolean;
  certPath?: string;
  keyPath?: string;
}

export class KasmNginxManager {
  private configPath: string;
  private nginxContainer: string;
  private kasmDomain: string;
  private enabled: boolean;
  private accessLogPath: string;
  private callbackUrls: Map<string, string>; // Maps route IDs to callback URLs

  constructor(options?: {
    configPath?: string;
    nginxContainer?: string;
    kasmDomain?: string;
    enabled?: boolean;
    accessLogPath?: string;
  }) {
    this.configPath = options?.configPath || '/etc/nginx/conf.d';
    this.nginxContainer = options?.nginxContainer || 'rtpi-kasm-proxy';
    this.kasmDomain = options?.kasmDomain || 'kasm.attck.nexus';
    this.enabled = options?.enabled ?? (process.env.KASM_PROXY_ENABLED === 'true');
    this.accessLogPath = options?.accessLogPath || '/var/log/nginx/kasm-proxy-access.log';
    this.callbackUrls = new Map();
  }

  /**
   * Register a dynamic proxy route for an Empire listener
   */
  async registerListenerProxy(listenerId: string, listenerPort: number, _listenerName: string): Promise<ProxyRoute | null> {
    if (!this.enabled) {
      console.log('[KasmNginxManager] Kasm proxy disabled, skipping route registration');
      return null;
    }

    try {
      // Generate unique subdomain based on listener ID
      const subdomain = `listener-${listenerId.slice(0, 8)}.${this.kasmDomain}`;
      const targetHost = process.env.EMPIRE_HOST || 'empire';
      const proxyPort = 8443;

      const route: ProxyRoute = {
        subdomain,
        port: proxyPort,
        target: `http://${targetHost}:${listenerPort}`,
        ssl: true,
        type: 'empire-listener',
        listenerId,
      };

      // Generate nginx configuration
      const nginxConfig = this.generateNginxConfig({
        subdomain,
        targetHost,
        targetPort: listenerPort,
        ssl: true,
      });

      // Write configuration file
      const configFileName = `empire-listener-${listenerId}.conf`;
      await this.writeNginxConfig(configFileName, nginxConfig);

      // Reload nginx to apply changes
      await this.reloadNginx();

      console.log(`[KasmNginxManager] Registered proxy route: ${subdomain}:${proxyPort} → ${route.target}`);

      // Update listener record with proxy information
      await db
        .update(empireListeners)
        .set({
          config: {
            proxyRoute: route,
            proxySubdomain: subdomain,
            proxyPort,
          },
        })
        .where(eq(empireListeners.id, listenerId));

      return route;
    } catch (error) {
      console.error('[KasmNginxManager] Failed to register proxy route:', error);
      throw error;
    }
  }

  /**
   * Unregister a proxy route for an Empire listener
   */
  async unregisterListenerProxy(listenerId: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const configFileName = `empire-listener-${listenerId}.conf`;
      await this.removeNginxConfig(configFileName);
      await this.reloadNginx();

      console.log(`[KasmNginxManager] Unregistered proxy route for listener ${listenerId}`);
    } catch (error) {
      console.error('[KasmNginxManager] Failed to unregister proxy route:', error);
      throw error;
    }
  }

  /**
   * Register a dynamic proxy route for a Kasm Workspace (#KW-31)
   */
  async registerWorkspaceProxy(workspaceId: string, workspacePort: number): Promise<ProxyRoute | null> {
    if (!this.enabled) {
      console.log('[KasmNginxManager] Kasm proxy disabled, skipping workspace route registration');
      return null;
    }

    try {
      // Generate unique subdomain based on workspace ID
      const subdomain = `workspace-${workspaceId.slice(0, 8)}.${this.kasmDomain}`;
      const targetHost = process.env.KASM_GUAC_HOST || 'kasm-guac';
      const proxyPort = 8443;

      const route: ProxyRoute = {
        subdomain,
        port: proxyPort,
        target: `http://${targetHost}:${workspacePort}`,
        ssl: true,
        type: 'kasm-workspace',
        workspaceId,
      };

      // Generate nginx configuration for workspace
      const nginxConfig = this.generateWorkspaceNginxConfig({
        subdomain,
        targetHost,
        targetPort: workspacePort,
        ssl: true,
      });

      // Write configuration file
      const configFileName = `kasm-workspace-${workspaceId}.conf`;
      await this.writeNginxConfig(configFileName, nginxConfig);

      // Reload nginx to apply changes
      await this.reloadNginx();

      console.log(`[KasmNginxManager] Registered workspace proxy route: ${subdomain}:${proxyPort} → ${route.target}`);

      // Update workspace record with proxy information
      await db
        .update(kasmWorkspaces)
        .set({
          metadata: {
            proxyRoute: route,
            proxySubdomain: subdomain,
            proxyPort,
          },
        })
        .where(eq(kasmWorkspaces.id, workspaceId));

      // Store callback URL (#KW-33)
      this.registerCallbackUrl(workspaceId, `https://${subdomain}:${proxyPort}`);

      return route;
    } catch (error) {
      console.error('[KasmNginxManager] Failed to register workspace proxy route:', error);
      throw error;
    }
  }

  /**
   * Unregister a proxy route for a Kasm Workspace
   */
  async unregisterWorkspaceProxy(workspaceId: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const configFileName = `kasm-workspace-${workspaceId}.conf`;
      await this.removeNginxConfig(configFileName);
      await this.reloadNginx();

      // Remove callback URL
      this.unregisterCallbackUrl(workspaceId);

      console.log(`[KasmNginxManager] Unregistered workspace proxy route for ${workspaceId}`);
    } catch (error) {
      console.error('[KasmNginxManager] Failed to unregister workspace proxy route:', error);
      throw error;
    }
  }

  // ============================================================================
  // Callback URL Management (#KW-33)
  // ============================================================================

  /**
   * Register a callback URL for a proxy route
   */
  registerCallbackUrl(routeId: string, callbackUrl: string): void {
    this.callbackUrls.set(routeId, callbackUrl);
    console.log(`[KasmNginxManager] Registered callback URL for ${routeId}: ${callbackUrl}`);
  }

  /**
   * Unregister a callback URL
   */
  unregisterCallbackUrl(routeId: string): void {
    this.callbackUrls.delete(routeId);
    console.log(`[KasmNginxManager] Unregistered callback URL for ${routeId}`);
  }

  /**
   * Get callback URL for a route
   */
  getCallbackUrl(routeId: string): string | undefined {
    return this.callbackUrls.get(routeId);
  }

  /**
   * List all callback URLs
   */
  getAllCallbackUrls(): Map<string, string> {
    return new Map(this.callbackUrls);
  }

  /**
   * Update callback URL for a route
   */
  updateCallbackUrl(routeId: string, newCallbackUrl: string): void {
    if (this.callbackUrls.has(routeId)) {
      this.callbackUrls.set(routeId, newCallbackUrl);
      console.log(`[KasmNginxManager] Updated callback URL for ${routeId}: ${newCallbackUrl}`);
    } else {
      console.warn(`[KasmNginxManager] No existing callback URL found for ${routeId}`);
    }
  }

  // ============================================================================
  // Nginx Configuration Generation
  // ============================================================================

  /**
   * Generate nginx configuration for an Empire C2 listener proxy route
   */
  private generateNginxConfig(config: ProxyConfig): string {
    const { subdomain, targetHost, targetPort, ssl, certPath, keyPath } = config;

    const sslConfig = ssl
      ? `
    ssl_certificate ${certPath || '/etc/nginx/ssl/kasm.crt'};
    ssl_certificate_key ${keyPath || '/etc/nginx/ssl/kasm.key'};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
`
      : '';

    const listenPort = ssl ? '8443 ssl' : '80';

    return `# Dynamic proxy route for Empire C2 listener
# Generated by RTPI Kasm Nginx Manager
# Subdomain: ${subdomain}
# Target: ${targetHost}:${targetPort}

server {
    listen ${listenPort};
    server_name ${subdomain};
${sslConfig}
    # Proxy settings
    location / {
        proxy_pass http://${targetHost}:${targetPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (for Empire C2 traffic)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts for long-polling C2 traffic
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}
`;
  }

  /**
   * Generate nginx configuration for a Kasm Workspace proxy route
   */
  private generateWorkspaceNginxConfig(config: ProxyConfig): string {
    const { subdomain, targetHost, targetPort, ssl, certPath, keyPath } = config;

    const sslConfig = ssl
      ? `
    ssl_certificate ${certPath || '/etc/nginx/ssl/kasm.crt'};
    ssl_certificate_key ${keyPath || '/etc/nginx/ssl/kasm.key'};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
`
      : '';

    const listenPort = ssl ? '8443 ssl' : '80';

    // Access logging configuration (#KW-35)
    const accessLogConfig = `
    access_log ${this.accessLogPath} combined;
    error_log /var/log/nginx/kasm-proxy-error.log warn;
`;

    return `# Dynamic proxy route for Kasm Workspace
# Generated by RTPI Kasm Nginx Manager
# Subdomain: ${subdomain}
# Target: ${targetHost}:${targetPort}

server {
    listen ${listenPort};
    server_name ${subdomain};
${sslConfig}${accessLogConfig}
    # Proxy settings for Kasm Workspace (Guacamole)
    location / {
        proxy_pass http://${targetHost}:${targetPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support for Guacamole
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Increase timeouts for remote desktop sessions
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # Buffer settings for streaming
        proxy_buffering off;
        proxy_request_buffering off;

        # Add custom headers for workspace tracking
        add_header X-Kasm-Workspace-Proxy "true";
        add_header X-Kasm-Subdomain "${subdomain}";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }

    # Workspace status endpoint
    location /status {
        access_log off;
        return 200 "workspace-active\\n";
        add_header Content-Type text/plain;
        add_header X-Workspace-Status "active";
    }
}
`;
  }

  // ============================================================================
  // Access Logging (#KW-35)
  // ============================================================================

  /**
   * Parse nginx access log and extract proxy access logs
   */
  async getAccessLogs(limit: number = 100): Promise<ProxyAccessLog[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const logs: ProxyAccessLog[] = [];
      let logContent: string;

      // Read access log file
      if (await this.isNginxContainerized()) {
        const { stdout } = await execAsync(
          `docker exec ${this.nginxContainer} tail -n ${limit} ${this.accessLogPath}`
        );
        logContent = stdout;
      } else {
        logContent = await fs.readFile(this.accessLogPath, 'utf8');
      }

      // Parse nginx combined log format
      const lines = logContent.split('\n').filter(line => line.trim());

      for (const line of lines.slice(-limit)) {
        const parsed = this.parseAccessLogLine(line);
        if (parsed) {
          logs.push(parsed);
        }
      }

      return logs;
    } catch (error) {
      console.error('[KasmNginxManager] Failed to get access logs:', error);
      return [];
    }
  }

  /**
   * Parse a single nginx access log line
   */
  private parseAccessLogLine(line: string): ProxyAccessLog | null {
    try {
      // Nginx combined log format:
      // $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
      const regex = /^(\S+) - \S+ \[(.*?)\] "(\S+) (\S+) \S+" (\d+) \d+ ".*?" "(.*?)"$/;
      const match = line.match(regex);

      if (!match) {
        return null;
      }

      const [, clientIp, timestamp, method, path, statusCode, userAgent] = match;

      // Extract subdomain from the request
      const subdomainMatch = path.match(/^https?:\/\/([^:\/]+)/);
      const subdomain = subdomainMatch ? subdomainMatch[1] : '';

      return {
        timestamp: new Date(timestamp),
        subdomain,
        clientIp,
        method,
        path,
        statusCode: parseInt(statusCode, 10),
        userAgent,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get access logs for a specific subdomain
   */
  async getAccessLogsBySubdomain(subdomain: string, limit: number = 50): Promise<ProxyAccessLog[]> {
    const allLogs = await this.getAccessLogs(500);
    return allLogs
      .filter(log => log.subdomain === subdomain)
      .slice(0, limit);
  }

  /**
   * Get proxy statistics
   */
  async getProxyStats(): Promise<ProxyStats> {
    try {
      const empireRoutes = await this.listProxyRoutes();
      const workspaceRoutes = await this.listWorkspaceProxyRoutes();
      const accessLogs = await this.getAccessLogs(1000);

      // Calculate average response time (if available in logs)
      const avgResponseTime = 0; // Would need response time logging enabled

      return {
        routeCount: empireRoutes.length + workspaceRoutes.length,
        empireListenerRoutes: empireRoutes.length,
        workspaceRoutes: workspaceRoutes.length,
        totalRequests: accessLogs.length,
        avgResponseTime,
      };
    } catch (error) {
      console.error('[KasmNginxManager] Failed to get proxy stats:', error);
      return {
        routeCount: 0,
        empireListenerRoutes: 0,
        workspaceRoutes: 0,
        totalRequests: 0,
        avgResponseTime: 0,
      };
    }
  }

  /**
   * Clear old access logs (keeps last N days)
   */
  async rotateAccessLogs(daysToKeep: number = 7): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Rotate logs using logrotate or manual rotation
      if (await this.isNginxContainerized()) {
        await execAsync(
          `docker exec ${this.nginxContainer} find /var/log/nginx -name "*.log" -mtime +${daysToKeep} -delete`
        );
      } else {
        await execAsync(
          `find /var/log/nginx -name "*.log" -mtime +${daysToKeep} -delete`
        );
      }

      console.log(`[KasmNginxManager] Rotated access logs, kept last ${daysToKeep} days`);
    } catch (error) {
      console.error('[KasmNginxManager] Failed to rotate access logs:', error);
    }
  }

  /**
   * Write nginx configuration file
   */
  private async writeNginxConfig(filename: string, content: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const configFilePath = path.join(this.configPath, filename);

      // Check if running in Docker container
      if (await this.isNginxContainerized()) {
        // Write to container using docker exec
        const escapedContent = content.replace(/"/g, '\\"');
        await execAsync(`docker exec ${this.nginxContainer} sh -c "echo \\"${escapedContent}\\" > ${configFilePath}"`);
      } else {
        // Write directly to filesystem (development mode)
        await fs.writeFile(configFilePath, content, 'utf8');
      }

      console.log(`[KasmNginxManager] Wrote nginx config: ${filename}`);
    } catch (error) {
      console.error('[KasmNginxManager] Failed to write nginx config:', error);
      throw error;
    }
  }

  /**
   * Remove nginx configuration file
   */
  private async removeNginxConfig(filename: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const configFilePath = path.join(this.configPath, filename);

      if (await this.isNginxContainerized()) {
        await execAsync(`docker exec ${this.nginxContainer} rm -f ${configFilePath}`);
      } else {
        await fs.unlink(configFilePath);
      }

      console.log(`[KasmNginxManager] Removed nginx config: ${filename}`);
    } catch (error) {
      console.error('[KasmNginxManager] Failed to remove nginx config:', error);
      throw error;
    }
  }

  /**
   * Reload nginx to apply configuration changes
   */
  private async reloadNginx(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      if (await this.isNginxContainerized()) {
        await execAsync(`docker exec ${this.nginxContainer} nginx -s reload`);
      } else {
        await execAsync('nginx -s reload');
      }

      console.log('[KasmNginxManager] Reloaded nginx configuration');
    } catch (error) {
      console.error('[KasmNginxManager] Failed to reload nginx:', error);
      throw error;
    }
  }

  /**
   * Check if nginx is running in a Docker container
   */
  private async isNginxContainerized(): Promise<boolean> {
    try {
      await execAsync(`docker ps -q -f name=${this.nginxContainer}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify nginx configuration is valid
   */
  async testConfiguration(): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    try {
      if (await this.isNginxContainerized()) {
        await execAsync(`docker exec ${this.nginxContainer} nginx -t`);
      } else {
        await execAsync('nginx -t');
      }
      return true;
    } catch (error) {
      console.error('[KasmNginxManager] Nginx configuration test failed:', error);
      return false;
    }
  }

  /**
   * List all active Empire listener proxy routes
   */
  async listProxyRoutes(): Promise<ProxyRoute[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const listeners = await db.query.empireListeners.findMany();
      const routes: ProxyRoute[] = [];

      for (const listener of listeners) {
        if (listener.config && (listener.config as any).proxyRoute) {
          routes.push((listener.config as any).proxyRoute);
        }
      }

      return routes;
    } catch (error) {
      console.error('[KasmNginxManager] Failed to list proxy routes:', error);
      return [];
    }
  }

  /**
   * List all active workspace proxy routes
   */
  async listWorkspaceProxyRoutes(): Promise<ProxyRoute[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const workspaces = await db
        .select()
        .from(kasmWorkspaces)
        .orderBy(desc(kasmWorkspaces.createdAt));

      const routes: ProxyRoute[] = [];

      for (const workspace of workspaces) {
        if (workspace.metadata && (workspace.metadata as any).proxyRoute) {
          routes.push((workspace.metadata as any).proxyRoute);
        }
      }

      return routes;
    } catch (error) {
      console.error('[KasmNginxManager] Failed to list workspace proxy routes:', error);
      return [];
    }
  }

  /**
   * List all proxy routes (Empire + Workspace)
   */
  async listAllProxyRoutes(): Promise<ProxyRoute[]> {
    const empireRoutes = await this.listProxyRoutes();
    const workspaceRoutes = await this.listWorkspaceProxyRoutes();
    return [...empireRoutes, ...workspaceRoutes];
  }

  /**
   * Get proxy route by ID (listenerId or workspaceId)
   */
  async getProxyRouteById(routeId: string, type: ProxyType): Promise<ProxyRoute | null> {
    try {
      if (type === 'empire-listener') {
        const listener = await db.query.empireListeners.findFirst({
          where: eq(empireListeners.id, routeId),
        });
        return listener?.config && (listener.config as any).proxyRoute
          ? (listener.config as any).proxyRoute
          : null;
      } else {
        const workspace = await db.query.kasmWorkspaces.findFirst({
          where: eq(kasmWorkspaces.id, routeId),
        });
        return workspace?.metadata && (workspace.metadata as any).proxyRoute
          ? (workspace.metadata as any).proxyRoute
          : null;
      }
    } catch (error) {
      console.error('[KasmNginxManager] Failed to get proxy route:', error);
      return null;
    }
  }
}

// Export singleton instance
export const kasmNginxManager = new KasmNginxManager({
  enabled: process.env.KASM_PROXY_ENABLED === 'true',
  nginxContainer: process.env.KASM_NGINX_CONTAINER || 'kasm-proxy',
  kasmDomain: process.env.KASM_DOMAIN || 'kasm.attck.nexus',
});
