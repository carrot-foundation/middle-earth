import type { ProcessedArticle } from '../types.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeHref(value: string): string {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'mailto:') {
      return '#';
    }
    return escapeHtml(u.toString());
  } catch {
    return '#';
  }
}

function formatArticleDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return escapeHtml(raw);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const MAX_SUMMARY_LENGTH = 500;
const COMPACT_THRESHOLD = 10;

const BRAND = {
  teal: '#007F82',
  orange: '#F58216',
  darkNavy: '#000D33',
  lightBg: '#F5F8FA',
  white: '#FFFFFF',
  mutedText: '#768196',
  border: '#E2E8F0',
  cardBg: '#FFFFFF',
} as const;

const THEME_COLORS: Readonly<Record<string, { color: string; bgColor: string }>> = {
  'Methane & Super Pollutants': { color: '#D97706', bgColor: '#FEF3C7' },
  'Methane Detection & MRV': { color: '#0891B2', bgColor: '#CFFAFE' },
  'Circularity & Composting': { color: '#059669', bgColor: '#D1FAE5' },
  'Global Events & COP30': { color: '#7C3AED', bgColor: '#EDE9FE' },
  'Carbon Markets': { color: '#2563EB', bgColor: '#DBEAFE' },
  'Corporate Carbon Credit Purchases': { color: '#DC2626', bgColor: '#FEE2E2' },
  'Tokenized Carbon & Web3': { color: '#9333EA', bgColor: '#F3E8FF' },
  'Climate Finance & AMC': { color: '#0D9488', bgColor: '#CCFBF1' },
  'Carrot Mentions': { color: BRAND.orange, bgColor: '#FFF7ED' },
};

const DEFAULT_THEME = { color: BRAND.teal, bgColor: '#E6FFFA' } as const;

function themeColor(theme: string): string {
  return (THEME_COLORS[theme] ?? DEFAULT_THEME).color;
}

function themeBgColor(theme: string): string {
  return (THEME_COLORS[theme] ?? DEFAULT_THEME).bgColor;
}

