/**
 * PDF Report Generator Service
 *
 * Generates professional PDF reports with:
 * - Professional templates with branding
 * - Cover page with logo and metadata
 * - Table of contents with page links
 * - Charts and graphs
 * - Page numbers and headers/footers
 * - Multiple report types (penetration test, vulnerability assessment, executive summary)
 *
 * NOTE: Requires puppeteer to be installed
 * Install with: npm install puppeteer
 */

import fs from "fs/promises";
import path from "path";
// import puppeteer, { Browser, Page } from "puppeteer"; // Requires: npm install puppeteer

const REPORTS_DIR = process.env.REPORTS_DIR || "./uploads/reports";
const LOGO_PATH = process.env.COMPANY_LOGO_PATH || "./assets/logo.png";
const COMPANY_NAME = process.env.COMPANY_NAME || "RTPI Security";

// ============================================================================
// Types
// ============================================================================

export interface ReportData {
  id: string;
  operationId: string;
  name: string;
  type: "penetration_test" | "vulnerability_assessment" | "executive_summary" | "operation_summary";
  reportDate: Date;
  testDates: {
    start: Date;
    end: Date;
  };
  client?: {
    name: string;
    contactName?: string;
    contactEmail?: string;
  };
  tester?: {
    name: string;
    email?: string;
    title?: string;
  };
  scope?: string[];
  methodology?: string[];
  findings?: Finding[];
  executiveSummary?: string;
  conclusion?: string;
  recommendations?: string[];
  metadata?: Record<string, any>;
}

export interface Finding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  cvss?: number;
  description: string;
  impact: string;
  recommendation: string;
  affectedSystems?: string[];
  evidenceImages?: string[];
  references?: string[];
}

export interface PDFOptions {
  format?: "A4" | "Letter";
  includeTableOfContents?: boolean;
  includeCoverPage?: boolean;
  includeCharts?: boolean;
  headerText?: string;
  footerText?: string;
  pageNumbers?: boolean;
  watermark?: string;
}

export interface GeneratedReport {
  filePath: string;
  fileSize: number;
  pageCount?: number;
  generatedAt: Date;
}

// ============================================================================
// PDF Report Generator
// ============================================================================

export class PDFReportGenerator {
  private browser: any | null = null; // Browser type - requires puppeteer

