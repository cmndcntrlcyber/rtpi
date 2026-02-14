/**
 * Centralized AI Client Manager
 *
 * Provides lazy-initialized, cached AI clients that read from process.env
 * at call time. This allows keys saved through the Settings UI to take
 * effect immediately without a server restart.
 *
 * Usage:
 *   import { getOpenAIClient, getAnthropicClient } from './ai-clients';
 *   const openai = getOpenAIClient(); // null if key missing/invalid
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

let cachedOpenAI: OpenAI | null = null;
let cachedAnthropic: Anthropic | null = null;
let lastOpenAIKey: string | undefined;
let lastAnthropicKey: string | undefined;

const PLACEHOLDER_PREFIXES = ["your-", "changeme", "replace-"];

function isValidApiKey(key: string | undefined): boolean {
  if (!key || key.trim() === "") return false;
  const lower = key.toLowerCase();
  return !PLACEHOLDER_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!isValidApiKey(key)) return null;

  if (cachedOpenAI && lastOpenAIKey === key) return cachedOpenAI;

  cachedOpenAI = new OpenAI({ apiKey: key });
  lastOpenAIKey = key;
  return cachedOpenAI;
}

export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!isValidApiKey(key)) return null;

  if (cachedAnthropic && lastAnthropicKey === key) return cachedAnthropic;

  cachedAnthropic = new Anthropic({ apiKey: key });
  lastAnthropicKey = key;
  return cachedAnthropic;
}

export function invalidateAIClients(): void {
  cachedOpenAI = null;
  cachedAnthropic = null;
  lastOpenAIKey = undefined;
  lastAnthropicKey = undefined;
}
