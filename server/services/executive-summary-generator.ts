/**
 * Executive Summary Generator Service
 *
 * AI-powered executive summary generation for security reports.
 * Features:
 * - Key findings extraction and summarization
 * - Risk scoring overview
 * - Recommendations prioritization
 * - Customizable tone (technical vs executive)
 * - Support for multiple AI providers (Anthropic, OpenAI)
 */

import { getOpenAIClient, getAnthropicClient } from "./ai-clients";

// ============================================================================
// Types
// ============================================================================

export interface Finding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  cvss?: number;
  description: string;
  impact: string;
  recommendation: string;
  affectedSystems?: string[];
}

export interface ReportData {
  name: string;
  type: string;
  operationId?: string;
  findings: Finding[];
  scope?: string[];
  methodology?: string[];
  testDates?: {
    start: Date;
    end: Date;
  };
  client?: {
    name: string;
  };
}

export interface ExecutiveSummaryOptions {
  tone?: "executive" | "technical" | "balanced";
  maxLength?: number;
  includeRiskScore?: boolean;
  includeRecommendations?: boolean;
  includeBusinessImpact?: boolean;
  focusAreas?: string[]; // e.g., ["compliance", "data security", "infrastructure"]
}

export interface ExecutiveSummary {
  summary: string;
  keyFindings: string[];
  riskScore?: {
    overall: number; // 0-100
    category: "critical" | "high" | "medium" | "low";
    justification: string;
  };
  recommendations: string[];
  businessImpact?: string;
  nextSteps?: string[];
}

// ============================================================================
// Executive Summary Generator
// ============================================================================

export class ExecutiveSummaryGenerator {
  private provider: "anthropic" | "openai";

  constructor(provider: "anthropic" | "openai" = "anthropic") {
    this.provider = provider;
  }

  private get anthropicClient() {
    return getAnthropicClient();
  }

  private get openaiClient() {
    return getOpenAIClient();
  }

  /**
   * Generate an executive summary from report data
   */
  async generateSummary(
    reportData: ReportData,
    options: ExecutiveSummaryOptions = {}
  ): Promise<ExecutiveSummary> {
    const {
      tone = "balanced",
      maxLength = 500,
      includeRiskScore = true,
      includeRecommendations = true,
      includeBusinessImpact = true,
      focusAreas = [],
    } = options;

    // Prepare the prompt
    const prompt = this.buildPrompt(reportData, {
      tone,
      maxLength,
      includeRiskScore,
      includeRecommendations,
      includeBusinessImpact,
      focusAreas,
    });

    // Generate summary using selected AI provider
    let response: string;
    if (this.provider === "anthropic" && this.anthropicClient) {
      response = await this.generateWithAnthropic(prompt);
    } else if (this.provider === "openai" && this.openaiClient) {
      response = await this.generateWithOpenAI(prompt);
    } else {
      // Fallback to template-based generation
      return this.generateFallbackSummary(reportData, options);
    }

    // Parse the AI response into structured format
    return this.parseResponse(response, reportData, includeRiskScore);
  }