  /**
   * Initialize the PDF generator (launch browser)
   */
  async initialize(): Promise<void> {
    // NOTE: Uncomment when puppeteer is installed
    // this.browser = await puppeteer.launch({
    //   headless: true,
    //   args: ['--no-sandbox', '--disable-setuid-sandbox'],
    // });

    // Ensure reports directory exists
    await fs.mkdir(REPORTS_DIR, { recursive: true });
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Generate a PDF report from report data
   */
  async generatePDFReport(
    reportData: ReportData,
    options: PDFOptions = {}
  ): Promise<GeneratedReport> {
    const {
      format = "A4",
      includeTableOfContents = true,
      includeCoverPage = true,
      includeCharts = true,
      headerText,
      footerText,
      pageNumbers = true,
      watermark,
    } = options;

    // Ensure browser is initialized
    if (!this.browser) {
      await this.initialize();
    }

    // Generate filename
    const timestamp = Date.now();
    const sanitizedName = reportData.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${sanitizedName}_${timestamp}.pdf`;
    const filePath = path.join(REPORTS_DIR, filename);

    // Generate HTML content
    const html = await this.generateHTML(reportData, {
      includeTableOfContents,
      includeCoverPage,
      includeCharts,
      watermark,
    });

    // NOTE: Uncomment when puppeteer is installed
    /*
    // Create new page
    const page = await this.browser.newPage();

    // Set HTML content
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF
    await page.pdf({
      path: filePath,
      format,
      printBackground: true,
      displayHeaderFooter: pageNumbers || headerText || footerText,
      headerTemplate: this.generateHeaderTemplate(headerText),
      footerTemplate: this.generateFooterTemplate(footerText, pageNumbers),
      margin: {
        top: '80px',
        bottom: '80px',
        left: '60px',
        right: '60px',
      },
    });

    await page.close();
    */

    // Mock implementation - write HTML to file for demonstration
    const htmlPath = filePath.replace('.pdf', '.html');
    await fs.writeFile(htmlPath, html, 'utf-8');

    // Get file stats (using HTML file for now)
    const stats = await fs.stat(htmlPath);

    return {
      filePath: filename,
      fileSize: stats.size,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate complete HTML report
   */
  private async generateHTML(
    reportData: ReportData,
    options: {
      includeTableOfContents?: boolean;
      includeCoverPage?: boolean;
      includeCharts?: boolean;
      watermark?: string;
    }
  ): Promise<string> {
    const sections: string[] = [];

    // Add CSS styles
    sections.push(this.generateCSS());

    // Add cover page
    if (options.includeCoverPage) {
      sections.push(this.generateCoverPage(reportData));
    }

    // Add table of contents
    if (options.includeTableOfContents) {
      sections.push(this.generateTableOfContents(reportData));
    }

    // Add executive summary
    if (reportData.executiveSummary) {
      sections.push(this.generateExecutiveSummarySection(reportData));
    }

    // Add scope and methodology
    if (reportData.scope || reportData.methodology) {
      sections.push(this.generateScopeAndMethodology(reportData));
    }

    // Add findings section
    if (reportData.findings && reportData.findings.length > 0) {
      sections.push(this.generateFindingsSection(reportData, options.includeCharts));
    }

    // Add recommendations
    if (reportData.recommendations && reportData.recommendations.length > 0) {
      sections.push(this.generateRecommendationsSection(reportData));
    }

    // Add conclusion
    if (reportData.conclusion) {
      sections.push(this.generateConclusionSection(reportData));
    }

    // Wrap in HTML document
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportData.name}</title>
  ${options.watermark ? `<style>body::before { content: "${options.watermark}"; position: fixed; opacity: 0.1; font-size: 72px; transform: rotate(-45deg); }</style>` : ''}
</head>
<body>
  ${sections.join('\n\n')}
</body>
</html>
    `.trim();
  }

  /**
   * Generate CSS styles
   */
  private generateCSS(): string {
    return `
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    background: white;
  }

  .cover-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    page-break-after: always;
  }

  .cover-page h1 {
    font-size: 48px;
    margin-bottom: 20px;
    font-weight: 300;
  }

  .cover-page .subtitle {
    font-size: 24px;
    margin-bottom: 40px;
    opacity: 0.9;
  }

  .cover-page .metadata {
    margin-top: 60px;
    font-size: 14px;
    opacity: 0.8;
  }

  .section {
    page-break-before: always;
    padding: 40px;
  }

  .section h2 {
    font-size: 32px;
    color: #667eea;
    border-bottom: 3px solid #667eea;
    padding-bottom: 10px;
    margin-bottom: 30px;
  }

  .section h3 {
    font-size: 24px;
    color: #764ba2;
    margin-top: 30px;
    margin-bottom: 15px;
  }

  .section h4 {
    font-size: 18px;
    color: #555;
    margin-top: 20px;
    margin-bottom: 10px;
  }

  .toc {
    padding: 40px;
  }

  .toc-item {
    padding: 8px 0;
    border-bottom: 1px dotted #ddd;
    display: flex;
    justify-content: space-between;
  }

  .toc-item a {
    color: #667eea;
    text-decoration: none;
  }

  .toc-item a:hover {
    text-decoration: underline;
  }

  .finding {
    background: #f9fafb;
    border-left: 4px solid #ddd;
    padding: 20px;
    margin: 20px 0;
    page-break-inside: avoid;
  }

  .finding.critical {
    border-left-color: #dc2626;
    background: #fef2f2;
  }

  .finding.high {
    border-left-color: #ea580c;
    background: #fff7ed;
  }

  .finding.medium {
    border-left-color: #f59e0b;
    background: #fffbeb;
  }

  .finding.low {
    border-left-color: #10b981;
    background: #f0fdf4;
  }

  .finding.informational {
    border-left-color: #3b82f6;
    background: #eff6ff;
  }

  .severity-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
  }

  .severity-badge.critical {
    background: #dc2626;
    color: white;
  }

  .severity-badge.high {
    background: #ea580c;
    color: white;
  }

  .severity-badge.medium {
    background: #f59e0b;
    color: white;
  }

  .severity-badge.low {
    background: #10b981;
    color: white;
  }

  .severity-badge.informational {
    background: #3b82f6;
    color: white;
  }

  .chart {
    margin: 30px 0;
    page-break-inside: avoid;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }

  table th,
  table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
  }

  table th {
    background: #f3f4f6;
    font-weight: 600;
  }

  ul, ol {
    margin-left: 20px;
    margin-bottom: 15px;
  }

  li {
    margin-bottom: 8px;
  }

  code {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
  }

  pre {
    background: #1f2937;
    color: #f9fafb;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 15px 0;
  }

  pre code {
    background: none;
    color: inherit;
    padding: 0;
  }
</style>
    `;
  }

  /**
   * Generate cover page
   */
  private generateCoverPage(reportData: ReportData): string {
    const reportDate = reportData.reportDate.toLocaleDateString();
    const testStart = reportData.testDates.start.toLocaleDateString();
    const testEnd = reportData.testDates.end.toLocaleDateString();

    return `
<div class="cover-page">
  <h1>${reportData.name}</h1>
  <div class="subtitle">${this.getReportTypeLabel(reportData.type)}</div>

  ${reportData.client ? `<div style="margin-top: 20px;"><strong>Prepared for:</strong><br>${reportData.client.name}</div>` : ''}

  <div class="metadata">
    <div><strong>Report Date:</strong> ${reportDate}</div>
    <div><strong>Testing Period:</strong> ${testStart} to ${testEnd}</div>
    ${reportData.tester ? `<div style="margin-top: 20px;"><strong>Prepared by:</strong><br>${reportData.tester.name}${reportData.tester.title ? `, ${reportData.tester.title}` : ''}</div>` : ''}
    <div style="margin-top: 40px; font-size: 18px;"><strong>${COMPANY_NAME}</strong></div>
  </div>
</div>
    `;
  }

  /**
   * Generate table of contents
   */
  private generateTableOfContents(reportData: ReportData): string {
    const items: string[] = [];

    if (reportData.executiveSummary) {
      items.push('<div class="toc-item"><a href="#executive-summary">Executive Summary</a><span>1</span></div>');
    }

    if (reportData.scope || reportData.methodology) {
      items.push('<div class="toc-item"><a href="#scope-methodology">Scope & Methodology</a><span>2</span></div>');
    }

    if (reportData.findings && reportData.findings.length > 0) {
      items.push('<div class="toc-item"><a href="#findings">Findings</a><span>3</span></div>');
    }

    if (reportData.recommendations && reportData.recommendations.length > 0) {
      items.push('<div class="toc-item"><a href="#recommendations">Recommendations</a><span>4</span></div>');
    }

    if (reportData.conclusion) {
      items.push('<div class="toc-item"><a href="#conclusion">Conclusion</a><span>5</span></div>');
    }

    return `
<div class="toc">
  <h2>Table of Contents</h2>
  ${items.join('\n')}
</div>
    `;
  }

  /**
   * Generate executive summary section
   */
  private generateExecutiveSummarySection(reportData: ReportData): string {
    return `
<div class="section" id="executive-summary">
  <h2>Executive Summary</h2>
  <p>${reportData.executiveSummary}</p>

  ${reportData.findings ? `
  <h3>Key Findings Overview</h3>
  <table>
    <thead>
      <tr>
        <th>Severity</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>
      ${this.generateSeverityCountTable(reportData.findings)}
    </tbody>
  </table>
  ` : ''}
</div>
    `;
  }

  /**
   * Generate scope and methodology section
   */
  private generateScopeAndMethodology(reportData: ReportData): string {
    return `
<div class="section" id="scope-methodology">
  <h2>Scope & Methodology</h2>

  ${reportData.scope ? `
  <h3>Testing Scope</h3>
  <ul>
    ${reportData.scope.map(item => `<li>${item}</li>`).join('\n')}
  </ul>
  ` : ''}

  ${reportData.methodology ? `
  <h3>Testing Methodology</h3>
  <ul>
    ${reportData.methodology.map(item => `<li>${item}</li>`).join('\n')}
  </ul>
  ` : ''}
</div>
    `;
  }

  /**
   * Generate findings section
   */
  private generateFindingsSection(reportData: ReportData, includeCharts: boolean = true): string {
    const findings = reportData.findings!;

    // Sort by severity (critical first)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
    findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const findingsHTML = findings.map((finding, index) => `
<div class="finding ${finding.severity}" id="finding-${finding.id}">
  <h3>${index + 1}. ${finding.title} <span class="severity-badge ${finding.severity}">${finding.severity}</span></h3>
  ${finding.cvss ? `<p><strong>CVSS Score:</strong> ${finding.cvss}</p>` : ''}

  <h4>Description</h4>
  <p>${finding.description}</p>

  <h4>Impact</h4>
  <p>${finding.impact}</p>

  <h4>Recommendation</h4>
  <p>${finding.recommendation}</p>

  ${finding.affectedSystems && finding.affectedSystems.length > 0 ? `
  <h4>Affected Systems</h4>
  <ul>
    ${finding.affectedSystems.map(system => `<li>${system}</li>`).join('\n')}
  </ul>
  ` : ''}

  ${finding.references && finding.references.length > 0 ? `
  <h4>References</h4>
  <ul>
    ${finding.references.map(ref => `<li>${ref}</li>`).join('\n')}
  </ul>
  ` : ''}
</div>
    `).join('\n');

    return `
<div class="section" id="findings">
  <h2>Findings</h2>

  ${includeCharts ? this.generateSeverityChart(findings) : ''}

  ${findingsHTML}
</div>
    `;
  }

  /**
   * Generate recommendations section
   */
  private generateRecommendationsSection(reportData: ReportData): string {
    return `
<div class="section" id="recommendations">
  <h2>Recommendations</h2>
  <ol>
    ${reportData.recommendations!.map(rec => `<li>${rec}</li>`).join('\n')}
  </ol>
</div>
    `;
  }

  /**
   * Generate conclusion section
   */
  private generateConclusionSection(reportData: ReportData): string {
    return `
<div class="section" id="conclusion">
  <h2>Conclusion</h2>
  <p>${reportData.conclusion}</p>
</div>
    `;
  }

  /**
   * Generate severity count table rows
   */
  private generateSeverityCountTable(findings: Finding[]): string {
    const counts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      informational: findings.filter(f => f.severity === 'informational').length,
    };

    return Object.entries(counts)
      .map(([severity, count]) => `
      <tr>
        <td><span class="severity-badge ${severity}">${severity}</span></td>
        <td><strong>${count}</strong></td>
      </tr>
      `).join('\n');
  }

