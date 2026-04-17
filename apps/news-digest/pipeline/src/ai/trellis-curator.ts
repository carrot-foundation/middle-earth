const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 512;
const MAX_PICKS = 2;
const FETCH_TIMEOUT_MS = 15_000;

export interface TrellisCandidate {
  readonly url: string;
  readonly title: string;
  readonly date: string;
  readonly excerpt: string;
}

export interface CuratedPick {
  readonly url: string;
  readonly mainTheme: string;
}

interface PickWithReason {
  readonly url: string;
  readonly mainTheme: string;
  readonly reason: string;
}

const SYSTEM_PROMPT =
  'You curate a daily sustainability and climate newsletter for the Carrot Foundation, ' +
  'a Web3 impact platform focused on decarbonization, methane reduction, circular economy, ' +
  'and tokenized environmental credits. Pick the 2 articles most valuable to a decarbonization ' +
  'and circularity audience. Prefer original reporting over opinion pieces. Prefer more recent ' +
  'articles when relevance is similar. Avoid picking two articles that cover the same story.';

function buildUserPrompt(candidates: readonly TrellisCandidate[], themeNames: readonly string[]): string {
  const payload = {
    candidates: candidates.map((c) => ({
      url: c.url, title: c.title, date: c.date, excerpt: c.excerpt,
    })),
    allowedThemes: themeNames,
  };
  return `${JSON.stringify(payload, null, 2)}

Return ONLY JSON with this shape, no markdown, no commentary:
{ "picks": [{ "url": "...", "mainTheme": "...", "reason": "..." }] }

- "url" must exactly match one of the candidate URLs.
- "mainTheme" must exactly match one of the allowed theme names.
- "reason" is a short rationale (<= 200 chars).
- Return at most 2 picks.`;
}

function parseClaudeText(rawText: string): unknown {
  const stripped = rawText.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

function validatePicks(
  raw: unknown,
  candidateUrls: ReadonlySet<string>,
  themeNames: ReadonlySet<string>,
): readonly CuratedPick[] {
  if (!raw || typeof raw !== 'object') return [];
  const picks = (raw as Record<string, unknown>)['picks'];
  if (!Array.isArray(picks)) return [];

  const validated: CuratedPick[] = [];
  for (const entry of picks) {
    if (!entry || typeof entry !== 'object') continue;
    const pick = entry as Record<string, unknown>;
    const url = pick['url'];
    const mainTheme = pick['mainTheme'];
    if (typeof url !== 'string' || typeof mainTheme !== 'string') continue;
    if (!candidateUrls.has(url) || !themeNames.has(mainTheme)) {
      console.warn(`[Trellis Curator] Dropped invalid pick: url=${url} mainTheme=${mainTheme}`);
      continue;
    }
    validated.push({ url, mainTheme });
    if (validated.length >= MAX_PICKS) break;
  }
  return validated;
}

function logPicks(
  picks: readonly CuratedPick[],
  rawPicks: readonly PickWithReason[],
  candidateCount: number,
): void {
  console.log(`[Trellis Curator] Candidates: ${candidateCount}, Picks accepted: ${picks.length}`);
  for (const pick of picks) {
    const match = rawPicks.find((p) => p.url === pick.url);
    const reason = match?.reason ?? '';
    console.log(`[Trellis Curator] Pick: ${pick.url} (theme: ${pick.mainTheme}, reason: ${reason})`);
  }
  if (picks.length < MAX_PICKS) {
    console.warn(`[Trellis Curator] Fewer than ${MAX_PICKS} picks survived validation (got ${picks.length}).`);
  }
}

export async function curateTrellisArticles(
  candidates: readonly TrellisCandidate[],
  themeNames: readonly string[],
  anthropicApiKey: string,
): Promise<readonly CuratedPick[]> {
  if (candidates.length === 0) return [];

  const candidateUrls = new Set(candidates.map((c) => c.url));
  const themeNameSet = new Set(themeNames);

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(candidates, themeNames) }],
      }),
    });
  } catch (error: unknown) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const message = isAbort
      ? `timeout after ${FETCH_TIMEOUT_MS}ms`
      : (error instanceof Error ? error.message : 'unknown');
    console.error(`[Trellis Curator] fetch failed: ${message}`);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    console.error(`[Trellis Curator] API returned ${response.status}`);
    return [];
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`[Trellis Curator] invalid response body: ${message}`);
    return [];
  }

  const content = Array.isArray(data['content']) ? data['content'] : [];
  const firstBlock = content[0] as Record<string, unknown> | undefined;
  const rawText = typeof firstBlock?.['text'] === 'string' ? firstBlock['text'] : '';
  if (!rawText) {
    console.error('[Trellis Curator] empty content in response');
    return [];
  }

  const parsed = parseClaudeText(rawText);
  const validated = validatePicks(parsed, candidateUrls, themeNameSet);

  const rawPicks: PickWithReason[] = [];
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>)['picks'])) {
    const rawList = (parsed as Record<string, unknown>)['picks'] as unknown[];
    for (const entry of rawList) {
      if (entry && typeof entry === 'object') {
        const e = entry as Record<string, unknown>;
        if (typeof e['url'] === 'string' && typeof e['mainTheme'] === 'string' && typeof e['reason'] === 'string') {
          rawPicks.push({ url: e['url'], mainTheme: e['mainTheme'], reason: e['reason'] });
        }
      }
    }
  }

  logPicks(validated, rawPicks, candidates.length);
  return validated;
}
