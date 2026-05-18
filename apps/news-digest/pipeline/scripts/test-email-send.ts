/**
 * Manual smoke test for the auto-send change (BMAD story 1.1).
 *
 * Sends ONE real digest email — using the production Gmail credentials from
 * Secrets Manager and the new `sendGmailMessage` code path — to the
 * authenticated account's OWN address (fetched via users/me/profile), NOT to
 * the production distribution (`market-intelligence@carrot.eco`). It does not
 * scrape, touch Notion/Slack, or read/write S3 state.
 *
 * Run (from apps/news-digest/pipeline):
 *   npx esbuild scripts/test-email-send.ts --bundle --platform=node \
 *     --target=node22 --outfile=dist/scripts/test-email-send.mjs \
 *     --format=esm --external:@aws-sdk/* \
 *   && node dist/scripts/test-email-send.mjs
 *
 * Optional: TEST_EMAIL_TO=<addr> overrides the recipient (still never the prod list).
 */
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { gmailSecretSchema } from '../src/config.schema.js';
import { sendGmailMessage } from '../src/distribution/email.js';
import { buildEmailHtml } from '../src/distribution/email-template.helpers.js';
import type { ProcessedArticle } from '../src/types.js';

const SECRET_ID = process.env.GMAIL_SECRET_ID ?? 'news-digest/gmail-credentials';
const REGION = process.env.AWS_REGION ?? 'us-east-1';
const PROD_LIST = 'market-intelligence@carrot.eco';

function syntheticArticles(today: string): ProcessedArticle[] {
  const base = {
    categories: '',
    location: '',
    fullContent: '',
    notionPageId: null,
    processedAt: `${today}T09:00:00.000Z`,
    status: 'markdown-only' as const,
  };
  return [
    {
      ...base,
      source: 'carbon-pulse',
      url: 'https://example.com/test-article-one',
      title: 'Sample headline one for the auto-send smoke test',
      date: today,
      author: 'Test Desk',
      mainTheme: 'Carbon Markets',
      summary: 'This is synthetic summary text used only to validate that the digest email renders and is delivered through the automatic send path.',
      keyPoints: ['First synthetic key point', 'Second synthetic key point'],
      segment: 'Policy & Regulation',
      markdownFile: `${today}-sample-one.md`,
    },
    {
      ...base,
      source: 'esgnews',
      url: 'https://example.com/test-article-two',
      title: 'Sample headline two for the auto-send smoke test',
      date: today,
      author: 'Test Desk',
      mainTheme: 'Circular Economy',
      summary: 'Second synthetic article. No real data, no PII — purely a delivery and rendering check for the test recipient.',
      keyPoints: [],
      segment: '',
      markdownFile: `${today}-sample-two.md`,
    },
  ];
}

async function resolveOwnEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`getProfile failed (HTTP ${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { emailAddress: string };
  return data.emailAddress;
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });
  if (!response.ok) {
    throw new Error(`Token refresh failed (HTTP ${response.status}): ${await response.text()}`);
  }
  return ((await response.json()) as { access_token: string }).access_token;
}

/**
 * Returns the recipient as a single normalized bare email address, or throws.
 * Rejects comma-separated lists, display names ("Name <addr>"), surrounding or
 * embedded whitespace, casing variants of the prod list, and anything that is
 * not exactly one address — so the prod list cannot slip through `to`.
 */
function safeTestRecipient(rawValue: string): string {
  const collapsed = rawValue.trim().replace(/\s+/g, ' ');

  if (collapsed.includes(',')) {
    throw new Error(`Test recipient must be a single address, got a list: "${rawValue}".`);
  }
  if (/[<>]/.test(collapsed) || collapsed.includes(' ')) {
    throw new Error(`Test recipient must be a bare email address (no display name): "${rawValue}".`);
  }

  const address = collapsed.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    throw new Error(`Test recipient is not a valid email address: "${rawValue}".`);
  }
  if (address === PROD_LIST.toLowerCase()) {
    throw new Error(`Refusing to send the smoke test to the production list (${PROD_LIST}).`);
  }
  return address;
}

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const client = new SecretsManagerClient({ region: REGION });
  const raw = await client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  if (!raw.SecretString) throw new Error(`Secret ${SECRET_ID} has no value`);
  const parsed = gmailSecretSchema.parse(JSON.parse(raw.SecretString));
  const credentials = {
    clientId: parsed.client_id,
    clientSecret: parsed.client_secret,
    refreshToken: parsed.refresh_token,
  };

  const accessToken = await refreshAccessToken(credentials.clientId, credentials.clientSecret, credentials.refreshToken);
  const ownEmail = await resolveOwnEmail(accessToken);
  const to = safeTestRecipient(process.env.TEST_EMAIL_TO ?? ownEmail);

  const html = buildEmailHtml(syntheticArticles(today), today);

  console.log(`Authenticated account: ${ownEmail}`);
  console.log(`Sending smoke-test digest to: ${to}`);

  const result = await sendGmailMessage(html, to, today, credentials);

  if (result.success) {
    console.log(`✅ SENT — messageId=${result.messageId}, recipient=${to}`);
  } else {
    console.error(`❌ FAILED — ${result.error}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`❌ ERROR — ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
