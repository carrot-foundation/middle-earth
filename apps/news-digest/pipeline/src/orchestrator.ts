import { S3Store } from './state/s3-store.js';
import { getEligibleThemes } from './helpers/theme.helpers.js';
import { deduplicateArticles } from './helpers/dedup.helpers.js';
import { buildArticleMarkdown, slugify } from './helpers/markdown.helpers.js';
import { scrapeCarbonPulse } from './scraper/carbon-pulse.js';
import { scrapeEsgNews } from './scraper/esg-news.js';
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
}

async function distributeExistingArticles(
  articles: ProcessedArticle[],
  config: PipelineConfig,
  today: string,
  errors: string[],
  store: S3Store,
  state: ProcessedState,
): Promise<PipelineResult> {
  const updatedArticles = [...articles];

  // Retry Notion for articles that don't have a notionPageId yet
  console.log('Step 8 (retry): Creating Notion pages for pending articles...');
  let notionCreated = 0;
  let notionFailed = 0;
  for (let i = 0; i < updatedArticles.length; i++) {
    const article = updatedArticles[i]!;
    if (article.notionPageId) {
      notionCreated++;
      continue;
    }
    const result = await createNotionPage(article, config.notionDatabaseId, config.secrets.notionToken);
    if (result.success && result.pageId) {
      updatedArticles[i] = { ...article, notionPageId: result.pageId, status: 'notion-created' };
      notionCreated++;
    } else {
      notionFailed++;
      if (result.error) errors.push(`Notion failed for "${article.title}": ${result.error}`);
    }
  }

  // Email
  console.log('Step 9 (retry): Creating Gmail draft...');
  let emailDraftCreated = false;
  try {
    const html = buildEmailHtml(updatedArticles, today);
    const emailResult = await createGmailDraft(html, config.gmailTo, today, config.secrets.gmail);
    emailDraftCreated = emailResult.success;
    if (!emailResult.success) errors.push(`Gmail: ${emailResult.error}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    errors.push(`Gmail draft failed: ${msg}`);
  }

  // Slack — skip if already posted today
  let slackPosted = false;
  if (state.slackPostedAt.startsWith(today)) {
    console.log('Step 10 (skip): Slack digest already posted today.');
    slackPosted = true;
  } else {
    console.log('Step 10 (retry): Posting Slack digest...');
    const slackResult = await postSlackDigest(updatedArticles, config.secrets.slackToken, config.slackChannelId, today);
    slackPosted = slackResult.success;
    if (!slackResult.success) errors.push(`Slack: ${slackResult.error}`);
  }

  // Update state with any Notion changes
  console.log('Step 11 (retry): Saving updated state to S3...');
  const updatedAllArticles = state.processedArticles.map((a) => {
    const updated = updatedArticles.find((u) => u.url === a.url);
    return updated ?? a;
  });
  await store.saveState(config.s3StateKey, {
    processedArticles: updatedAllArticles,
    themeLastProcessed: state.themeLastProcessed,
    slackPostedAt: slackPosted ? new Date().toISOString() : state.slackPostedAt,
  });

  const articlesBySource: Record<string, number> = {};
  for (const a of articles) {
    articlesBySource[a.source] = (articlesBySource[a.source] ?? 0) + 1;
  }

  const result: PipelineResult = {
    steps: [], articlesScraped: articles.length, articlesBySource,
    deduped: 0, claudeProcessed: 0, notionCreated, notionFailed,
    emailDraftCreated, slackPosted, errors,
  };

  console.log('\n--- Pipeline Summary (re-run) ---');
  console.log(`Existing articles: ${articles.length}`);
  console.log(`Notion: ${notionCreated} created, ${notionFailed} failed`);
  console.log(`Email draft: ${emailDraftCreated ? 'created' : 'failed'}`);
  console.log(`Slack: ${slackPosted ? 'posted' : 'failed'}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    for (const e of errors) console.error(`  - ${e}`);
  }

  return result;
}

export async function runPipeline(config: PipelineConfig): Promise<PipelineResult> {
  const today = new Date().toISOString().slice(0, 10);
  const errors: string[] = [];
  const store = new S3Store(config.s3Bucket, config.awsRegion);

  // Step 1: Load state
  console.log('Step 1: Loading state from S3...');
  const state = await store.loadState(config.s3StateKey);
  const processedUrls = new Set(state.processedArticles.map((a) => a.url));

  // Check if articles were already extracted today
  const todayArticles = state.processedArticles.filter((a) => a.processedAt.startsWith(today));
  if (todayArticles.length > 0) {
    console.log(`Found ${todayArticles.length} articles already extracted today. Skipping scraping, re-running distribution.`);
    return await distributeExistingArticles(todayArticles as ProcessedArticle[], config, today, errors, store, state);
  }

  // Step 2: Determine eligible themes
  console.log('Step 2: Determining eligible themes...');
  const eligibleThemes = getEligibleThemes(THEMES, state.themeLastProcessed, today);
  console.log(`Eligible themes: ${eligibleThemes.map((t) => t.name).join(', ')}`);

  if (eligibleThemes.length === 0) {
    console.log('No eligible themes today. Posting empty digest.');
    const slackResult = await postSlackDigest([], config.secrets.slackToken, config.slackChannelId, today);
    return {
      steps: [], articlesScraped: 0, articlesBySource: {}, deduped: 0,
      claudeProcessed: 0, notionCreated: 0, notionFailed: 0,
      emailDraftCreated: false, slackPosted: slackResult.success,
      errors: slackResult.success ? [] : [`Slack: ${slackResult.error}`],
    };
  }

  // Step 3: Scrape Carbon Pulse
  console.log('Step 3: Scraping Carbon Pulse...');
  let cpArticles: RawArticle[] = [];
  try {
    cpArticles = await scrapeCarbonPulse(eligibleThemes, processedUrls, config.secrets.carbonPulse);
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

  const allRaw = [...cpArticles, ...esgArticles];

  if (allRaw.length === 0) {
    console.log('No articles scraped. Posting empty digest.');
    const slackResult = await postSlackDigest([], config.secrets.slackToken, config.slackChannelId, today);
    return {
      steps: [], articlesScraped: 0, articlesBySource: { 'carbon-pulse': 0, esgnews: 0 },
      deduped: 0, claudeProcessed: 0, notionCreated: 0, notionFailed: 0,
      emailDraftCreated: false, slackPosted: slackResult.success, errors,
    };
  }

  // Step 5: Dedup
  console.log('Step 5: Cross-source dedup...');
  const { kept, removed } = deduplicateArticles(allRaw);
  console.log(`Kept: ${kept.length}, Removed: ${removed.length}`);

  // Step 6: Claude API processing
  console.log('Step 6: Processing articles with Claude API...');
  const processedArticles: ProcessedArticle[] = [];
  let claudeProcessed = 0;

  for (const raw of kept) {
    const aiResult = await processArticle(raw, config.secrets.anthropicApiKey);
    claudeProcessed++;

    const filename = `${today}-${slugify(raw.title)}.md`;
    const processed: ProcessedArticle = {
      ...raw,
      summary: aiResult.summary,
      keyPoints: [...aiResult.keyPoints],
      segment: aiResult.segment,
      markdownFile: filename,
      notionPageId: null,
      processedAt: new Date().toISOString(),
      status: 'markdown-only',
    };
    processedArticles.push(processed);
  }

  // Step 7: Save articles to S3
  console.log('Step 7: Saving articles to S3...');
  for (const article of processedArticles) {
    const markdown = buildArticleMarkdown(article);
    await store.saveArticle(config.s3ArticlesPrefix, article.markdownFile, markdown);
  }

  // Step 8: Create Notion pages
  console.log('Step 8: Creating Notion pages...');
  let notionCreated = 0;
  let notionFailed = 0;
  const updatedArticles = [...processedArticles];

  for (let i = 0; i < updatedArticles.length; i++) {
    const article = updatedArticles[i]!;
    const result = await createNotionPage(article, config.notionDatabaseId, config.secrets.notionToken);
    if (result.success && result.pageId) {
      updatedArticles[i] = { ...article, notionPageId: result.pageId, status: 'notion-created' };
      notionCreated++;
    } else {
      notionFailed++;
      if (result.error) errors.push(`Notion failed for "${article.title}": ${result.error}`);
    }
  }

  // Step 9: Email
  console.log('Step 9: Creating Gmail draft...');
  let emailDraftCreated = false;
  try {
    const html = buildEmailHtml(updatedArticles, today);
    const emailResult = await createGmailDraft(html, config.gmailTo, today, config.secrets.gmail);
    emailDraftCreated = emailResult.success;
    if (!emailResult.success) errors.push(`Gmail: ${emailResult.error}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    errors.push(`Gmail draft failed: ${msg}`);
  }

  // Step 10: Slack
  let slackPosted = false;
  if (state.slackPostedAt.startsWith(today)) {
    console.log('Step 10 (skip): Slack digest already posted today.');
    slackPosted = true;
  } else {
    console.log('Step 10: Posting Slack digest...');
    const slackResult = await postSlackDigest(
      updatedArticles, config.secrets.slackToken, config.slackChannelId, today,
    );
    slackPosted = slackResult.success;
    if (!slackResult.success) errors.push(`Slack: ${slackResult.error}`);
  }

  // Step 11: Save final state
  console.log('Step 11: Saving final state to S3...');
  const updatedThemes = { ...state.themeLastProcessed };
  for (const theme of eligibleThemes) {
    updatedThemes[theme.name] = today;
  }

  await store.saveState(config.s3StateKey, {
    processedArticles: [...state.processedArticles, ...updatedArticles],
    themeLastProcessed: updatedThemes,
    slackPostedAt: slackPosted ? new Date().toISOString() : state.slackPostedAt,
  });

  // Summary
  const articlesBySource: Record<string, number> = {};
  for (const a of kept) {
    articlesBySource[a.source] = (articlesBySource[a.source] ?? 0) + 1;
  }

  const result: PipelineResult = {
    steps: [], articlesScraped: kept.length, articlesBySource,
    deduped: removed.length, claudeProcessed, notionCreated, notionFailed,
    emailDraftCreated, slackPosted, errors,
  };

  console.log('\n--- Pipeline Summary ---');
  console.log(`Scraped: ${result.articlesScraped} (CP: ${articlesBySource['carbon-pulse'] ?? 0}, ESG: ${articlesBySource['esgnews'] ?? 0})`);
  console.log(`Deduped: ${result.deduped} removed`);
  console.log(`Claude processed: ${result.claudeProcessed}`);
  console.log(`Notion: ${result.notionCreated} created, ${result.notionFailed} failed`);
  console.log(`Email draft: ${result.emailDraftCreated ? 'created' : 'failed'}`);
  console.log(`Slack: ${result.slackPosted ? 'posted' : 'failed'}`);
  if (result.errors.length > 0) {
    console.log(`Errors: ${result.errors.length}`);
    for (const e of result.errors) console.error(`  - ${e}`);
  }

  return result;
}
