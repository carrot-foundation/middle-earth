interface GmailCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

interface GmailDraftResult {
  readonly success: boolean;
  readonly draftId?: string;
  readonly error?: string;
}

async function refreshAccessToken(credentials: GmailCredentials): Promise<string> {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: credentials.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

function buildRawEmail(htmlBody: string, to: string, date: string): string {
  const subject = `Industry News Digest - ${date}`;
  const boundary = 'boundary_carrot_digest';

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createGmailDraft(
  htmlBody: string,
  to: string,
  date: string,
  credentials: GmailCredentials,
): Promise<GmailDraftResult> {
  let accessToken: string;

  try {
    accessToken = await refreshAccessToken(credentials);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }

  const raw = buildRawEmail(htmlBody, to, date);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `Gmail API error (HTTP ${response.status}): ${errorText}` };
  }

  const data = (await response.json()) as { id: string };
  return { success: true, draftId: data.id };
}
