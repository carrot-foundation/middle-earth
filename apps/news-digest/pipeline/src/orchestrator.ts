import { S3Store } from './state/s3-store.js';
import { getEligibleThemes } from './helpers/theme.helpers.js';
import { deduplicateArticles } from './helpers/dedup.helpers.js';
import { buildArticleMarkdown, slugify } from './helpers/markdown.helpers.js';
import { scrapeCarbonPulse } from './scraper/carbon-pulse.js';
import { scrapeEsgNews } from './scraper/esg-news.js';
import { scrapeTrellis } from './scraper/trellis.js';
import { processArticle } from './ai/article-processor.js';
import { postSlackDigest } from './distribution/slack.js';
import { createNotionPage } from './distribution/notion.js';
import { createGmailDraft } from './distribution/email.js';
import { buildEmailHtml } from './distribution/email-template.helpers.js';
import { THEMES } from './config.constants.js';
import type { PipelineResult, ProcessedArticle, ProcessedState, RawArticle, Secrets } from './types.js';

interface PipelineConfig {
  readonly secrets: Secrets;
  readonly s3Bucket: string;
  readonly s3StateKey: string;
  readonly s3ArticlesPrefix: string;
  readonly awsRegion: string;
  readonly slackChannelId: string;
  readonly notionDatabaseId: string;
  readonly gmailTo: string;
  readonly dryRun: boolean;
  readonly skipSlack: boolean;
  readonly skipEmail: boolean;
  readonly skipNotion: boolean;
}

const AI_CONCURRENCY = 5;
const NOTION_CONCURRENCY = 3;
const STATE_RETENTION_DAYS = 90;

// --- Shared distribution logic (DRY) ---

