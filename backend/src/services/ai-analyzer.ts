/**
 * AI Analysis Engine
 * Analyzes webhook errors using Claude AI via OpenRouter.
 * PRD: FR-4, NFR-1.4 (<10s), FR-4.5 (cache)
 */

import type { RedisClient } from '../lib/redis';
import { getCached, setCache } from '../lib/redis';

export interface AIAnalysis {
  status: 'success' | 'warning' | 'error';
  summary: string;
  issues: string[];
  rootCause: string | null;
  suggestions: Array<{
    title: string;
    description: string;
    code?: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  relatedDocs: string[];
}

interface WebhookForAnalysis {
  provider: string | null;
  eventType: string | null;
  responseCode: number | null;
  signatureValid: boolean | null;
  headers: Record<string, unknown>;
  payload: Record<string, unknown>;
  responseBody: string | null;
}

const ANALYSIS_PROMPT = `You are a webhook debugging expert. Analyze the webhook below and provide actionable debugging help.

## Webhook Details
Provider: {{provider}}
Event: {{event}}
Response Code: {{responseCode}}
Signature Valid: {{signatureValid}}

## Headers
{{headers}}

## Payload (truncated to 2000 chars)
{{payload}}

## Error Context
{{error}}

## Task
Respond ONLY with valid JSON (no markdown, no code fences):
{
  "status": "success|warning|error",
  "summary": "One sentence summary",
  "issues": ["issue1", "issue2"],
  "rootCause": "Technical root cause or null",
  "suggestions": [
    {
      "title": "Fix title",
      "description": "What to do",
      "code": "Optional code snippet",
      "difficulty": "easy|medium|hard"
    }
  ],
  "relatedDocs": ["https://relevant-docs-url"]
}`;

export async function analyzeWebhook(
  webhook: WebhookForAnalysis,
  apiKey: string,
  redis?: RedisClient
): Promise<AIAnalysis> {
  // Check cache first (FR-4.5)
  if (redis) {
    const cacheKey = `ai:${webhook.provider}:${webhook.responseCode}:${webhook.signatureValid}`;
    const cached = await getCached<AIAnalysis>(redis, cacheKey);
    if (cached) return cached;
  }

  const prompt = ANALYSIS_PROMPT
    .replace('{{provider}}', webhook.provider || 'unknown')
    .replace('{{event}}', webhook.eventType || 'unknown')
    .replace('{{responseCode}}', webhook.responseCode?.toString() || 'N/A')
    .replace('{{signatureValid}}', webhook.signatureValid === null ? 'N/A' : webhook.signatureValid ? 'Yes' : 'No')
    .replace('{{headers}}', JSON.stringify(webhook.headers, null, 2).substring(0, 1000))
    .replace('{{payload}}', JSON.stringify(webhook.payload, null, 2).substring(0, 2000))
    .replace('{{error}}', webhook.responseBody || 'None');

  const isGeminiKey = apiKey.startsWith('AIza');
  let content = '';

  if (isGeminiKey) {
    // Route to Google Gemini API natively
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return getDefaultAnalysis('AI analysis failed: ' + response.status);
    }

    const result = await response.json() as any;
    content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    // Route to OpenRouter (Claude/etc)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hooklens.dev',
        'X-Title': 'HookLens',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return getDefaultAnalysis('AI analysis failed: ' + response.status);
    }

    const result = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    content = result.choices[0]?.message?.content || '';
  }

  try {
    // Clean potential markdown wrappers if AI ignores json mime type
    const cleanContent = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const analysis: AIAnalysis = JSON.parse(cleanContent);

    // Cache for 1 hour
    if (redis) {
      const cacheKey = `ai:${webhook.provider}:${webhook.responseCode}:${webhook.signatureValid}`;
      await setCache(redis, cacheKey, analysis, 3600);
    }

    return analysis;
  } catch {
    return getDefaultAnalysis('Failed to parse AI response');
  }
}

function getDefaultAnalysis(error: string): AIAnalysis {
  return {
    status: 'warning',
    summary: error,
    issues: [],
    rootCause: null,
    suggestions: [],
    relatedDocs: [],
  };
}
