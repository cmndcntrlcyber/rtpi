/**
 * Target Sanitization Utility
 * 
 * FIX BUG #3: Sanitizes target values based on type for nmap compatibility
 * 
 * Nmap requires hostnames or IP addresses, not full URLs with protocols.
 * This utility extracts the appropriate value for each target type.
 */

export type TargetType = 'ip' | 'domain' | 'url' | 'network' | 'range';

export interface SanitizationResult {
  nmapTarget: string;
  originalValue: string;
  sanitized: string;
  isValid: boolean;
  errorMessage?: string;
  warnings?: string[];
}

export class TargetSanitizer {
  /**
   * Main sanitization function - routes to specific handler based on type
   */
  static sanitizeForNmap(targetType: TargetType, value: string): SanitizationResult {
    const trimmed = value.trim();
    
    if (!trimmed) {
      return {
        nmapTarget: '',
        originalValue: value,
        sanitized: '',
        isValid: false,
        errorMessage: 'Target value cannot be empty'
      };
    }
    
    switch (targetType) {
      case 'ip':
        return this.sanitizeIP(trimmed);
      case 'domain':
        return this.sanitizeDomain(trimmed);
      case 'url':
        return this.sanitizeURL(trimmed);
      case 'network':
        return this.sanitizeNetwork(trimmed);
      case 'range':
        return this.sanitizeRange(trimmed);
      default:
        return {
          nmapTarget: trimmed,
          originalValue: value,
          sanitized: trimmed,
          isValid: false,
          errorMessage: `Unknown target type: ${targetType}`
        };
    }
  }

  /**
   * Sanitize IP address (IPv4 or IPv6)
   */
  private static sanitizeIP(value: string): SanitizationResult {
    // IPv4 regex
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    // IPv6 regex (simplified - matches most common patterns)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    const ipv4Match = value.match(ipv4Regex);
    
    if (ipv4Match) {
      // Validate octets are in range 0-255
      const octets = ipv4Match.slice(1, 5).map(Number);
      if (octets.every(o => o >= 0 && o <= 255)) {
        return {
          nmapTarget: value,
          originalValue: value,
          sanitized: value,
          isValid: true
        };
      }
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: false,
        errorMessage: 'Invalid IPv4 address: octets must be 0-255'
      };
    }