async function distributeArticles(
  articles: ProcessedArticle[],
  config: PipelineConfig,
  today: string,
  errors: string[],
  state: ProcessedState,
): Promise<{
  updatedArticles: ProcessedArticle[];
  notionCreated: number;
  notionFailed: number;
  emailDraftCreated: boolean;
  slackPosted: boolean;
}> {
  const updatedArticles = [...articles];

  if (config.dryRun) {
    console.log('[DRY RUN] Skipping Notion, email, and Slack distribution.');
    return { updatedArticles, notionCreated: 0, notionFailed: 0, emailDraftCreated: false, slackPosted: false };
  }

  // Notion — parallel with concurrency limit
  let notionCreated = 0;
  let notionFailed = 0;
  if (config.skipNotion) {
    console.log('[SKIP] Notion distribution disabled.');
  } else {
    console.log('Creating Notion pages...');
    for (let i = 0; i < updatedArticles.length; i += NOTION_CONCURRENCY) {
      const batch = updatedArticles.slice(i, i + NOTION_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((article) => {
          if (article.notionPageId) return Promise.resolve({ success: true as const, pageId: article.notionPageId });
          return createNotionPage(article, config.notionDatabaseId, config.secrets.notionToken);
        }),
      );
      for (let j = 0; j < results.length; j++) {
        const result = results[j]!;
        const idx = i + j;
        const article = updatedArticles[idx]!;
        if (result.status === 'fulfilled' && result.value.success && result.value.pageId) {
          if (!article.notionPageId) {
            updatedArticles[idx] = { ...article, notionPageId: result.value.pageId, status: 'notion-created' };
          }
          notionCreated++;
        } else {
          notionFailed++;
          const error = result.status === 'rejected'
            ? (result.reason instanceof Error ? result.reason.message : 'unknown')
            : (result.value.success ? '' : result.value.error ?? 'unknown');
          if (error) errors.push(`Notion failed for "${article.title}": ${error}`);
        }
      }
    }
  }

  // Email
  let emailDraftCreated = false;
  if (config.skipEmail) {
    console.log('[SKIP] Email distribution disabled.');
  } else {
    console.log('Creating Gmail draft...');
    try {
      const html = buildEmailHtml(updatedArticles, today);
      const emailResult = await createGmailDraft(html, config.gmailTo, today, config.secrets.gmail);
      emailDraftCreated = emailResult.success;
      if (!emailResult.success) errors.push(`Gmail: ${emailResult.error}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'unknown';
      errors.push(`Gmail draft failed: ${msg}`);
    }
  }

  // Slack
  let slackPosted = false;
  if (config.skipSlack) {
    console.log('[SKIP] Slack distribution disabled.');
  } else if (state.slackPostedAt.startsWith(today)) {
    console.log('Slack digest already posted today — skipping.');
    slackPosted = true;
  } else {
    console.log('Posting Slack digest...');
    try {
      const slackResult = await postSlackDigest(updatedArticles, config.secrets.slackToken, config.slackChannelId, today);
      slackPosted = slackResult.success;
      if (!slackResult.success) errors.push(`Slack: ${slackResult.error}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'unknown';
      errors.push(`Slack post failed: ${msg}`);
    }
  }

  return { updatedArticles, notionCreated, notionFailed, emailDraftCreated, slackPosted };
}

function pruneOldArticles(articles: readonly ProcessedArticle[]): ProcessedArticle[] {
  const cutoff = Date.now() - STATE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return articles.filter((a) => new Date(a.processedAt).getTime() >= cutoff) as ProcessedArticle[];
}

async function saveStateSafely(
  store: S3Store,
  key: string,
  state: ProcessedState,
  errors: string[],
): Promise<void> {
  try {
    await store.saveState(key, state);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    errors.push(`CRITICAL: S3 state save failed — next run may produce duplicates: ${msg}`);
    console.error(errors[errors.length - 1]);
  }
}

function logSummary(result: PipelineResult, isRerun: boolean): void {
  const label = isRerun ? 'Pipeline Summary (re-run)' : 'Pipeline Summary';
  console.log(`\n--- ${label} ---`);
  console.log(`Articles: ${result.articlesScraped}`);
  if (!isRerun) {
    console.log(`Deduped: ${result.deduped} removed`);
    console.log(`Claude: ${result.claudeProcessed} processed, ${result.claudeFallbacks} fallbacks`);
  }
  console.log(`Notion: ${result.notionCreated} created, ${result.notionFailed} failed`);
  console.log(`Email draft: ${result.emailDraftCreated ? 'created' : 'failed'}`);
  console.log(`Slack: ${result.slackPosted ? 'posted' : 'failed'}`);
  if (result.errors.length > 0) {
    console.log(`Errors: ${result.errors.length}`);
    for (const e of result.errors) console.error(`  - ${e}`);
  }
}

// --- Main pipeline ---

export async function runPipeline(config: PipelineConfig): Promise<PipelineResult> {
  const today = new Date().toISOString().slice(0, 10);
  const errors: string[] = [];
  const store = new S3Store(config.s3Bucket, config.awsRegion);

  // Step 1: Load state
  console.log('Step 1: Loading state from S3...');
  const state = await store.loadState(config.s3StateKey);
  const processedUrls = new Set(state.processedArticles.map((a) => a.url));

  // Check if articles were already extracted today — skip to distribution
  const todayArticles = state.processedArticles.filter(
    (a): a is ProcessedArticle => a.processedAt.startsWith(today),
  );
  if (todayArticles.length > 0) {
    console.log(`Found ${todayArticles.length} articles already extracted today. Skipping scraping.`);

    const dist = await distributeArticles(todayArticles, config, today, errors, state);

    // Merge updated articles back into state
    const urlMap = new Map(dist.updatedArticles.map((a) => [a.url, a]));
    const mergedArticles = state.processedArticles.map((a) => urlMap.get(a.url) ?? a);

    await saveStateSafely(store, config.s3StateKey, {
      processedArticles: pruneOldArticles(mergedArticles),
      themeLastProcessed: state.themeLastProcessed,
      slackPostedAt: dist.slackPosted ? new Date().toISOString() : state.slackPostedAt,
    }, errors);

    const articlesBySource: Record<string, number> = {};
    for (const a of todayArticles) {
      articlesBySource[a.source] = (articlesBySource[a.source] ?? 0) + 1;
    }

    const result: PipelineResult = {
      steps: [], articlesScraped: todayArticles.length, articlesBySource,
      deduped: 0, claudeProcessed: 0, claudeFallbacks: 0,
      notionCreated: dist.notionCreated, notionFailed: dist.notionFailed,
      emailDraftCreated: dist.emailDraftCreated, slackPosted: dist.slackPosted, errors,
    };
    logSummary(result, true);
    return result;
  }

  // Step 2: Determine eligible themes
  console.log('Step 2: Determining eligible themes...');
  const eligibleThemes = getEligibleThemes(THEMES, state.themeLastProcessed, today);
  console.log(`Eligible themes: ${eligibleThemes.map((t) => t.name).join(', ')}`);

  if (eligibleThemes.length === 0) {
    console.log('No eligible themes today.');
    return {
      steps: [], articlesScraped: 0, articlesBySource: {}, deduped: 0,
      claudeProcessed: 0, claudeFallbacks: 0, notionCreated: 0, notionFailed: 0,
      emailDraftCreated: false, slackPosted: false, errors: [],
    };
  }

  // Step 3: Scrape Carbon Pulse
  console.log('Step 3: Scraping Carbon Pulse...');
  let cpArticles: RawArticle[] = [];
  try {
    cpArticles = await scrapeCarbonPulse(eligibleThemes, processedUrls, config.secrets.carbonPulse, config.secrets.proxy);
    console.log(`Carbon Pulse: ${cpArticles.length} articles`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    errors.push(`Carbon Pulse scraping failed: ${msg}`);
    console.error(errors[errors.length - 1]);
  }

  // Step 4: Scrape ESG News
  console.log('Step 4: Scraping ESG News...');
  let esgArticles: RawArticle[] = [];
  try {
    const cpTitles = cpArticles.map((a) => a.title);
    esgArticles = await scrapeEsgNews(eligibleThemes, processedUrls, cpTitles);
    console.log(`ESG News: ${esgArticles.length} articles`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    errors.push(`ESG News scraping failed: ${msg}`);
    console.error(errors[errors.length - 1]);
  }

  // Step 5: Scrape Trellis
  console.log('Step 5: Scraping Trellis...');
  let trellisArticles: RawArticle[] = [];
  try {
    trellisArticles = await scrapeTrellis(eligibleThemes, processedUrls, config.secrets.anthropicApiKey);
    console.log(`Trellis: ${trellisArticles.length} articles`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    errors.push(`Trellis scraping failed: ${msg}`);
    console.error(errors[errors.length - 1]);
  }

  const allRaw = [...cpArticles, ...esgArticles, ...trellisArticles];

  if (allRaw.length === 0) {
    console.log('No articles scraped.');
    return {
      steps: [], articlesScraped: 0, articlesBySource: { 'carbon-pulse': 0, esgnews: 0, trellis: 0 },
      deduped: 0, claudeProcessed: 0, claudeFallbacks: 0, notionCreated: 0, notionFailed: 0,
      emailDraftCreated: false, slackPosted: false, errors,
    };
  }

  // Step 6: Dedup
  console.log('Step 6: Cross-source dedup...');
  const { kept, removed } = deduplicateArticles(allRaw);
  console.log(`Kept: ${kept.length}, Removed: ${removed.length}`);

  // Step 7: Claude API — parallel with concurrency limit
  console.log('Step 7: Processing articles with Claude API...');
  const processedArticles: ProcessedArticle[] = [];
  let claudeProcessed = 0;
  let claudeFallbacks = 0;

  for (let i = 0; i < kept.length; i += AI_CONCURRENCY) {
    const batch = kept.slice(i, i + AI_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((raw) => processArticle(raw, config.secrets.anthropicApiKey)),
    );

    for (let j = 0; j < results.length; j++) {
      const raw = batch[j]!;
      const result = results[j]!;
      const aiResult = result.status === 'fulfilled'
        ? result.value
        : { summary: raw.fullContent.slice(0, 500), keyPoints: [] as string[], segment: '', isFallback: true };

      claudeProcessed++;
      if (aiResult.isFallback) claudeFallbacks++;

      const filename = `${today}-${slugify(raw.title)}.md`;
      processedArticles.push({
        ...raw,
        summary: aiResult.summary,
        keyPoints: [...aiResult.keyPoints],
        segment: aiResult.segment,
        markdownFile: filename,
        notionPageId: null,
        processedAt: new Date().toISOString(),
        status: 'markdown-only',
      });
    }
  }

  // Step 8: Save articles to S3 — parallel, individual failures don't crash pipeline
  console.log('Step 8: Saving articles to S3...');
  const saveResults = await Promise.allSettled(
    processedArticles.map((article) => {
      const markdown = buildArticleMarkdown(article);
      return store.saveArticle(config.s3ArticlesPrefix, article.markdownFile, markdown);
    }),
  );
  for (let i = 0; i < saveResults.length; i++) {
    const result = saveResults[i]!;
    if (result.status === 'rejected') {
      const msg = result.reason instanceof Error ? result.reason.message : 'unknown';
      errors.push(`S3 save failed for "${processedArticles[i]!.title}": ${msg}`);
    }
  }

  // Steps 9-11: Distribute
  const dist = await distributeArticles(processedArticles, config, today, errors, state);

  // Step 12: Save final state — protected with error handling
  console.log('Step 12: Saving final state to S3...');
  const updatedThemes = { ...state.themeLastProcessed };
  for (const theme of eligibleThemes) {
    updatedThemes[theme.name] = today;
  }

  await saveStateSafely(store, config.s3StateKey, {
    processedArticles: pruneOldArticles([...state.processedArticles, ...dist.updatedArticles]),
    themeLastProcessed: updatedThemes,
    slackPostedAt: dist.slackPosted ? new Date().toISOString() : state.slackPostedAt,
  }, errors);

  // Summary
  const articlesBySource: Record<string, number> = {};
  for (const a of kept) {
    articlesBySource[a.source] = (articlesBySource[a.source] ?? 0) + 1;
  }

  const result: PipelineResult = {
    steps: [], articlesScraped: kept.length, articlesBySource,
    deduped: removed.length, claudeProcessed, claudeFallbacks,
    notionCreated: dist.notionCreated, notionFailed: dist.notionFailed,
    emailDraftCreated: dist.emailDraftCreated, slackPosted: dist.slackPosted, errors,
  };
  logSummary(result, false);
  return result;
}
