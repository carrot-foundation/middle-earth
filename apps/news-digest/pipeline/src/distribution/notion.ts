import type { ProcessedArticle } from '../types.js';
import { NOTION_VALID_THEMES } from '../config.constants.js';

interface NotionResult {
  readonly success: boolean;
  readonly pageId?: string;
  readonly error?: string;
}

function isValidTheme(theme: string): boolean {
  return (NOTION_VALID_THEMES as readonly string[]).includes(theme);
}

function buildPageProperties(article: ProcessedArticle, databaseId: string): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: article.title } }],
    },
    Segment: {
      select: { name: article.segment },
    },
    'Source ': {
      rich_text: [{ text: { content: article.source } }],
    },
    Company: {
      rich_text: [{ text: { content: 'Not Applicable' } }],
    },
    Date: {
      date: { start: article.date },
    },
  };

  if (isValidTheme(article.mainTheme)) {
    properties['Main Theme'] = {
      multi_select: [{ name: article.mainTheme }],
    };
  }

  return { ...properties, _databaseId: databaseId };
}

function buildPageContent(article: ProcessedArticle): unknown[] {
  const children: unknown[] = [];

  if (article.keyPoints.length > 0) {
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: `Key Points:\n${article.keyPoints.map((p) => `• ${p}`).join('\n')}` } }],
      },
    });
  }

  children.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: `Summary:\n${article.summary}` } }],
    },
  });

  children.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: article.fullContent } }],
    },
  });

  return children;
}

export async function createNotionPage(
  article: ProcessedArticle,
  databaseId: string,
  token: string,
): Promise<NotionResult> {
  const properties = buildPageProperties(article, databaseId);
  const { _databaseId, ...pageProperties } = properties;

  const body = {
    parent: { database_id: _databaseId },
    properties: pageProperties,
    children: buildPageContent(article),
  };

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `HTTP ${response.status}: ${errorText}` };
  }

  const data = (await response.json()) as { id: string };
  return { success: true, pageId: data.id };
}
