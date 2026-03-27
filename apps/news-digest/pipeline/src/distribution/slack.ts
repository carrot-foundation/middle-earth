import type { ProcessedArticle } from '../types.js';

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: Array<{
    type: string;
    text: string;
  }>;
}

interface SlackResult {
  readonly success: boolean;
  readonly error?: string;
}

function sourceLabel(source: ProcessedArticle['source']): string {
  if (source === 'carbon-pulse') return 'Carbon Pulse';
  return 'ESG News';
}

function articleUrl(article: ProcessedArticle): string {
  if (article.notionPageId != null) {
    return `https://www.notion.so/${article.notionPageId.replace(/-/g, '')}`;
  }
  return article.url;
}

export function buildSlackBlocks(articles: readonly ProcessedArticle[], date: string): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `Industry News Digest - ${date}`, emoji: true },
  });

  if (articles.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: 'No articles found for today.' },
    });
    return blocks;
  }

  for (const article of articles) {
    const url = articleUrl(article);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${url}|${article.title}>*\n*Theme:* ${article.mainTheme} | *Author:* ${article.author} | *Source:* ${sourceLabel(article.source)} | *Date:* ${article.date}`,
      },
    });
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: article.summary }],
    });
    blocks.push({ type: 'divider' });
  }

  return blocks;
}

export async function postSlackDigest(
  articles: readonly ProcessedArticle[],
  token: string,
  channel: string,
  date: string,
): Promise<SlackResult> {
  const blocks = buildSlackBlocks(articles, date);

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, blocks }),
  });

  const data = (await response.json()) as { ok: boolean; error?: string };

  if (!data.ok) {
    return { success: false, error: data.error };
  }

  return { success: true };
}
