/**
 * Scan Timeout Calculator
 * 
 * FIX BUG #4: Calculate appropriate timeout based on target type and size
 * 
 * Large CIDR networks need longer timeouts to complete scanning.
 * This utility provides intelligent timeout scaling.
 */

export type TargetType = 'ip' | 'domain' | 'url' | 'network' | 'range';

export interface TimeoutCalculation {
  timeout: number;           // Timeout in milliseconds
  estimatedDuration: number; // Estimated scan duration in milliseconds
  hostCount: number;         // Approximate number of hosts
  warning?: string;          // Warning message for large scans
}

export class ScanTimeoutCalculator {
  private static readonly MIN_TIMEOUT = 600000;      // 10 minutes minimum
  private static readonly MAX_TIMEOUT = 7200000;     // 2 hours maximum
  // FIX: Full port scans (-p1-65535) take much longer per host
  private static readonly SECONDS_PER_HOST = 20;     // 20 seconds per host for full port scan
  private static readonly BUFFER_MULTIPLIER = 2.0;   // Add 100% buffer for safety

  /**
   * Calculate appropriate timeout based on target type and value
   */
  static calculateTimeout(targetType: TargetType, targetValue: string): TimeoutCalculation {
    switch (targetType) {
      case 'network':
        return this.calculateNetworkTimeout(targetValue);
      case 'range':
        return this.calculateRangeTimeout(targetValue);
      default:
        // Single host (IP, domain, URL)
        return {
          timeout: this.MIN_TIMEOUT,
          estimatedDuration: 60000, // ~1 minute for single host
          hostCount: 1,
        };
    }
  }

  /**
   * Calculate timeout for CIDR network
   */
  private static calculateNetworkTimeout(cidrValue: string): TimeoutCalculation {
    const match = cidrValue.match(/\/(\d{1,2})$/);
    if (!match) {
      // Invalid CIDR, use default
      return {
        timeout: this.MIN_TIMEOUT,
        estimatedDuration: this.MIN_TIMEOUT,
        hostCount: 0,
        warning: "Invalid CIDR notation - using default timeout"
      };
    }

    const mask = parseInt(match[1]);
    const hostCount = Math.pow(2, 32 - mask) - 2; // -2 for network and broadcast

    // Calculate estimated duration
    const estimatedDuration = hostCount * this.SECONDS_PER_HOST * 1000;
    
    // Add buffer and constrain to min/max
    const timeout = Math.min(
      Math.max(estimatedDuration * this.BUFFER_MULTIPLIER, this.MIN_TIMEOUT),
      this.MAX_TIMEOUT
    );

    let warning: string | undefined;
    
    if (mask < 16) {
      warning = `CRITICAL: Very large network /${mask} (${hostCount.toLocaleString()} hosts). Scan may take hours and could timeout even with extended limit.`;
    } else if (mask < 20) {
      warning = `WARNING: Large network /${mask} (${hostCount.toLocaleString()} hosts). Scan will take significant time.`;
    } else if (mask < 24) {
      warning = `Network /${mask} contains ${hostCount.toLocaleString()} hosts. Scan may take several minutes.`;
    }

    return {
      timeout,
      estimatedDuration,
      hostCount,
      warning
    };
  }

  /**
   * Calculate timeout for IP range
   */
  private static calculateRangeTimeout(rangeValue: string): TimeoutCalculation {
    // Parse range to estimate host count
    // Supports: 192.168.1.1-192.168.1.254 or 192.168.1.1-50
    
    const fullRangeMatch = rangeValue.match(/^(\d+\.\d+\.\d+\.)(\d+)-(\d+\.\d+\.\d+\.)(\d+)$/);
    const shortRangeMatch = rangeValue.match(/^(\d+\.\d+\.\d+\.)(\d+)-(\d+)$/);
    
    let hostCount = 1;
    
    if (shortRangeMatch) {
      const start = parseInt(shortRangeMatch[2]);
      const end = parseInt(shortRangeMatch[3]);
      hostCount = end - start + 1;
    } else if (fullRangeMatch) {
      // Simplified: assume same /24 network
      const start = parseInt(fullRangeMatch[2]);
      const end = parseInt(fullRangeMatch[4]);
      hostCount = Math.abs(end - start) + 1;
    }

    const estimatedDuration = hostCount * this.SECONDS_PER_HOST * 1000;
    const timeout = Math.min(
      Math.max(estimatedDuration * this.BUFFER_MULTIPLIER, this.MIN_TIMEOUT),
      this.MAX_TIMEOUT
    );

    let warning: string | undefined;
    if (hostCount > 1000) {
      warning = `WARNING: Large range (${hostCount.toLocaleString()} hosts). Scan will take significant time.`;
    } else if (hostCount > 100) {
      warning = `Range contains ${hostCount.toLocaleString()} hosts. Scan may take several minutes.`;
    }

    return {
      timeout,
      estimatedDuration,
      hostCount,
      warning
    };
  }

  /**
   * Format timeout duration for display
   */
  static formatDuration(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  }
}
