import { z } from 'zod';

export const carbonPulseSecretSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const proxySecretSchema = z.object({
  server: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const gmailSecretSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  refresh_token: z.string().min(1),
});

export const envSchema = z.object({
  S3_BUCKET: z.string().min(1),
  S3_STATE_KEY: z.string().default('processed-articles.json'),
  S3_ARTICLES_PREFIX: z.string().default('articles/'),
  AWS_REGION: z.string().default('us-east-1'),
  CARBON_PULSE_SECRET_ARN: z.string().min(1),
  SLACK_TOKEN_SECRET_ARN: z.string().min(1),
  ANTHROPIC_API_KEY_SECRET_ARN: z.string().min(1),
  NOTION_TOKEN_SECRET_ARN: z.string().min(1),
  GMAIL_SECRET_ARN: z.string().min(1),
  PROXY_SECRET_ARN: z.string().min(1),
  SLACK_CHANNEL_ID: z.string().default('C0ADBQGHMDH'),
  NOTION_DATABASE_ID: z.string().default('2a09703d-8e9c-8193-b638-f7bb6b1c7cd8'),
  GMAIL_TO: z.string().default('market-intelligence@carrot.eco'),
  DRY_RUN: z.string().default('false'),
});

export type Env = z.infer<typeof envSchema>;

export const processedStateSchema = z.object({
  processedArticles: z.array(z.object({
    source: z.enum(['carbon-pulse', 'esgnews']).default('carbon-pulse'),
    url: z.string().url(),
    title: z.string(),
    date: z.string(),
    author: z.string(),
    mainTheme: z.string(),
    categories: z.string().optional().default(''),
    location: z.string().optional().default(''),
    summary: z.string().optional().default(''),
    keyPoints: z.array(z.string()).optional().default([]),
    segment: z.string().optional().default(''),
    fullContent: z.string().optional().default(''),
    markdownFile: z.string(),
    notionPageId: z.string().nullable(),
    processedAt: z.string(),
    status: z.enum(['markdown-only', 'notion-created']),
  })),
  themeLastProcessed: z.record(z.string(), z.string()),
  slackPostedAt: z.string().optional().default(''),
});
