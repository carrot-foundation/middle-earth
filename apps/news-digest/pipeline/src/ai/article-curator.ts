// Shared article curator — picks the most digest-worthy articles from a
// candidate pool and assigns each an allowed theme. Source-agnostic: Trellis
// (broad `/articles/` index pool) and ESG News (RSS feed pool) both feed it.
// The `label` option only changes log prefixes; `maxPicks` bounds the result.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;
const DEFAULT_MAX_PICKS = 2;
const FETCH_TIMEOUT_MS = 15_000;

export interface ArticleCandidate {
  readonly url: string;
  readonly title: string;
  readonly date: string;
  readonly excerpt: string;
}

export interface CuratedPick {
  readonly url: string;
  readonly mainTheme: string;
}

export interface CurateOptions {
  // Upper bound on accepted picks. Defaults to 2 (the original Trellis cap).
  readonly maxPicks?: number;
  // Log-prefix label, e.g. 'Trellis Curator' / 'ESG News Curator'.
  readonly label?: string;
}

interface PickWithReason {
  readonly url: string;
  readonly mainTheme: string;
  readonly reason: string;
}

function buildSystemPrompt(maxPicks: number): string {
  return (
    'You curate a daily sustainability and climate newsletter for the Carrot Foundation, ' +
    'a Web3 impact platform focused on decarbonization, methane reduction, circular economy, ' +
    `and tokenized environmental credits. Pick the ${maxPicks} articles most valuable to a ` +
    'decarbonization and circularity audience. Prefer original reporting over opinion pieces. ' +
    'Prefer more recent articles when relevance is similar. Avoid picking multiple articles ' +
    'that cover the same story.'
  );
}

function buildUserPrompt(
  candidates: readonly ArticleCandidate[],
  themeNames: readonly string[],
  maxPicks: number,
): string {
  const payload = {
    candidates: candidates.map((candidate) => ({
      url: candidate.url, title: candidate.title, date: candidate.date, excerpt: candidate.excerpt,
    })),
    allowedThemes: themeNames,
  };
  return `${JSON.stringify(payload, null, 2)}

Return ONLY JSON with this shape, no markdown, no commentary:
{ "picks": [{ "url": "...", "mainTheme": "...", "reason": "..." }] }

- "url" must exactly match one of the candidate URLs.
- "mainTheme" must exactly match one of the allowed theme names.
- "reason" is a short rationale (<= 200 chars).
- Return at most ${maxPicks} picks.`;
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
  maxPicks: number,
  label: string,
): readonly CuratedPick[] {
  if (!raw || typeof raw !== 'object') return [];
  const picks = (raw as Record<string, unknown>)['picks'];
  if (!Array.isArray(picks)) return [];

  const validated: CuratedPick[] = [];
  const seen = new Set<string>();
  for (const entry of picks) {
    if (!entry || typeof entry !== 'object') continue;
    const pick = entry as Record<string, unknown>;
    const url = pick['url'];
    const mainTheme = pick['mainTheme'];
    if (typeof url !== 'string' || typeof mainTheme !== 'string') continue;
    if (!candidateUrls.has(url) || !themeNames.has(mainTheme)) {
      console.warn(`[${label}] Dropped invalid pick: url=${url} mainTheme=${mainTheme}`);
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    validated.push({ url, mainTheme });
    if (validated.length >= maxPicks) break;
  }
  return validated;
}

function logPicks(
  picks: readonly CuratedPick[],
  rawPicks: readonly PickWithReason[],
  candidateCount: number,
  maxPicks: number,
  label: string,
): void {
  console.log(`[${label}] Candidates: ${candidateCount}, Picks accepted: ${picks.length}`);
  for (const pick of picks) {
    const match = rawPicks.find((rawPick) => rawPick.url === pick.url);
    const reason = match?.reason ?? '';
    console.log(`[${label}] Pick: ${pick.url} (theme: ${pick.mainTheme}, reason: ${reason})`);
  }
  if (picks.length < maxPicks) {
    console.warn(`[${label}] Fewer than ${maxPicks} picks survived validation (got ${picks.length}).`);
  }
}

/**
 * Ask Claude to pick the most digest-worthy articles from `candidates` and tag
 * each with one of `themeNames`. Returns at most `maxPicks` picks; any failure
 * (network, non-2xx, malformed JSON, timeout) degrades to an empty array so the
 * caller falls back to whatever it collected without the curator.
 */
export async function curateArticles(
  candidates: readonly ArticleCandidate[],
  themeNames: readonly string[],
  anthropicApiKey: string,
  options: CurateOptions = {},
): Promise<readonly CuratedPick[]> {
  if (candidates.length === 0) return [];

  const maxPicks = options.maxPicks ?? DEFAULT_MAX_PICKS;
  const label = options.label ?? 'Curator';
  const candidateUrls = new Set(candidates.map((candidate) => candidate.url));
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
        system: buildSystemPrompt(maxPicks),
        messages: [{ role: 'user', content: buildUserPrompt(candidates, themeNames, maxPicks) }],
      }),
    });
  } catch (error: unknown) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const message = isAbort
      ? `timeout after ${FETCH_TIMEOUT_MS}ms`
      : (error instanceof Error ? error.message : 'unknown');
    console.error(`[${label}] fetch failed: ${message}`);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    console.error(`[${label}] API returned ${response.status}`);
    return [];
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`[${label}] invalid response body: ${message}`);
    return [];
  }

  const content = Array.isArray(data['content']) ? data['content'] : [];
  const firstBlock = content[0] as Record<string, unknown> | undefined;
  const rawText = typeof firstBlock?.['text'] === 'string' ? firstBlock['text'] : '';
  if (!rawText) {
    console.error(`[${label}] empty content in response`);
    return [];
  }

  const parsed = parseClaudeText(rawText);
  const validated = validatePicks(parsed, candidateUrls, themeNameSet, maxPicks, label);

  const rawPicks: PickWithReason[] = [];
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>)['picks'])) {
    const rawList = (parsed as Record<string, unknown>)['picks'] as unknown[];
    for (const entry of rawList) {
      if (entry && typeof entry === 'object') {
        const pick = entry as Record<string, unknown>;
        if (typeof pick['url'] === 'string' && typeof pick['mainTheme'] === 'string' && typeof pick['reason'] === 'string') {
          rawPicks.push({ url: pick['url'], mainTheme: pick['mainTheme'], reason: pick['reason'] });
        }
      }
    }
  }

  logPicks(validated, rawPicks, candidates.length, maxPicks, label);
  return validated;
}