  /**
   * Generate severity chart (simple HTML/CSS chart)
   */
  private generateSeverityChart(findings: Finding[]): string {
    const counts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      informational: findings.filter(f => f.severity === 'informational').length,
    };

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total === 0) return '';

    const bars = Object.entries(counts).map(([severity, count]) => {
      const percentage = (count / total) * 100;
      return `
      <div style="display: flex; align-items: center; margin: 10px 0;">
        <div style="width: 120px; font-weight: bold;">${severity}:</div>
        <div style="flex: 1; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
          <div class="severity-badge ${severity}" style="width: ${percentage}%; padding: 8px; text-align: right;">
            ${count} (${percentage.toFixed(1)}%)
          </div>
        </div>
      </div>
      `;
    }).join('\n');

    return `
<div class="chart">
  <h3>Findings by Severity</h3>
  ${bars}
  <p style="margin-top: 15px; color: #666;"><strong>Total Findings:</strong> ${total}</p>
</div>
    `;
  }

  /**
   * Generate header template for PDF
   */
  private generateHeaderTemplate(headerText?: string): string {
    if (!headerText) {
      return '<div></div>';
    }

    return `
<div style="font-size: 10px; padding: 10px 40px; width: 100%; text-align: center; color: #666;">
  ${headerText}
</div>
    `;
  }

  /**
   * Generate footer template for PDF
   */
  private generateFooterTemplate(footerText?: string, pageNumbers: boolean = true): string {
    const content: string[] = [];

    if (footerText) {
      content.push(footerText);
    }

    if (pageNumbers) {
      content.push('<span class="pageNumber"></span> / <span class="totalPages"></span>');
    }

    if (content.length === 0) {
      return '<div></div>';
    }

    return `
<div style="font-size: 10px; padding: 10px 40px; width: 100%; text-align: center; color: #666; border-top: 1px solid #ddd;">
  ${content.join(' | ')}
</div>
    `;
  }

  /**
   * Get human-readable report type label
   */
  private getReportTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      penetration_test: 'Penetration Testing Report',
      vulnerability_assessment: 'Vulnerability Assessment Report',
      executive_summary: 'Executive Summary',
      operation_summary: 'Operation Summary',
    };
    return labels[type] || type;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const pdfReportGenerator = new PDFReportGenerator();