    if (ipv6Regex.test(value)) {
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: true
      };
    }

    return {
      nmapTarget: value,
      originalValue: value,
      sanitized: value,
      isValid: false,
      errorMessage: 'Invalid IP address format (must be valid IPv4 or IPv6)'
    };
  }

  /**
   * Sanitize domain name - removes protocol and path if present
   */
  private static sanitizeDomain(value: string): SanitizationResult {
    // Remove protocol if present
    let domain = value.replace(/^https?:\/\//, '');
    
    // Remove path if present
    domain = domain.split('/')[0];
    
    // Remove port if present (but note it for user)
    const portMatch = domain.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : null;
    domain = domain.replace(/:\d+$/, '');

    // Validate domain format (basic check)
    // Allows: letters, numbers, hyphens, dots
    // Must have at least one dot (except localhost)
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    
    if (!domainRegex.test(domain) && domain !== 'localhost') {
      return {
        nmapTarget: domain,
        originalValue: value,
        sanitized: domain,
        isValid: false,
        errorMessage: 'Invalid domain format'
      };
    }

    const warnings = [];
    if (value !== domain) {
      warnings.push(`Stripped protocol and/or path from domain. Using: ${domain}`);
    }
    if (port) {
      warnings.push(`Port ${port} detected but will use nmap default port scan`);
    }

    return {
      nmapTarget: domain,
      originalValue: value,
      sanitized: domain,
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Sanitize URL - extract hostname for nmap
   */
  private static sanitizeURL(value: string): SanitizationResult {
    try {
      // Ensure URL has protocol for proper parsing
      let urlString = value;
      if (!urlString.match(/^https?:\/\//)) {
        urlString = `https://${urlString}`;
      }

      const url = new URL(urlString);
      const hostname = url.hostname;
      const port = url.port;

      // Validate extracted hostname (could be IP or domain)
      const hostnameCheck = hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
        ? this.sanitizeIP(hostname)
        : this.sanitizeDomain(hostname);

      if (!hostnameCheck.isValid) {
        return {
          nmapTarget: hostname,
          originalValue: value,
          sanitized: hostname,
          isValid: false,
          errorMessage: `Invalid hostname extracted from URL: ${hostnameCheck.errorMessage}`
        };
      }

      const warnings = [`Extracted hostname '${hostname}' from URL '${value}'`];
      if (port) {
        warnings.push(`URL specifies port ${port}, but nmap will scan default ports unless specified`);
      }
      if (url.pathname !== '/') {
        warnings.push(`URL path '${url.pathname}' ignored (nmap scans hosts, not paths)`);
      }

      return {
        nmapTarget: hostname,
        originalValue: value,
        sanitized: hostname,
        isValid: true,
        warnings
      };
    } catch (error) {
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: false,
        errorMessage: `Failed to parse URL: ${error instanceof Error ? error.message : 'Invalid URL'}`
      };
    }
  }

  /**
   * Sanitize network CIDR notation (e.g., 192.168.1.0/24)
   */
  private static sanitizeNetwork(value: string): SanitizationResult {
    const cidrRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;
    const match = value.match(cidrRegex);

    if (!match) {
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: false,
        errorMessage: 'Invalid CIDR notation (expected format: xxx.xxx.xxx.xxx/xx)'
      };
    }

    // Validate IP octets
    const octets = match.slice(1, 5).map(Number);
    if (!octets.every(o => o >= 0 && o <= 255)) {
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: false,
        errorMessage: 'Invalid CIDR: IP octets must be 0-255'
      };
    }

    // Validate subnet mask
    const mask = Number(match[5]);
    if (mask < 0 || mask > 32) {
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: false,
        errorMessage: 'Invalid CIDR: subnet mask must be 0-32'
      };
    }

    // Calculate approximate host count for warnings
    const hostCount = Math.pow(2, 32 - mask) - 2; // -2 for network and broadcast
    const warnings = [];
    
    if (mask < 16) {
      warnings.push(`WARNING: Large network /${mask} (${hostCount.toLocaleString()} hosts) - scan may take very long time`);
    } else if (mask < 24) {
      warnings.push(`Network /${mask} contains ${hostCount.toLocaleString()} hosts - scan may take several minutes`);
    }

    return {
      nmapTarget: value,
      originalValue: value,
      sanitized: value,
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Sanitize IP range (e.g., 192.168.1.1-192.168.1.254)
   */
  private static sanitizeRange(value: string): SanitizationResult {
    const rangeRegex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})-(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;
    const match = value.match(rangeRegex);

    if (!match) {
      // Also support short form: 192.168.1.1-50
      const shortRangeRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})-(\d{1,3})$/;
      const shortMatch = value.match(shortRangeRegex);
      
      if (!shortMatch) {
        return {
          nmapTarget: value,
          originalValue: value,
          sanitized: value,
          isValid: false,
          errorMessage: 'Invalid range format (expected: xxx.xxx.xxx.xxx-xxx.xxx.xxx.xxx or xxx.xxx.xxx.xxx-xxx)'
        };
      }

      // Validate octets for short form
      const octets = shortMatch.slice(1, 5).map(Number);
      const endOctet = Number(shortMatch[5]);
      
      if (!octets.every(o => o >= 0 && o <= 255) || endOctet < 0 || endOctet > 255) {
        return {
          nmapTarget: value,
          originalValue: value,
          sanitized: value,
          isValid: false,
          errorMessage: 'Invalid range: all octets must be 0-255'
        };
      }

      if (endOctet <= octets[3]) {
        return {
          nmapTarget: value,
          originalValue: value,
          sanitized: value,
          isValid: false,
          errorMessage: 'Invalid range: end value must be greater than start'
        };
      }

      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: true,
        warnings: [`Range contains ${endOctet - octets[3] + 1} hosts`]
      };
    }

    // Validate both IPs in full form
    const startIP = match[1];
    const endIP = match[2];
    
    const startCheck = this.sanitizeIP(startIP);
    const endCheck = this.sanitizeIP(endIP);

    if (!startCheck.isValid) {
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: false,
        errorMessage: `Invalid start IP: ${startCheck.errorMessage}`
      };
    }

    if (!endCheck.isValid) {
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: false,
        errorMessage: `Invalid end IP: ${endCheck.errorMessage}`
      };
    }

    return {
      nmapTarget: value,
      originalValue: value,
      sanitized: value,
      isValid: true
    };
  }
}
