import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3Store } from '../s3-store.js';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(function () { (this as { send: typeof mockSend }).send = mockSend; }),
  GetObjectCommand: vi.fn().mockImplementation(function (input: Record<string, unknown>) { Object.assign(this as object, input, { _type: 'GetObject' }); }),
  PutObjectCommand: vi.fn().mockImplementation(function (input: Record<string, unknown>) { Object.assign(this as object, input, { _type: 'PutObject' }); }),
}));

describe('S3Store', () => {
  let store: S3Store;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new S3Store('test-bucket', 'us-east-1');
  });

  it('loadState returns empty state when key does not exist', async () => {
    const error = new Error('NoSuchKey');
    error.name = 'NoSuchKey';
    mockSend.mockRejectedValueOnce(error);
    const state = await store.loadState('state.json');
    expect(state).toEqual({ processedArticles: [], themeLastProcessed: {}, slackPostedAt: '' });
  });

  it('loadState parses and returns existing state', async () => {
    const existingState = {
      processedArticles: [{
        source: 'carbon-pulse',
        url: 'https://example.com',
        title: 'Test',
        date: '2026-03-27',
        author: 'Author',
        mainTheme: 'Carbon Markets',
        categories: '',
        location: '',
        summary: 'Summary',
        keyPoints: [],
        segment: 'Policy & Regulation',
        fullContent: '',
        markdownFile: 'test.md',
        notionPageId: null,
        processedAt: '2026-03-27T10:00:00Z',
        status: 'markdown-only',
      }],
      themeLastProcessed: { 'Carbon Markets': '2026-03-20' },
    };
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: () => Promise.resolve(JSON.stringify(existingState)) },
    });
    const state = await store.loadState('state.json');
    expect(state.themeLastProcessed['Carbon Markets']).toBe('2026-03-20');
  });

  it('loadState accepts Trellis-sourced articles in existing state', async () => {
    const existingState = {
      processedArticles: [{
        source: 'trellis',
        url: 'https://trellis.net/article/sample/',
        title: 'Trellis Sample',
        date: '2026-04-15',
        author: 'Trellis',
        mainTheme: 'Carbon Markets',
        categories: '',
        location: '',
        summary: 'Summary',
        keyPoints: [],
        segment: 'Policy & Regulation',
        fullContent: '',
        markdownFile: 'sample.md',
        notionPageId: null,
        processedAt: '2026-04-15T10:00:00Z',
        status: 'markdown-only',
      }],
      themeLastProcessed: {},
    };
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: () => Promise.resolve(JSON.stringify(existingState)) },
    });
    const state = await store.loadState('state.json');
    expect(state.processedArticles).toHaveLength(1);
    expect(state.processedArticles[0]?.source).toBe('trellis');
  });

  it('saveState uploads JSON to S3', async () => {
    mockSend.mockResolvedValueOnce({});
    const state = { processedArticles: [], themeLastProcessed: {}, slackPostedAt: '' };
    await store.saveState('state.json', state);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it('saveArticle uploads markdown to S3', async () => {
    mockSend.mockResolvedValueOnce({});
    await store.saveArticle('articles/', 'test.md', '# Content');
    expect(mockSend).toHaveBeenCalledOnce();
  });
});