  /**
   * Build the prompt for AI generation
   */
  private buildPrompt(
    reportData: ReportData,
    options: ExecutiveSummaryOptions
  ): string {
    const { tone, maxLength, includeRiskScore, includeRecommendations, includeBusinessImpact, focusAreas } = options;

    // Calculate severity counts
    const severityCounts = this.calculateSeverityCounts(reportData.findings);
    const totalFindings = reportData.findings.length;

    // Build context about findings
    const findingsContext = reportData.findings
      .slice(0, 10) // Top 10 findings
      .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\n   Impact: ${f.impact}`)
      .join('\n\n');

    const toneInstructions = {
      executive: "Write in a clear, non-technical language suitable for C-level executives and board members. Focus on business impact and strategic risks.",
      technical: "Use precise technical terminology. Include specific vulnerability types, CVSS scores, and technical details.",
      balanced: "Balance technical accuracy with business context. Make it accessible to both technical and non-technical stakeholders.",
    };

    const prompt = `You are a cybersecurity expert writing an executive summary for a security assessment report.

**Report Details:**
- Name: ${reportData.name}
- Type: ${reportData.type}
- Client: ${reportData.client?.name || "Not specified"}
- Testing Period: ${reportData.testDates ? `${reportData.testDates.start.toLocaleDateString()} to ${reportData.testDates.end.toLocaleDateString()}` : "Not specified"}

**Findings Overview:**
- Total Findings: ${totalFindings}
- Critical: ${severityCounts.critical}
- High: ${severityCounts.high}
- Medium: ${severityCounts.medium}
- Low: ${severityCounts.low}
- Informational: ${severityCounts.informational}

**Top Findings:**
${findingsContext}

**Testing Scope:**
${reportData.scope ? reportData.scope.join(', ') : 'Not specified'}

**Instructions:**
${toneInstructions[tone!]}

Write an executive summary (approximately ${maxLength} words) that includes:

1. **Overview:** A brief introduction summarizing the assessment and its purpose.

2. **Key Findings:** Extract and summarize the most critical security issues discovered (3-5 key findings).

${includeRiskScore ? '3. **Risk Assessment:** Provide an overall risk score (0-100) and justify the rating based on the findings severity and potential business impact.' : ''}

${includeBusinessImpact ? '4. **Business Impact:** Explain how these security issues could affect the organization\'s operations, reputation, data security, and compliance.' : ''}

${includeRecommendations ? '5. **Recommendations:** Prioritize the top 3-5 recommendations for immediate action.' : ''}

6. **Next Steps:** Suggest a timeline and approach for remediation.

${focusAreas.length > 0 ? `\n**Focus Areas:** Pay special attention to: ${focusAreas.join(', ')}` : ''}

**Output Format:**
Return the response as JSON with the following structure:
{
  "summary": "Main executive summary text (2-3 paragraphs)",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  ${includeRiskScore ? '"riskScore": { "overall": 75, "category": "high", "justification": "Reason for score" },' : ''}
  ${includeRecommendations ? '"recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],' : ''}
  ${includeBusinessImpact ? '"businessImpact": "Business impact description",' : ''}
  "nextSteps": ["Step 1", "Step 2", "Step 3"]
}

Ensure the JSON is valid and parseable.`;

    return prompt;
  }

  /**
   * Generate summary using Anthropic Claude
   */
  private async generateWithAnthropic(prompt: string): Promise<string> {
    if (!this.anthropicClient) {
      throw new Error("Anthropic client not initialized");
    }

    const response = await this.anthropicClient.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Anthropic");
    }

    return content.text;
  }

  /**
   * Generate summary using OpenAI GPT
   */
  private async generateWithOpenAI(prompt: string): Promise<string> {
    if (!this.openaiClient) {
      throw new Error("OpenAI client not initialized");
    }

    const response = await this.openaiClient.chat.completions.create({
      model: "gpt-5.2-chat-latest",
      messages: [
        {
          role: "system",
          content: "You are a cybersecurity expert specializing in executive report writing.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    return response.choices[0].message.content || "";
  }

  /**
   * Parse AI response into structured format
   */
  private parseResponse(
    response: string,
    reportData: ReportData,
    includeRiskScore: boolean
  ): ExecutiveSummary {
    try {
      // Try to extract JSON from response (might be wrapped in markdown code blocks)
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);

        return {
          summary: parsed.summary || "",
          keyFindings: parsed.keyFindings || [],
          riskScore: includeRiskScore ? parsed.riskScore : undefined,
          recommendations: parsed.recommendations || [],
          businessImpact: parsed.businessImpact,
          nextSteps: parsed.nextSteps || [],
        };
      }

      // If JSON parsing fails, create structured response from text
      return this.parseTextResponse(response, reportData, includeRiskScore);
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      // Fallback to basic structure
      return {
        summary: response.substring(0, 500),
        keyFindings: this.extractKeyFindings(reportData.findings),
        recommendations: this.extractTopRecommendations(reportData.findings),
      };
    }
  }

  /**
   * Parse text response when JSON parsing fails
   */
  private parseTextResponse(
    response: string,
    reportData: ReportData,
    includeRiskScore: boolean
  ): ExecutiveSummary {
    // Extract sections using regex patterns
    const summaryMatch = response.match(/##?\s*(?:Executive )?Summary[:\n]+([\s\S]*?)(?=##?|$)/i);
    const keyFindingsMatch = response.match(/##?\s*Key Findings[:\n]+([\s\S]*?)(?=##?|$)/i);
    const recommendationsMatch = response.match(/##?\s*Recommendations[:\n]+([\s\S]*?)(?=##?|$)/i);
    const businessImpactMatch = response.match(/##?\s*Business Impact[:\n]+([\s\S]*?)(?=##?|$)/i);
    const nextStepsMatch = response.match(/##?\s*Next Steps[:\n]+([\s\S]*?)(?=##?|$)/i);

    return {
      summary: summaryMatch ? summaryMatch[1].trim() : response.substring(0, 500),
      keyFindings: keyFindingsMatch ? this.extractListItems(keyFindingsMatch[1]) : this.extractKeyFindings(reportData.findings),
      riskScore: includeRiskScore ? this.calculateRiskScore(reportData.findings) : undefined,
      recommendations: recommendationsMatch ? this.extractListItems(recommendationsMatch[1]) : this.extractTopRecommendations(reportData.findings),
      businessImpact: businessImpactMatch ? businessImpactMatch[1].trim() : undefined,
      nextSteps: nextStepsMatch ? this.extractListItems(nextStepsMatch[1]) : undefined,
    };
  }

  /**
   * Extract list items from text
   */
  private extractListItems(text: string): string[] {
    const items = text.match(/^[\s]*[-*\d.]+\s+(.+?)$/gm);
    return items ? items.map(item => item.replace(/^[\s]*[-*\d.]+\s+/, '').trim()) : [];
  }

  /**
   * Generate fallback summary when AI is not available
   */
  private generateFallbackSummary(
    reportData: ReportData,
    options: ExecutiveSummaryOptions
  ): ExecutiveSummary {
    const severityCounts = this.calculateSeverityCounts(reportData.findings);
    const totalFindings = reportData.findings.length;

    const summary = `This ${reportData.type} assessment identified ${totalFindings} security findings across the tested environment. ` +
      `Of these, ${severityCounts.critical} were rated as Critical, ${severityCounts.high} as High, ` +
      `${severityCounts.medium} as Medium, ${severityCounts.low} as Low, and ${severityCounts.informational} as Informational. ` +
      `The findings represent vulnerabilities that could potentially impact the organization's security posture and require remediation according to their severity.`;

    return {
      summary,
      keyFindings: this.extractKeyFindings(reportData.findings),
      riskScore: options.includeRiskScore ? this.calculateRiskScore(reportData.findings) : undefined,
      recommendations: options.includeRecommendations ? this.extractTopRecommendations(reportData.findings) : [],
      businessImpact: options.includeBusinessImpact ? this.generateBusinessImpact(severityCounts) : undefined,
      nextSteps: [
        "Review all critical and high severity findings immediately",
        "Develop a remediation plan with prioritized timeline",
        "Allocate resources for vulnerability resolution",
        "Schedule follow-up testing to verify fixes",
      ],
    };
  }

