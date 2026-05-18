import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendGmailMessage } from '../email.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const credentials = { clientId: 'client-id', clientSecret: 'client-secret', refreshToken: 'refresh-token' };

describe('sendGmailMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the email via the Gmail messages/send endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'fresh-token' }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'msg-123' }) });

    const result = await sendGmailMessage('<html>Digest</html>', 'test@test.com', '2026-03-27', credentials);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');

    const [url, init] = mockFetch.mock.calls[1]!;
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    const body = JSON.parse((init as { body: string }).body) as Record<string, unknown>;
    expect(body).toHaveProperty('raw');
    expect(body).not.toHaveProperty('message');
  });

  it('returns failure when token refresh fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve('invalid_grant') });

    const result = await sendGmailMessage('<html>Digest</html>', 'test@test.com', '2026-03-27', credentials);

    expect(result.success).toBe(false);
  });

  it('returns failure when the Gmail API rejects the send', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'fresh-token' }) });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: () => Promise.resolve('insufficient permission') });

    const result = await sendGmailMessage('<html>Digest</html>', 'test@test.com', '2026-03-27', credentials);

    expect(result.success).toBe(false);
    expect(result.error).toContain('403');
  });
});
