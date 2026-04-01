import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGmailDraft } from '../email.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('createGmailDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a draft via Gmail API', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'fresh-token' }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'draft-123' }) });
    // cspell:disable-next-line
    const result = await createGmailDraft('<html>Digest</html>', 'test@test.com', '2026-03-27', { clientId: 'cid', clientSecret: 'csecret', refreshToken: 'rtoken' });
    expect(result.success).toBe(true);
    expect(result.draftId).toBe('draft-123');
  });

  it('returns failure when token refresh fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve('invalid_grant') });
    // cspell:disable-next-line
    const result = await createGmailDraft('<html>Digest</html>', 'test@test.com', '2026-03-27', { clientId: 'cid', clientSecret: 'csecret', refreshToken: 'rtoken' });
    expect(result.success).toBe(false);
  });
});
