import { db } from "../db";
import { aiEnrichmentLogs } from "../../shared/schema";
import { ollamaManager } from "./ollama-manager";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * Ollama AI Client Service
 * Enhancement #08 - Ollama AI Integration (Phase 3)
 *
 * Handles:
 * - AI inference using local Ollama models
 * - Cloud API fallback (OpenAI/Anthropic)
 * - Prompt template management
 * - Response caching
 * - Token usage tracking
 * - AI enrichment logging
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type AIProvider = "ollama" | "openai" | "anthropic";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stopSequences?: string[];
  provider?: AIProvider;
  model?: string;
  useCache?: boolean;
  vulnerabilityId?: string;
  enrichmentType?: string;
}

export interface AICompletionResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  cached?: boolean;
  success: boolean;
  error?: string;
}

export interface PromptTemplate {
  name: string;
  system: string;
  user: (params: Record<string, any>) => string;
  examples?: AIMessage[];
}

// ============================================================================
// PROMPT TEMPLATES (#OL-20)
// ============================================================================

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  // CVE Data Extraction
  extract_cve_data: {
    name: "Extract CVE Data",
    system: `You are a cybersecurity expert specializing in vulnerability analysis. Your task is to extract structured information from CVE data sources.

Extract the following details:
- Description (2-3 sentences, technical but concise)
- Severity (critical, high, medium, low, informational)
- CVSS Vector String (if available)
- CVSS Base Score (0-10 scale)
- References (relevant URLs)
- CWE ID (if mentioned)

Return your response as valid JSON with these exact keys: description, severity, cvssVector, cvssScore, references (array), cweId.`,
    user: (params) => `Analyze this CVE: ${params.cveId}

Search Results:
${JSON.stringify(params.searchResults, null, 2)}

Provide a JSON response with extracted CVE data.`,
  },

  // Proof of Concept Generation
  generate_poc: {
    name: "Generate Proof of Concept",
    system: `You are a penetration testing expert. Generate detailed, educational proof-of-concept demonstrations for vulnerabilities.

Guidelines:
- Provide step-by-step instructions
- Include code examples where applicable
- Add clear warnings about authorized testing only
- Explain what each step accomplishes
- Format as markdown with proper sections

**CRITICAL**: Only generate POCs for educational and authorized testing purposes. Always include ethical hacking disclaimers.`,
    user: (params) => `Generate a proof-of-concept for this vulnerability:

Context:
${JSON.stringify(params.context, null, 2)}

${params.searchResults ? `Research Results:\n${JSON.stringify(params.searchResults, null, 2)}` : ""}

${params.targetInfo ? `Target Information:\n${JSON.stringify(params.targetInfo, null, 2)}` : ""}

Provide a detailed, educational POC in markdown format.`,
  },

  // Remediation Suggestions
  generate_remediation: {
    name: "Generate Remediation",
    system: `You are a security remediation specialist. Provide actionable, prioritized remediation steps for vulnerabilities.

Guidelines:
- Provide immediate, short-term, and long-term fixes
- Prioritize by effectiveness and ease of implementation
- Include verification steps
- Reference security best practices
- Format as numbered steps in markdown

Focus on practical, implementable solutions.`,
    user: (params) => `Generate remediation steps for this vulnerability:

Context:
${JSON.stringify(params.context, null, 2)}

${params.searchResults ? `Research Results:\n${JSON.stringify(params.searchResults, null, 2)}` : ""}

Provide detailed, prioritized remediation steps in markdown format.`,
  },

  // Vulnerability Description
  generate_description: {
    name: "Generate Description",
    system: `You are a technical writer specializing in cybersecurity. Generate clear, concise vulnerability descriptions.

Guidelines:
- 2-4 paragraphs maximum
- Start with what the vulnerability is
- Explain the technical mechanism
- Describe potential impact
- Use clear, professional language
- Avoid unnecessary jargon

Format as plain text, not markdown.`,
    user: (params) => `Generate a technical description for this vulnerability:

Context:
${JSON.stringify(params.context, null, 2)}

${params.searchResults ? `Research Results:\n${JSON.stringify(params.searchResults, null, 2)}` : ""}

Provide a clear, concise technical description.`,
  },

  // Impact Analysis
  analyze_impact: {
    name: "Analyze Impact",
    system: `You are a risk assessment expert. Analyze the potential impact of security vulnerabilities.

Assess:
- Confidentiality impact (data exposure)
- Integrity impact (data modification)
- Availability impact (service disruption)
- Business impact (financial, reputation, compliance)
- Exploitability (difficulty, requirements, attack vectors)

Format as structured markdown with clear sections.`,
    user: (params) => `Analyze the impact of this vulnerability:

Vulnerability Data:
${JSON.stringify(params.vulnerabilityData, null, 2)}

${params.targetInfo ? `Target Context:\n${JSON.stringify(params.targetInfo, null, 2)}` : ""}

Provide a comprehensive impact analysis.`,
  },

  // CVSS Calculation
  calculate_cvss: {
    name: "Calculate CVSS",
    system: `You are a CVSS scoring expert. Calculate CVSS v3.1 metrics based on vulnerability characteristics.

CVSS Metrics:
- Attack Vector (AV): Network (N), Adjacent (A), Local (L), Physical (P)
- Attack Complexity (AC): Low (L), High (H)
- Privileges Required (PR): None (N), Low (L), High (H)
- User Interaction (UI): None (N), Required (R)
- Scope (S): Unchanged (U), Changed (C)
- Confidentiality (C): None (N), Low (L), High (H)
- Integrity (I): None (N), Low (L), High (H)
- Availability (A): None (N), Low (L), High (H)

Return JSON with: cvssVector (string), cvssScore (number 0-10).`,
    user: (params) => `Calculate CVSS score for this vulnerability:

${JSON.stringify(params.vulnerabilityData, null, 2)}

Provide JSON response with cvssVector and cvssScore.`,
  },

  // Code Analysis
  analyze_code: {
    name: "Analyze Code",
    system: `You are a secure code review expert. Analyze code snippets for security vulnerabilities.

Identify:
- Specific vulnerabilities (injection, XSS, etc.)
- Root causes
- Affected code lines
- Security implications
- Recommended fixes

Use the qwen2.5-coder model for code analysis when available.`,
    user: (params) => `Analyze this code for security issues:

\`\`\`${params.language || ""}
${params.code}
\`\`\`

${params.context ? `Context: ${params.context}` : ""}

Provide detailed security analysis.`,
  },
};

