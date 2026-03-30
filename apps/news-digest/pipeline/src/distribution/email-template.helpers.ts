import type { ProcessedArticle } from '../types.js';

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

const THEME_COLORS: Readonly<Record<string, string>> = {
  'Methane & Super Pollutants': '#D97706',
  'Methane Detection & MRV': '#0891B2',
  'Circularity & Composting': '#059669',
  'Global Events & COP30': '#7C3AED',
  'Carbon Markets': '#2563EB',
  'Corporate Carbon Credit Purchases': '#DC2626',
  'Tokenized Carbon & Web3': '#9333EA',
  'Climate Finance & AMC': '#0D9488',
  'Carrot Mentions': BRAND.orange,
};

function themeColor(theme: string): string {
  return THEME_COLORS[theme] ?? BRAND.teal;
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

function buildLogoSvg(wordmarkColor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="49" viewBox=".001 0 148.464 48" aria-label="Carrot">
  <path d="M23.803 17.468c-.36 0-.66-.25-.741-.583-.736-3.047-2.185-9.013-2.936-12.09a4 4 0 0 1-.133-.997A3.805 3.805 0 0 1 23.803 0a3.805 3.805 0 0 1 3.809 3.798c0 .347-.056.678-.133.996-.751 3.078-2.197 9.044-2.936 12.09a.764.764 0 0 1-.74.584M20.852 18.133a.76.76 0 0 1-.92-.209c-1.98-2.433-5.863-7.196-7.866-9.652a4.2 4.2 0 0 1-.552-.843 3.79 3.79 0 0 1 1.799-5.062 3.81 3.81 0 0 1 5.076 1.793c.148.31.243.634.309.958.651 3.1 1.919 9.105 2.573 12.17a.764.764 0 0 1-.42.845M18.476 20.003a.76.76 0 0 1-.92.206 9411 9411 0 0 0-11.27-5.334A3.79 3.79 0 0 1 4.864 9.01a3.816 3.816 0 0 1 5.356-.56c.268.216.493.468.692.728a6554 6554 0 0 0 7.575 9.881c.212.27.217.66-.01.94zM17.137 22.708a.78.78 0 0 1-.74.604H3.923c-.33 0-.667-.023-1.004-.104a3.79 3.79 0 0 1-2.813-4.576 3.81 3.81 0 0 1 4.59-2.804c.338.081.65.211.94.361 2.826 1.445 8.304 4.242 11.104 5.669a.76.76 0 0 1 .396.853zM30.468 22.708a.784.784 0 0 0 .74.604h12.473c.33 0 .667-.023 1.004-.104a3.797 3.797 0 0 0 2.813-4.578 3.81 3.81 0 0 0-4.59-2.805 4.2 4.2 0 0 0-.94.362 12162 12162 0 0 1-11.104 5.668.77.77 0 0 0-.396.856zM26.753 18.133a.76.76 0 0 0 .92-.209c1.98-2.433 5.863-7.196 7.866-9.652.21-.255.401-.53.552-.843a3.79 3.79 0 0 0-1.799-5.062 3.81 3.81 0 0 0-5.076 1.793c-.148.31-.243.634-.309.958-.651 3.1-1.919 9.105-2.573 12.17a.76.76 0 0 0 .42.845M29.13 20.003a.76.76 0 0 0 .919.206 9411 9411 0 0 1 11.27-5.334 3.79 3.79 0 0 0 1.423-5.864 3.816 3.816 0 0 0-5.356-.56 4.2 4.2 0 0 0-.692.728c-1.926 2.52-5.664 7.395-7.575 9.881a.75.75 0 0 0 .01.94z" fill="${BRAND.teal}"/>
  <path d="M46.277 24.82H31.16a.303.303 0 0 0-.304.319q.023.472.023.986c0 1.928-.312 4.213-.889 6.644a.3.3 0 0 1-.268.231l-5.945.568a.307.307 0 0 0 0 .612l5.332.51a.3.3 0 0 1 .263.387 49 49 0 0 1-1.142 3.388c-.672 1.773-1.416 3.416-2.095 4.626-1.05 1.872-1.6 2.448-2.333 2.448s-1.282-.576-2.332-2.448a28 28 0 0 1-1.15-2.326.303.303 0 0 1 .248-.425l3.247-.311a.32.32 0 0 0 .291-.273.31.31 0 0 0-.276-.341l-4.057-.387a.31.31 0 0 1-.255-.191l-.143-.372c-1.502-3.974-2.435-7.987-2.616-11.217a.305.305 0 0 1 .247-.318l8.058-1.5a.31.31 0 0 0 .258-.258.303.303 0 0 0-.301-.35H1.325c-.71 0-1.27.602-1.216 1.31C1.044 38.365 11.294 48 23.802 48s22.756-9.635 23.693-21.868a1.22 1.22 0 0 0-1.218-1.307z" fill="${BRAND.orange}"/>
  <path d="M118.272 16.751c-3.16.158-5.147 1.5-6.366 3.467v-2.57a.605.605 0 0 0-.608-.607h-1.829a.605.605 0 0 0-.608.607v17.616c0 .336.27.606.608.606h1.829c.337 0 .608-.27.608-.606v-7.34c0-5.02 2.511-7.887 6.438-8.134a.605.605 0 0 0 .567-.604V17.36a.61.61 0 0 0-.639-.609M106.699 16.751c-3.16.158-5.148 1.5-6.366 3.467v-2.57a.606.606 0 0 0-.608-.607h-1.83a.605.605 0 0 0-.608.607v17.616c0 .336.271.606.608.606h1.83c.337 0 .608-.27.608-.606v-7.34c0-5.02 2.511-7.887 6.438-8.134a.605.605 0 0 0 .567-.604V17.36a.61.61 0 0 0-.639-.609M147.857 17.042h-3.96V12.18a.605.605 0 0 0-.608-.606h-1.829a.605.605 0 0 0-.608.606v4.86h-2.438a.605.605 0 0 0-.608.607v1.52c0 .337.271.607.608.607h2.438v15.494c0 .336.271.606.608.606h1.829c.337 0 .608-.27.608-.606V19.775h3.96c.337 0 .608-.27.608-.606v-1.521a.605.605 0 0 0-.608-.607M71.622 31.769a6.98 6.98 0 0 1-4.445 1.676c-3.856.061-7.064-3.042-7.118-6.886-.054-3.903 3.104-7.085 7.005-7.085 1.737 0 3.327.63 4.553 1.677.242.206.6.19.825-.034l1.252-1.248a.607.607 0 0 0-.03-.886 9.98 9.98 0 0 0-6.395-2.482c-5.511-.112-10.156 4.392-10.197 9.89-.038 5.536 4.45 10.034 9.992 10.034 2.53 0 4.839-.937 6.602-2.483a.605.605 0 0 0 .028-.887l-1.252-1.248a.604.604 0 0 0-.82-.036zM127.993 16.494c-5.518 0-9.991 4.46-9.991 9.963s4.473 9.963 9.991 9.963c5.519 0 9.992-4.46 9.992-9.963s-4.473-9.963-9.992-9.963m0 16.95c-3.867 0-7.007-3.128-7.007-6.987s3.137-6.988 7.007-6.988c3.871 0 7.008 3.129 7.008 6.988s-3.137 6.988-7.008 6.988M93.632 17.042h-1.83a.605.605 0 0 0-.608.606v1.862c-1.737-1.86-4.195-3.016-7.005-3.016-5.518 0-9.992 4.46-9.992 9.963s4.474 9.963 9.992 9.963c2.81 0 5.27-1.156 7.008-3.018v1.862c0 .336.27.606.608.606h1.826c.338 0 .609-.27.609-.606V17.648a.605.605 0 0 0-.608-.607m-9.443 16.403c-3.868 0-7.008-3.128-7.008-6.988s3.137-6.988 7.008-6.988 7.008 3.129 7.008 6.988-3.14 6.988-7.008 6.988" fill="${wordmarkColor}"/>
</svg>`;
}

function buildArticleCard(article: ProcessedArticle): string {
  const url = articleUrl(article);
  const color = themeColor(article.mainTheme);
  const sourceName = sourceLabel(article.source);
  const summary = truncateSummary(article.summary);

  let keyPointsHtml = '';
  if (article.keyPoints.length > 0) {
    keyPointsHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 12px;">
        ${article.keyPoints
          .map(
            (point) => `
        <tr>
          <td width="20" valign="top" style="padding: 2px 8px 4px 0; color: ${BRAND.orange}; font-size: 8px; line-height: 20px;">&#9679;</td>
          <td style="padding: 2px 0 4px 0; font-size: 13px; line-height: 20px; color: ${BRAND.mutedText};">${point}</td>
        </tr>`,
          )
          .join('')}
      </table>`;
  }

  return `
    <!-- Article Card -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;">
      <tr>
        <td style="background: ${BRAND.cardBg}; border-radius: 8px; border: 1px solid ${BRAND.border}; overflow: hidden;">
          <!-- Theme accent bar -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="height: 4px; background: ${color}; font-size: 1px; line-height: 1px;">&nbsp;</td>
            </tr>
          </table>
          <!-- Card content -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 20px 24px;">
            <tr>
              <td>
                <!-- Theme badge -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                  <tr>
                    <td style="background: ${color}15; border-radius: 4px; padding: 3px 10px;">
                      <span style="font-size: 11px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">${article.mainTheme}</span>
                    </td>
                  </tr>
                </table>
                <!-- Title -->
                <a href="${url}" style="text-decoration: none; color: ${BRAND.darkNavy};">
                  <h2 style="margin: 0 0 8px 0; font-size: 17px; font-weight: 700; line-height: 24px; color: ${BRAND.darkNavy};">${article.title}</h2>
                </a>
                <!-- Meta -->
                <p style="margin: 0 0 12px 0; font-size: 12px; color: ${BRAND.mutedText}; line-height: 18px;">
                  ${article.author} &nbsp;&#183;&nbsp; ${article.date} &nbsp;&#183;&nbsp; <a href="${article.url}" style="color: ${BRAND.teal}; text-decoration: none;">${sourceName}</a>
                </p>
                <!-- Summary -->
                <p style="margin: 0; font-size: 14px; line-height: 22px; color: #4A5568;">${summary}</p>
                ${keyPointsHtml}
                <!-- Read more -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
                  <tr>
                    <td style="background: ${BRAND.teal}; border-radius: 4px;">
                      <a href="${url}" style="display: inline-block; padding: 8px 20px; font-size: 13px; font-weight: 600; color: ${BRAND.white}; text-decoration: none;">Read full article</a>
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
            <td width="4" style="background: ${color}; border-radius: 2px; font-size: 1px;">&nbsp;</td>
            <td style="padding-left: 12px;">
              <a href="${url}" style="text-decoration: none; color: ${BRAND.darkNavy}; font-size: 14px; font-weight: 600; line-height: 20px;">${article.title}</a>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: ${BRAND.mutedText}; line-height: 16px;">
                ${article.author} &nbsp;&#183;&nbsp; ${article.date} &nbsp;&#183;&nbsp; <span style="color: ${BRAND.teal};">${srcLabel}</span>
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
    <!-- Theme Section: ${theme} -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;">
      <tr>
        <td style="background: ${BRAND.cardBg}; border-radius: 8px; border: 1px solid ${BRAND.border}; overflow: hidden;">
          <!-- Theme header -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="height: 3px; background: ${color}; font-size: 1px; line-height: 1px;">&nbsp;</td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 12px 16px 0 16px;">
            <tr>
              <td>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background: ${color}15; border-radius: 4px; padding: 3px 10px;">
                      <span style="font-size: 11px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">${theme}</span>
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
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND.darkNavy} 0%, #0A1628 100%); border-radius: 12px 12px 0 0; padding: 32px 32px 24px 32px; text-align: center;">
              <!-- Logo -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    ${buildLogoSvg('#EAEAEA')}
                  </td>
                </tr>
              </table>
              <!-- Divider line -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="60" style="margin: 0 auto 20px auto;">
                <tr>
                  <td style="height: 3px; background: ${BRAND.orange}; border-radius: 2px; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
              <!-- Title -->
              <h1 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 700; color: ${BRAND.white}; letter-spacing: -0.3px;">Industry News Digest</h1>
              <p style="margin: 0; font-size: 14px; color: #94A3B8; line-height: 20px;">${formattedDate}</p>
            </td>
          </tr>

          <!-- Stats bar -->
          <tr>
            <td style="background: ${BRAND.white}; padding: 16px 32px; border-bottom: 1px solid ${BRAND.border};">
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
            <td style="background: ${BRAND.lightBg}; padding: 24px 24px 8px 24px;">
              ${articleCards}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: ${BRAND.darkNavy}; border-radius: 0 0 12px 12px; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B; line-height: 18px;">
                This digest is curated by <span style="color: ${BRAND.orange}; font-weight: 600;">Carrot Intelligence</span> from ${sourceNames}.
              </p>
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
