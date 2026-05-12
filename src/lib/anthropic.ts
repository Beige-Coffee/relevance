"use client";

import Anthropic from "@anthropic-ai/sdk";

export type Provider = "anthropic" | "openrouter";

export interface ProviderModel {
  id: string;
  label: string;
  description: string;
}

export const ANTHROPIC_MODELS: ProviderModel[] = [
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", description: "Deepest reasoning, slower, costlier" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Balanced, recommended default" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fast and inexpensive" },
];

export const OPENROUTER_MODELS: ProviderModel[] = [
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 (via OpenRouter)", description: "Anthropic Sonnet routed through OpenRouter" },
  { id: "anthropic/claude-opus-4.7", label: "Claude Opus 4.7 (via OpenRouter)", description: "Anthropic Opus routed through OpenRouter" },
  { id: "openai/gpt-5", label: "GPT-5", description: "OpenAI flagship" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Google flagship" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", description: "Open-weights, hosted on OpenRouter" },
];

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-6",
  openrouter: "anthropic/claude-sonnet-4.6",
};

export function modelsFor(provider: Provider): ProviderModel[] {
  return provider === "anthropic" ? ANTHROPIC_MODELS : OPENROUTER_MODELS;
}

export function makeAnthropicClient(apiKey: string): Anthropic {
  if (!apiKey) throw new Error("Anthropic API key required");
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// OpenRouter exposes an Anthropic-compatible Messages endpoint at /v1, so we
// can reuse the Anthropic SDK by overriding the baseURL.
export function makeOpenRouterClient(apiKey: string): Anthropic {
  if (!apiKey) throw new Error("OpenRouter API key required");
  return new Anthropic({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "Awakening Atlas",
    },
  });
}

export function makeClientForProvider(provider: Provider, apiKey: string): Anthropic {
  return provider === "anthropic" ? makeAnthropicClient(apiKey) : makeOpenRouterClient(apiKey);
}

// Legacy compat helper used by older code that doesn't know about providers yet.
export function makeClient(apiKey: string): Anthropic {
  return makeAnthropicClient(apiKey);
}

export const MODELS = ANTHROPIC_MODELS;
export const DEFAULT_MODEL = DEFAULT_MODELS.anthropic;