// ============================================================================
// RESPONSE CACHE (#OL-21)
// ============================================================================

interface CacheEntry {
  response: AICompletionResponse;
  timestamp: number;
  promptHash: string;
}

class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_SIZE = 1000;

  generateHash(messages: AIMessage[], options: AICompletionOptions): string {
    const key = JSON.stringify({ messages, options: { temperature: options.temperature, model: options.model } });
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  get(hash: string): AICompletionResponse | null {
    const entry = this.cache.get(hash);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(hash);
      return null;
    }

    return { ...entry.response, cached: true };
  }

  set(hash: string, response: AICompletionResponse): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(hash, {
      response,
      timestamp: Date.now(),
      promptHash: hash,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// OLLAMA AI CLIENT CLASS
// ============================================================================

export class OllamaAIClient {
  private readonly OLLAMA_HOST: string;
  private readonly DEFAULT_MODEL = "llama3:8b";
  private readonly CODE_MODEL = "qwen2.5-coder:7b";
  private readonly cache = new ResponseCache();
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;

  constructor(host: string = process.env.OLLAMA_HOST || "http://localhost:11434") {
    this.OLLAMA_HOST = host.replace(/\/$/, "");

    // Initialize cloud providers if API keys are available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  // ==========================================================================
  // PROMPT TEMPLATE HELPER (#OL-20)
  // ==========================================================================

  /**
   * Apply a prompt template with parameters
   */
  applyTemplate(templateName: string, params: Record<string, any>): AIMessage[] {
    const template = PROMPT_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Unknown template: ${templateName}`);
    }

    const messages: AIMessage[] = [
      { role: "system", content: template.system },
    ];

    if (template.examples) {
      messages.push(...template.examples);
    }

    messages.push({ role: "user", content: template.user(params) });

    return messages;
  }

  // ==========================================================================
  // AI COMPLETION METHODS
  // ==========================================================================

  /**
   * Main completion method with automatic provider selection and fallback
   */
  async complete(
    messages: AIMessage[],
    options: AICompletionOptions = {}
  ): Promise<AICompletionResponse> {
    const startTime = Date.now();

    // Check cache first (#OL-21)
    if (options.useCache !== false) {
      const cacheHash = this.cache.generateHash(messages, options);
      const cached = this.cache.get(cacheHash);
      if (cached) {
        console.log(`[OllamaAIClient] Cache hit for prompt hash: ${cacheHash}`);
        return cached;
      }
    }

    // Determine provider and model
    const provider = options.provider || this.selectProvider();
    const model = options.model || this.selectModel(options.enrichmentType);

    let response: AICompletionResponse;

    try {
      // Try primary provider
      response = await this.callProvider(provider, model, messages, options);
    } catch (error) {
      console.error(`[OllamaAIClient] ${provider} failed:`, error);

      // Fallback to cloud if Ollama fails (#OL-19)
      if (provider === "ollama") {
        console.log("[OllamaAIClient] Falling back to cloud provider...");
        const fallbackProvider = this.anthropic ? "anthropic" : this.openai ? "openai" : null;

        if (fallbackProvider) {
          try {
            response = await this.callProvider(fallbackProvider, model, messages, options);
          } catch (fallbackError) {
            console.error(`[OllamaAIClient] Fallback failed:`, fallbackError);
            throw fallbackError;
          }
        } else {
          throw new Error("No fallback provider available");
        }
      } else {
        throw error;
      }
    }

    // Cache successful response
    if (response.success && options.useCache !== false) {
      const cacheHash = this.cache.generateHash(messages, options);
      this.cache.set(cacheHash, response);
    }

    // Log to database (#OL-23)
    await this.logEnrichment(response, messages, options);

    // Track model usage if using Ollama
    if (response.provider === "ollama") {
      await ollamaManager.trackModelUsage(response.model);
    }

    return response;
  }

  /**
   * Call specific provider
   */
  private async callProvider(
    provider: AIProvider,
    model: string,
    messages: AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    switch (provider) {
      case "ollama":
        return await this.callOllama(model, messages, options);
      case "anthropic":
        return await this.callAnthropic(model, messages, options);
      case "openai":
        return await this.callOpenAI(model, messages, options);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Call Ollama API for completion
   */
  private async callOllama(
    model: string,
    messages: AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.OLLAMA_HOST}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 2048,
            stop: options.stopSequences,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const durationMs = Date.now() - startTime;

      return {
        content: data.message?.content || "",
        provider: "ollama",
        model,
        tokensUsed: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        durationMs,
        success: true,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        content: "",
        provider: "ollama",
        model,
        tokensUsed: 0,
        promptTokens: 0,
        completionTokens: 0,
        durationMs,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Call Anthropic API for completion
   */
  private async callAnthropic(
    model: string,
    messages: AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    if (!this.anthropic) {
      throw new Error("Anthropic API not configured");
    }

    const startTime = Date.now();

    try {
      // Extract system message
      const systemMessage = messages.find(m => m.role === "system")?.content || "";
      const userMessages = messages.filter(m => m.role !== "system");

      const response = await this.anthropic.messages.create({
        model: model || "claude-3-5-sonnet-20241022",
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature ?? 0.7,
        system: systemMessage,
        messages: userMessages as any,
      });

      const durationMs = Date.now() - startTime;
      const content = response.content[0].type === "text" ? response.content[0].text : "";

      return {
        content,
        provider: "anthropic",
        model: response.model,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        durationMs,
        success: true,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        content: "",
        provider: "anthropic",
        model: model || "claude-3-5-sonnet-20241022",
        tokensUsed: 0,
        promptTokens: 0,
        completionTokens: 0,
        durationMs,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Call OpenAI API for completion
   */
  private async callOpenAI(
    model: string,
    messages: AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    if (!this.openai) {
      throw new Error("OpenAI API not configured");
    }

    const startTime = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model: model || "gpt-4-turbo-preview",
        messages: messages as any,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature ?? 0.7,
        stop: options.stopSequences,
      });

      const durationMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content || "";

      return {
        content,
        provider: "openai",
        model: response.model,
        tokensUsed: response.usage?.total_tokens || 0,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        durationMs,
        success: true,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        content: "",
        provider: "openai",
        model: model || "gpt-4-turbo-preview",
        tokensUsed: 0,
        promptTokens: 0,
        completionTokens: 0,
        durationMs,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==========================================================================
  // PROVIDER SELECTION
  // ==========================================================================

  /**
   * Automatically select the best available provider
   */
  private selectProvider(): AIProvider {
    // Prefer local Ollama if available
    return "ollama";

    // In production, could check Ollama health and fallback:
    // const health = await ollamaManager.healthCheck();
    // if (health.healthy) return "ollama";
    // return this.anthropic ? "anthropic" : this.openai ? "openai" : "ollama";
  }

  /**
   * Select appropriate model based on enrichment type
   */
  private selectModel(enrichmentType?: string): string {
    // Use code model for code analysis
    if (enrichmentType === "code_analysis") {
      return this.CODE_MODEL;
    }

    // Default to general model
    return this.DEFAULT_MODEL;
  }

  // ==========================================================================
  // AI ENRICHMENT LOGGING (#OL-22, #OL-23)
  // ==========================================================================

  /**
   * Log AI enrichment to database
   */
  private async logEnrichment(
    response: AICompletionResponse,
    messages: AIMessage[],
    options: AICompletionOptions
  ): Promise<void> {
    try {
      await db.insert(aiEnrichmentLogs).values({
        vulnerabilityId: options.vulnerabilityId || null,
        modelUsed: response.model,
        provider: response.provider,
        enrichmentType: options.enrichmentType || "general",
        prompt: messages.map(m => `${m.role}: ${m.content}`).join("\n\n"),
        response: response.content,
        tokensUsed: response.tokensUsed,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        durationMs: response.durationMs,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens,
        success: response.success,
        errorMessage: response.error,
      });
    } catch (error) {
      console.error("[OllamaAIClient] Failed to log enrichment:", error);
      // Don't throw - logging failure shouldn't break AI completion
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size(),
      maxSize: 1000,
    };
  }

  /**
   * Clear response cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if Ollama is available
   */
  async isOllamaAvailable(): Promise<boolean> {
    const health = await ollamaManager.healthCheck();
    return health.healthy;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = ["ollama"];
    if (this.anthropic) providers.push("anthropic");
    if (this.openai) providers.push("openai");
    return providers;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const ollamaAIClient = new OllamaAIClient();

console.log("[OllamaAIClient] Service initialized");
console.log(`[OllamaAIClient] Available providers: ${ollamaAIClient.getAvailableProviders().join(", ")}`);
