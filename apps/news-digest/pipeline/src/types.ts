export interface RawArticle {
  readonly source: 'carbon-pulse' | 'esgnews';
  readonly url: string;
  readonly title: string;
  readonly date: string;
  readonly author: string;
  readonly mainTheme: string;
  readonly categories: string;
  readonly location: string;
  readonly fullContent: string;
}

export interface ProcessedArticle {
  readonly source: 'carbon-pulse' | 'esgnews';
  readonly url: string;
  readonly title: string;
  readonly date: string;
  readonly author: string;
  readonly mainTheme: string;
  readonly categories: string;
  readonly location: string;
  readonly summary: string;
  readonly keyPoints: readonly string[];
  readonly segment: string;
  readonly fullContent: string;
  readonly markdownFile: string;
  readonly notionPageId: string | null;
  readonly processedAt: string;
  readonly status: 'markdown-only' | 'notion-created';
}

export interface ProcessedState {
  readonly processedArticles: readonly ProcessedArticle[];
  readonly themeLastProcessed: Readonly<Record<string, string>>;
  readonly slackPostedAt: string;
}

export type ThemeFrequency = 'daily' | 'weekly' | 'monthly';

export interface ThemeConfig {
  readonly name: string;
  readonly frequency: ThemeFrequency;
  readonly carbonPulseSearchTerms: string;
  readonly esgNewsSearchTerms: string;
}

export type StepName =
  | 'load-state'
  | 'theme-selection'
  | 'scrape-carbon-pulse'
  | 'scrape-esg-news'
  | 'dedup'
  | 'ai-process'
  | 'save-articles'
  | 'notion'
  | 'email'
  | 'slack'
  | 'save-state';

export interface StepResult<T = unknown> {
  readonly step: StepName;
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

export interface PipelineResult {
  readonly steps: readonly StepResult[];
  readonly articlesScraped: number;
  readonly articlesBySource: Readonly<Record<string, number>>;
  readonly deduped: number;
  readonly claudeProcessed: number;
  readonly claudeFallbacks: number;
  readonly notionCreated: number;
  readonly notionFailed: number;
  readonly emailDraftCreated: boolean;
  readonly slackPosted: boolean;
  readonly errors: readonly string[];
}

export interface ProxyConfig {
  readonly server: string;
  readonly username: string;
  readonly password: string;
}

export interface Secrets {
  readonly carbonPulse: {
    readonly username: string;
    readonly password: string;
  };
  readonly proxy: ProxyConfig;
  readonly slackToken: string;
  readonly anthropicApiKey: string;
  readonly notionToken: string;
  readonly gmail: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly refreshToken: string;
  };
}
