import type { ProcessedArticle } from '../types.js';
import { NOTION_VALID_THEMES } from '../config.constants.js';
import { sourceLabel } from '../helpers/source.helpers.js';

interface NotionResult {
  readonly success: boolean;
  readonly pageId?: string;
  readonly error?: string;
}

const NOTION_TEXT_LIMIT = 2000;

function isValidTheme(theme: string): boolean {
  return (NOTION_VALID_THEMES as readonly string[]).includes(theme);
}

function buildPageProperties(article: ProcessedArticle): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: article.title } }],
    },
    // Trailing space in 'Source ' is intentional — matches the Notion database column name
    'Source ': {
      rich_text: [{ text: { content: sourceLabel(article.source) } }],
    },
    Company: {
      rich_text: [{ text: { content: 'Not Applicable' } }],
    },
    Date: {
      date: { start: article.date },
    },
  };

  if (article.segment) {
    properties['Segment'] = { select: { name: article.segment } };
  }

  if (isValidTheme(article.mainTheme)) {
    properties['Main Theme'] = {
      multi_select: [{ name: article.mainTheme }],
    };
  }

  return properties;
}

function chunkText(text: string): unknown[] {
  const blocks: unknown[] = [];
  for (let i = 0; i < text.length; i += NOTION_TEXT_LIMIT) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: text.slice(i, i + NOTION_TEXT_LIMIT) } }],
      },
    });
  }
  return blocks;
}

function buildPageContent(article: ProcessedArticle): unknown[] {
  const children: unknown[] = [];

  if (article.keyPoints.length > 0) {
    const keyPointsText = `Key Points:\n${article.keyPoints.map((p) => `• ${p}`).join('\n')}`;
    children.push(...chunkText(keyPointsText));
  }

  children.push(...chunkText(`Summary:\n${article.summary}`));
  children.push(...chunkText(article.fullContent));

  return children;
}

export async function createNotionPage(
  article: ProcessedArticle,
  databaseId: string,
  token: string,
): Promise<NotionResult> {
  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: buildPageProperties(article),
        children: buildPageContent(article),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const pageId = typeof data['id'] === 'string' ? data['id'] : undefined;
    return { success: true, pageId };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    return { success: false, error: msg };
  }
}
