import { createLogger } from '../../lib/logger';

const log = createLogger('deterministic-probe');

export interface ProbeResult {
  httpStatus: number | null;
  headers: Record<string, string>;
  securityHeaders: {
    csp: boolean;
    hsts: boolean;
    xfo: boolean;
    xcto: boolean;
    xss: boolean;
    referrerPolicy: boolean;
  };
  cors: { origin: string | null; credentials: boolean } | null;
  techFingerprint: string[];
  jsEndpoints: string[];
  notFoundBaseline: { status: number; bodyLength: number } | null;
  probeTimestamp: string;
  probeDurationMs: number;
}

export interface ProbeOptions {
  timeoutMs?: number;
  maxBodyBytes?: number;
}

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

function extractSecurityHeaders(headers: Headers) {
  return {
    csp: headers.has('content-security-policy'),
    hsts: headers.has('strict-transport-security'),
    xfo: headers.has('x-frame-options'),
    xcto: headers.has('x-content-type-options'),
    xss: headers.has('x-xss-protection'),
    referrerPolicy: headers.has('referrer-policy'),
  };
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function extractTechFingerprint(headers: Headers, body: string): string[] {
  const techs: string[] = [];

  const server = headers.get('server');
  if (server) techs.push(`Server: ${server}`);

  const powered = headers.get('x-powered-by');
  if (powered) techs.push(`X-Powered-By: ${powered}`);

  const generator = headers.get('x-generator');
  if (generator) techs.push(`X-Generator: ${generator}`);

  const patterns: [RegExp, string][] = [
    [/wp-content/i, 'WordPress'],
    [/__next/i, 'Next.js'],
    [/_next\/static/i, 'Next.js'],
    [/react-root/i, 'React'],
    [/data-reactroot/i, 'React'],
    [/ng-version/i, 'Angular'],
  ];

  const seen = new Set<string>();
  for (const [re, label] of patterns) {
    if (re.test(body) && !seen.has(label)) {
      seen.add(label);
      techs.push(label);
    }
  }

  return techs;
}

function extractJsEndpoints(body: string): string[] {
  const endpoints = new Set<string>();

  const apiPathRe = /["'`](\/api\/[^"'`\s]{1,200})["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = apiPathRe.exec(body)) !== null) {
    endpoints.add(m[1]);
    if (endpoints.size >= 20) return Array.from(endpoints);
  }

  const fetchRe = /fetch\s*\(\s*["'`]([^"'`\s]{1,200})["'`]/g;
  while ((m = fetchRe.exec(body)) !== null) {
    endpoints.add(m[1]);
    if (endpoints.size >= 20) return Array.from(endpoints);
  }

  const xhrRe = /\.open\s*\(\s*["'`][A-Z]+["'`]\s*,\s*["'`]([^"'`\s]{1,200})["'`]/g;
  while ((m = xhrRe.exec(body)) !== null) {
    endpoints.add(m[1]);
    if (endpoints.size >= 20) return Array.from(endpoints);
  }

  return Array.from(endpoints);
}

async function readBody(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (totalBytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const merged = new Uint8Array(Math.min(totalBytes, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = merged.byteLength - offset;
    const slice = chunk.byteLength <= remaining ? chunk : chunk.slice(0, remaining);
    merged.set(slice, offset);
    offset += slice.byteLength;
    if (offset >= merged.byteLength) break;
  }

  return decoder.decode(merged);
}

export async function runDeterministicProbe(
  targetUrl: string,
  options?: ProbeOptions,
): Promise<ProbeResult> {
  const url = normalizeUrl(targetUrl);
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const maxBodyBytes = options?.maxBodyBytes ?? 512 * 1024;
  const start = Date.now();

  const result: ProbeResult = {
    httpStatus: null,
    headers: {},
    securityHeaders: { csp: false, hsts: false, xfo: false, xcto: false, xss: false, referrerPolicy: false },
    cors: null,
    techFingerprint: [],
    jsEndpoints: [],
    notFoundBaseline: null,
    probeTimestamp: new Date().toISOString(),
    probeDurationMs: 0,
  };

  const probeGet = async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);

      result.httpStatus = res.status;
      result.headers = headersToRecord(res.headers);
      result.securityHeaders = extractSecurityHeaders(res.headers);

      const body = await readBody(res, maxBodyBytes);
      result.techFingerprint = extractTechFingerprint(res.headers, body);
      result.jsEndpoints = extractJsEndpoints(body);
    } catch (err) {
      log.warn({ err, url }, 'GET probe failed');
    }
  };

  const probe404 = async () => {
    try {
      const notFoundUrl = new URL('/nonexistent-path-abc123', url).toString();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(notFoundUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);

      const body = await readBody(res, maxBodyBytes);
      result.notFoundBaseline = { status: res.status, bodyLength: body.length };
    } catch (err) {
      log.warn({ err, url }, '404 baseline probe failed');
    }
  };

  const probeCors = async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method: 'OPTIONS',
        signal: controller.signal,
        headers: { Origin: 'https://probe.example.com' },
        redirect: 'follow',
      });
      clearTimeout(timer);

      const origin = res.headers.get('access-control-allow-origin');
      const credentials = res.headers.get('access-control-allow-credentials');
      if (origin || credentials) {
        result.cors = {
          origin: origin,
          credentials: credentials?.toLowerCase() === 'true',
        };
      }
    } catch (err) {
      log.warn({ err, url }, 'OPTIONS/CORS probe failed');
    }
  };

  await Promise.allSettled([probeGet(), probe404(), probeCors()]);

  result.probeDurationMs = Date.now() - start;
  return result;
}

