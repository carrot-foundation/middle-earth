import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { envSchema, carbonPulseSecretSchema, gmailSecretSchema, proxySecretSchema } from './config.schema.js';
import { runPipeline } from './orchestrator.js';
import type { Secrets } from './types.js';

async function getSecret(client: SecretsManagerClient, arn: string): Promise<string> {
  const response = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!response.SecretString) throw new Error(`Secret ${arn} has no value`);
  return response.SecretString;
}

async function loadSecrets(
  client: SecretsManagerClient,
  env: ReturnType<typeof envSchema.parse>,
): Promise<Secrets> {
  const [cpRaw, slackToken, apiKey, notionToken, gmailRaw, proxyRaw] = await Promise.all([
    getSecret(client, env.CARBON_PULSE_SECRET_ARN),
    getSecret(client, env.SLACK_TOKEN_SECRET_ARN),
    getSecret(client, env.ANTHROPIC_API_KEY_SECRET_ARN),
    getSecret(client, env.NOTION_TOKEN_SECRET_ARN),
    getSecret(client, env.GMAIL_SECRET_ARN),
    getSecret(client, env.PROXY_SECRET_ARN),
  ]);

  const cpParsed = carbonPulseSecretSchema.parse(JSON.parse(cpRaw));
  const gmailParsed = gmailSecretSchema.parse(JSON.parse(gmailRaw));
  const proxyParsed = proxySecretSchema.parse(JSON.parse(proxyRaw));

  return {
    carbonPulse: cpParsed,
    proxy: proxyParsed,
    slackToken,
    anthropicApiKey: apiKey,
    notionToken,
    gmail: {
      clientId: gmailParsed.client_id,
      clientSecret: gmailParsed.client_secret,
      refreshToken: gmailParsed.refresh_token,
    },
  };
}

async function main(): Promise<void> {
  console.log('news-digest-pipeline: starting...');
  const startTime = Date.now();

  const env = envSchema.parse(process.env);
  const smClient = new SecretsManagerClient({ region: env.AWS_REGION });
  const secrets = await loadSecrets(smClient, env);

  const dryRun = env.DRY_RUN === 'true';
  const skipSlack = env.SKIP_SLACK === 'true';
  const skipEmail = env.SKIP_EMAIL === 'true';
  const skipNotion = env.SKIP_NOTION === 'true';

  if (dryRun) console.log('[DRY RUN] Distribution (Notion, email, Slack) disabled.');
  if (skipSlack) console.log('[CONFIG] Slack distribution disabled via SKIP_SLACK.');
  if (skipEmail) console.log('[CONFIG] Email distribution disabled via SKIP_EMAIL.');
  if (skipNotion) console.log('[CONFIG] Notion distribution disabled via SKIP_NOTION.');

  const result = await runPipeline({
    secrets,
    s3Bucket: env.S3_BUCKET,
    s3StateKey: env.S3_STATE_KEY,
    s3ArticlesPrefix: env.S3_ARTICLES_PREFIX,
    awsRegion: env.AWS_REGION,
    slackChannelId: env.SLACK_CHANNEL_ID,
    notionDatabaseId: env.NOTION_DATABASE_ID,
    gmailTo: env.GMAIL_TO,
    dryRun,
    skipSlack,
    skipEmail,
    skipNotion,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nPipeline completed in ${duration}s`);

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('Pipeline crashed:', error);
  process.exitCode = 1;
});
