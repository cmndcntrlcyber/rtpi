/**
 * Zero-dependency export serializers for CSV and TXT.
 * Used by the Surface Assessment export endpoint.
 */

type Row = Record<string, any>;

export interface CsvSection {
  title: string;
  headers: string[];
  rows: Row[];
}

export interface TxtSection {
  title: string;
  body: string | Row[];
}

function csvEscape(value: any): string {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString()
          : typeof value === 'object' ? JSON.stringify(value)
          : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsvTable(headers: string[], rows: Row[]): string {
  const lines: string[] = [headers.map(csvEscape).join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  return lines.join('\n');
}

export function toCsvMultiSection(sections: CsvSection[]): string {
  return sections
    .map((s) => `# ${s.title} (${s.rows.length} rows)\n${toCsvTable(s.headers, s.rows)}`)
    .join('\n\n') + '\n';
}

function padEnd(v: any, width: number): string {
  const s = v === null || v === undefined ? '' : String(v);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function formatTable(rows: Row[]): string {
  if (rows.length === 0) return '  (no rows)';
  const headers = Object.keys(rows[0]);
  const widths = headers.map((h) =>
    Math.max(h.length, ...rows.map((r) => String(r[h] ?? '').length))
  );
  const header = headers.map((h, i) => padEnd(h, widths[i])).join(' | ');
  const sep = widths.map((w) => '-'.repeat(w)).join('-+-');
  const body = rows
    .map((r) => headers.map((h, i) => padEnd(r[h], widths[i])).join(' | '))
    .join('\n');
  return [header, sep, body].join('\n');
}

export function toTxtReport(title: string, sections: TxtSection[]): string {
  const banner = '═'.repeat(64);
  const parts: string[] = [banner, `  ${title}`, `  Exported: ${new Date().toISOString()}`, banner, ''];
  for (const s of sections) {
    parts.push(s.title.toUpperCase());
    parts.push('-'.repeat(s.title.length));
    if (typeof s.body === 'string') {
      parts.push(s.body);
    } else {
      parts.push(formatTable(s.body));
    }
    parts.push('');
  }
  return parts.join('\n');
}