export function formatProbeForPrompt(result: ProbeResult): string {
  const lines: string[] = [];

  lines.push('## Ground Truth (Deterministic Probe)');
  lines.push('');
  lines.push(
    `**Target:** probed | **Status:** ${result.httpStatus ?? 'N/A'} | **Probed:** ${result.probeTimestamp}`,
  );

  const sh = result.securityHeaders;
  const anyHeader = sh.csp || sh.hsts || sh.xfo || sh.xcto || sh.xss || sh.referrerPolicy;
  if (anyHeader || result.httpStatus !== null) {
    const check = (v: boolean) => (v ? '✓' : '✗');
    lines.push('');
    lines.push('### Security Headers');
    lines.push('| Header | Present |');
    lines.push('|--------|---------|');
    lines.push(`| CSP | ${check(sh.csp)} |`);
    lines.push(`| HSTS | ${check(sh.hsts)} |`);
    lines.push(`| X-Frame-Options | ${check(sh.xfo)} |`);
    lines.push(`| X-Content-Type-Options | ${check(sh.xcto)} |`);
    lines.push(`| X-XSS-Protection | ${check(sh.xss)} |`);
    lines.push(`| Referrer-Policy | ${check(sh.referrerPolicy)} |`);
  }

  if (result.techFingerprint.length > 0) {
    lines.push('');
    lines.push('### Technology Fingerprint');
    for (const tech of result.techFingerprint) {
      lines.push(`- ${tech}`);
    }
  }

  if (result.cors) {
    lines.push('');
    lines.push('### CORS');
    lines.push(
      `Origin: ${result.cors.origin ?? 'N/A'}, Credentials: ${result.cors.credentials ? 'yes' : 'no'}`,
    );
  }

  if (result.notFoundBaseline) {
    lines.push('');
    lines.push('### 404 Baseline');
    lines.push(
      `Status: ${result.notFoundBaseline.status}, Body Length: ${result.notFoundBaseline.bodyLength} bytes`,
    );
  }

  if (result.jsEndpoints.length > 0) {
    lines.push('');
    lines.push('### Discovered Endpoints');
    for (const ep of result.jsEndpoints) {
      lines.push(`- ${ep}`);
    }
  }

  return lines.join('\n');
}