  /**
   * Calculate severity counts
   */
  private calculateSeverityCounts(findings: Finding[]): Record<string, number> {
    return {
      critical: findings.filter(f => f.severity === "critical").length,
      high: findings.filter(f => f.severity === "high").length,
      medium: findings.filter(f => f.severity === "medium").length,
      low: findings.filter(f => f.severity === "low").length,
      informational: findings.filter(f => f.severity === "informational").length,
    };
  }

  /**
   * Extract key findings
   */
  private extractKeyFindings(findings: Finding[]): string[] {
    // Get critical and high severity findings
    const criticalFindings = findings.filter(f => f.severity === "critical" || f.severity === "high");

    // Sort by CVSS score if available
    criticalFindings.sort((a, b) => (b.cvss || 0) - (a.cvss || 0));

    return criticalFindings.slice(0, 5).map(f => `${f.title}: ${f.impact}`);
  }

  /**
   * Extract top recommendations
   */
  private extractTopRecommendations(findings: Finding[]): string[] {
    // Get critical and high severity findings
    const criticalFindings = findings.filter(f => f.severity === "critical" || f.severity === "high");

    // Extract unique recommendations
    const recommendations = new Set<string>();
    criticalFindings.forEach(f => {
      if (f.recommendation) {
        recommendations.add(f.recommendation);
      }
    });

    return Array.from(recommendations).slice(0, 5);
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(findings: Finding[]): {
    overall: number;
    category: "critical" | "high" | "medium" | "low";
    justification: string;
  } {
    const severityCounts = this.calculateSeverityCounts(findings);

    // Weighted scoring
    const score =
      severityCounts.critical * 25 +
      severityCounts.high * 15 +
      severityCounts.medium * 7 +
      severityCounts.low * 3 +
      severityCounts.informational * 1;

    // Normalize to 0-100 scale (assuming max 20 findings)
    const normalized = Math.min(100, Math.round((score / 500) * 100));

    let category: "critical" | "high" | "medium" | "low";
    if (normalized >= 75) category = "critical";
    else if (normalized >= 50) category = "high";
    else if (normalized >= 25) category = "medium";
    else category = "low";

    const justification = `Risk score of ${normalized} based on ${severityCounts.critical} critical, ` +
      `${severityCounts.high} high, ${severityCounts.medium} medium, and ${severityCounts.low} low severity findings.`;

    return {
      overall: normalized,
      category,
      justification,
    };
  }

  /**
   * Generate business impact description
   */
  private generateBusinessImpact(severityCounts: Record<string, number>): string {
    const impacts: string[] = [];

    if (severityCounts.critical > 0) {
      impacts.push(`${severityCounts.critical} critical vulnerabilities pose immediate risk to data confidentiality, system integrity, and business operations`);
    }

    if (severityCounts.high > 0) {
      impacts.push(`${severityCounts.high} high-severity issues could lead to unauthorized access, data breaches, or service disruption`);
    }

    if (severityCounts.medium > 0) {
      impacts.push(`${severityCounts.medium} medium-severity findings require attention to prevent potential security incidents`);
    }

    if (impacts.length === 0) {
      return "The assessment found limited security concerns. However, continued monitoring and security maintenance are recommended.";
    }

    return "The identified security issues could have the following business impacts: " + impacts.join("; ") + ".";
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const executiveSummaryGenerator = new ExecutiveSummaryGenerator();
