import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { processedStateSchema } from '../config.schema.js';
import type { ProcessedState } from '../types.js';

const EMPTY_STATE: ProcessedState = {
  processedArticles: [],
  themeLastProcessed: {},
  slackPostedAt: '',
};

export class S3Store {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
  ) {
    this.client = new S3Client({ region });
  }

  async loadState(key: string): Promise<ProcessedState> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const body = await response.Body?.transformToString();
      if (!body) return EMPTY_STATE;

      const parsed = JSON.parse(body) as unknown;
      return processedStateSchema.parse(parsed);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return EMPTY_STATE;
      }
      throw error;
    }
  }

  async saveState(key: string, state: ProcessedState): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(state, null, 2),
        ContentType: 'application/json',
      }),
    );
  }

  async saveArticle(prefix: string, filename: string, content: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `${prefix}${filename}`,
        Body: content,
        ContentType: 'text/markdown',
      }),
    );
  }
}
