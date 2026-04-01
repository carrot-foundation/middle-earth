import { SEGMENTS } from '../config.constants.js';
import type { RawArticle } from '../types.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CONTENT_FOR_PROMPT = 8000;
const MAX_FALLBACK_SUMMARY = 500;

export interface ClaudeResult {
  readonly summary: string;
  readonly keyPoints: readonly string[];
  readonly segment: string;
  readonly isFallback: boolean;
}

export function buildPrompt(article: RawArticle): string {
  const truncatedContent = article.fullContent.slice(0, MAX_CONTENT_FOR_PROMPT);
  const segmentList = SEGMENTS.join(', ');

  return `Analyze this news article and return a JSON object with exactly these fields:

1. "summary": A 2-3 sentence summary. Write it yourself — do NOT copy the first paragraph.
2. "keyPoints": An array of 3-5 key points (short bullet-point strings).
3. "segment": Classify into one of these segments: ${segmentList}. Pick the best match. If none fits, use empty string.

Article:
Title: ${article.title}
Theme: ${article.mainTheme}
Source: ${article.source}
Date: ${article.date}
Content:
${truncatedContent}

Return ONLY valid JSON, no markdown fences, no explanation.`;
}

function parseFallback(article: RawArticle): ClaudeResult {
  const summary = article.fullContent.slice(0, MAX_FALLBACK_SUMMARY).trimEnd();
  return { summary: summary || article.title, keyPoints: [], segment: '', isFallback: true };
}

export async function processArticle(
  article: RawArticle,
  apiKey: string,
): Promise<ClaudeResult> {
  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: buildPrompt(article) }],
      }),
    });

    if (!response.ok) {
      console.error(`Claude API returned ${response.status} for "${article.title}"`);
      return parseFallback(article);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const content = Array.isArray(data['content']) ? data['content'] : [];
    const firstBlock = content[0] as Record<string, unknown> | undefined;
    const rawText = typeof firstBlock?.['text'] === 'string' ? firstBlock['text'] : '';
    if (!rawText) {
      console.error(`Claude API returned empty content for "${article.title}"`);
      return parseFallback(article);
    }
    const text = rawText.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const summary =
      typeof parsed['summary'] === 'string' && parsed['summary'].trim().length > 0
        ? parsed['summary']
        : article.title;
    const keyPoints = Array.isArray(parsed['keyPoints'])
      ? parsed['keyPoints'].filter(
          (point): point is string => typeof point === 'string' && point.trim().length > 0,
        )
      : [];
    const segment =
      typeof parsed['segment'] === 'string' &&
      SEGMENTS.includes(parsed['segment'] as (typeof SEGMENTS)[number])
        ? parsed['segment']
        : '';

    return { summary, keyPoints, segment, isFallback: false };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`Claude API failed for "${article.title}": ${message}`);
    return parseFallback(article);
  }
}
