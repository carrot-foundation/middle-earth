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

const MAX_SUMMARY_LENGTH = 500;
const MAX_ARTICLES = 15;

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
      text: {
        type: 'mrkdwn',
        text: 'No new articles were extracted today. The pipeline ran but found no new relevant content across monitored themes.',
      },
    });
    return blocks;
  }

  const uniqueSources = [...new Set(articles.map((a) => sourceLabel(a.source)))];
  const sourceNames = uniqueSources.join(' & ');

  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `*${articles.length} article${articles.length !== 1 ? 's' : ''}* extracted from ${sourceNames}`,
    }],
  });
  blocks.push({ type: 'divider' });

  for (const article of articles.slice(0, MAX_ARTICLES)) {
    const url = articleUrl(article);

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${url}|${article.title}>*\n:label: ${article.mainTheme}  |  :writing_hand: ${article.author}  |  :newspaper: ${sourceLabel(article.source)}  |  :calendar: ${article.date}`,
      },
    });

    if (article.summary) {
      let summary = article.summary;
      if (summary.length > MAX_SUMMARY_LENGTH) {
        summary = summary.slice(0, MAX_SUMMARY_LENGTH).trimEnd() + '...';
      }
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `> ${summary.replace(/\n/g, '\n> ')}` }],
      });
    }

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
  try {
    const blocks = buildSlackBlocks(articles, date);

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, blocks }),
    });

    const data = (await response.json()) as { ok: boolean; error?: string; ts?: string };

    if (!data.ok) {
      console.error(`Slack API error: ${data.error}`);
      return { success: false, error: data.error ?? 'unknown error' };
    }

    console.log(`Slack digest posted. ts: ${data.ts}`);
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    return { success: false, error: msg };
  }
}