function sourceLabel(source: string): string {
  return source === 'carbon-pulse' ? 'Carbon Pulse' : 'ESG News';
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function articleUrl(article: ProcessedArticle): string {
  if (article.notionPageId) {
    return `https://www.notion.so/${article.notionPageId.replace(/-/g, '')}`;
  }
  return article.url;
}

function truncateSummary(summary: string): string {
  if (summary.length > MAX_SUMMARY_LENGTH) {
    return summary.slice(0, MAX_SUMMARY_LENGTH).trimEnd() + '...';
  }
  return summary;
}

function buildLogoText(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="font-size: 28px; font-weight: 700; color: ${BRAND.white}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; letter-spacing: -0.5px;">
          <span style="color: ${BRAND.teal};">&#x1f955;</span>&nbsp;&nbsp;<span style="color: #EAEAEA;">carrot</span>
        </td>
      </tr>
    </table>`;
}

function buildArticleCard(article: ProcessedArticle): string {
  const url = articleUrl(article);
  const color = themeColor(article.mainTheme);
  const sourceName = sourceLabel(article.source);
  const summary = truncateSummary(article.summary);

  let keyPointsHtml = '';
  if (article.keyPoints.length > 0) {
    keyPointsHtml = `
      <div style="font-size: 0; line-height: 0; height: 12px;">&#8203;</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        ${article.keyPoints
          .map(
            (point) => `
        <tr>
          <td width="20" valign="top" style="padding: 2px 8px 4px 0; color: ${BRAND.orange}; font-size: 8px; line-height: 20px;">&#9679;</td>
          <td style="padding: 2px 0 4px 0; font-size: 13px; line-height: 20px; color: ${BRAND.mutedText};">${escapeHtml(point)}</td>
        </tr>`,
          )
          .join('')}
      </table>`;
  }

  return `
    <!-- Article Card -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;">
      <tr>
        <td style="background-color: ${BRAND.cardBg}; border-radius: 8px; border: 1px solid ${BRAND.border};">
          <!-- Theme accent bar -->
          <div style="height: 4px; background-color: ${color}; font-size: 0; line-height: 0; border-radius: 8px 8px 0 0;">&#8203;</div>
          <!-- Card content -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 20px 24px;">
                <!-- Theme badge -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color: ${themeBgColor(article.mainTheme)}; border-radius: 4px; padding: 3px 10px 3px 10px;">
                      <span style="font-size: 11px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(article.mainTheme)}</span>
                    </td>
                  </tr>
                </table>
                <div style="font-size: 0; line-height: 0; height: 8px;">&#8203;</div>
                <!-- Title -->
                <a href="${safeHref(url)}" style="text-decoration: none; color: ${BRAND.darkNavy};">
                  <h2 style="margin: 0; font-size: 17px; font-weight: 700; line-height: 24px; color: ${BRAND.darkNavy};">${escapeHtml(article.title)}</h2>
                </a>
                <div style="font-size: 0; line-height: 0; height: 8px;">&#8203;</div>
                <!-- Meta -->
                <p style="margin: 0; font-size: 12px; color: ${BRAND.mutedText}; line-height: 18px;">
                  ${escapeHtml(article.author)} &nbsp;&#183;&nbsp; ${formatArticleDate(article.date)} &nbsp;&#183;&nbsp; <a href="${safeHref(article.url)}" style="color: ${BRAND.teal}; text-decoration: none;">${sourceName}</a>
                </p>
                <div style="font-size: 0; line-height: 0; height: 12px;">&#8203;</div>
                <!-- Summary -->
                <p style="margin: 0; font-size: 14px; line-height: 22px; color: #4A5568;">${escapeHtml(summary)}</p>
                ${keyPointsHtml}
                <div style="font-size: 0; line-height: 0; height: 16px;">&#8203;</div>
                <!-- Read more -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color: ${BRAND.teal}; border-radius: 4px;">
                      <a href="${safeHref(url)}" style="display: inline-block; padding: 8px 20px; font-size: 13px; font-weight: 600; color: ${BRAND.white}; text-decoration: none;">Read full article</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildCompactArticleRow(article: ProcessedArticle): string {
  const url = articleUrl(article);
  const color = themeColor(article.mainTheme);
  const srcLabel = sourceLabel(article.source) === 'Carbon Pulse' ? 'CP' : 'ESG';

  return `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid ${BRAND.border};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="4" valign="top">
              <div style="width: 4px; height: 40px; background-color: ${color}; border-radius: 2px; font-size: 0; line-height: 0;">&#8203;</div>
            </td>
            <td style="padding-left: 12px;">
              <a href="${safeHref(url)}" style="text-decoration: none; color: ${BRAND.darkNavy}; font-size: 14px; font-weight: 600; line-height: 20px;">${escapeHtml(article.title)}</a>
              <div style="font-size: 0; line-height: 0; height: 4px;">&#8203;</div>
              <p style="margin: 0; font-size: 12px; color: ${BRAND.mutedText}; line-height: 16px;">
                ${escapeHtml(article.author)} &nbsp;&#183;&nbsp; ${formatArticleDate(article.date)} &nbsp;&#183;&nbsp; <span style="color: ${BRAND.teal};">${srcLabel}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildCompactThemeSection(theme: string, articles: readonly ProcessedArticle[]): string {
  const color = themeColor(theme);
  const rows = articles.map(buildCompactArticleRow).join('\n');

  return `
    <!-- Theme Section: ${escapeHtml(theme)} -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;">
      <tr>
        <td style="background-color: ${BRAND.cardBg}; border-radius: 8px; border: 1px solid ${BRAND.border};">
          <!-- Theme header -->
          <div style="height: 3px; background-color: ${color}; font-size: 0; line-height: 0; border-radius: 8px 8px 0 0;">&#8203;</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 12px 16px 0 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color: ${themeBgColor(theme)}; border-radius: 4px; padding: 3px 10px;">
                      <span style="font-size: 11px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(theme)}</span>
                    </td>
                    <td style="padding-left: 8px; font-size: 11px; color: ${BRAND.mutedText};">${articles.length} article${articles.length !== 1 ? 's' : ''}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!-- Articles list -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${rows}
          </table>
        </td>
      </tr>
    </table>`;
}

function buildCompactArticleCards(articles: readonly ProcessedArticle[]): string {
  const grouped: Record<string, ProcessedArticle[]> = {};
  for (const a of articles) {
    if (!grouped[a.mainTheme]) grouped[a.mainTheme] = [];
    grouped[a.mainTheme]!.push(a);
  }
  return Object.entries(grouped)
    .map(([theme, arts]) => buildCompactThemeSection(theme, arts))
    .join('\n');
}

export function buildEmailHtml(articles: readonly ProcessedArticle[], today: string): string {
  const formattedDate = formatDate(today);
  const uniqueSources = [...new Set(articles.map((a) => sourceLabel(a.source)))];
  const sourceNames = uniqueSources.join(' & ');
  const isCompact = articles.length > COMPACT_THRESHOLD;
  const articleCards = isCompact
    ? buildCompactArticleCards(articles)
    : articles.map(buildArticleCard).join('\n');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Industry News Digest - ${today}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.lightBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${BRAND.lightBg};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!-- Inner container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width: 600px;">

          <!-- Header -->
          <tr>
            <td style="background-color: ${BRAND.darkNavy}; border-radius: 12px 12px 0 0; padding: 32px 32px 24px 32px; text-align: center;">
              <!-- Logo -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    ${buildLogoText()}
                  </td>
                </tr>
              </table>
              <!-- Divider line -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <div style="width: 60px; height: 3px; background-color: ${BRAND.orange}; border-radius: 2px; font-size: 0; line-height: 0;">&#8203;</div>
                  </td>
                </tr>
              </table>
              <!-- Title -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 24px; font-weight: 700; color: ${BRAND.white}; letter-spacing: -0.3px; padding-bottom: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">Industry News Digest</td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 14px; color: #94A3B8; line-height: 20px;">${formattedDate}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Stats bar -->
          <tr>
            <td style="background-color: ${BRAND.white}; padding: 16px 32px; border-bottom: 1px solid ${BRAND.border};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-size: 13px; color: ${BRAND.mutedText};">
                    <span style="font-weight: 700; color: ${BRAND.teal}; font-size: 18px;">${articles.length}</span>
                    <span style="margin-left: 4px;">article${articles.length !== 1 ? 's' : ''} extracted from</span>
                    <span style="font-weight: 600; color: ${BRAND.darkNavy};">${sourceNames}</span>
                  </td>
                  <td align="right" style="font-size: 12px; color: ${BRAND.mutedText};">
                    ${[...new Set(articles.map((a) => a.mainTheme))].length} themes covered
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Articles -->
          <tr>
            <td style="background-color: ${BRAND.lightBg}; padding: 24px 24px 8px 24px;">
              ${articleCards}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${BRAND.darkNavy}; border-radius: 0 0 12px 12px; padding: 24px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 18px;">
                This digest is curated by <span style="color: ${BRAND.orange}; font-weight: 600;">Carrot Intelligence</span> from ${sourceNames}.
              </p>
              <div style="font-size: 0; line-height: 0; height: 8px;">&#8203;</div>
              <p style="margin: 0; font-size: 11px; color: #475569; line-height: 16px;">
                Carrot Foundation &nbsp;&#183;&nbsp; <a href="https://carrot.eco" style="color: ${BRAND.teal}; text-decoration: none;">carrot.eco</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
