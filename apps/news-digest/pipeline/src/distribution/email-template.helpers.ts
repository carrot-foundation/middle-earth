import type { ProcessedArticle } from '../types.js';

const BRAND = {
  teal: '#007F82',
  orange: '#F58216',
  darkNavy: '#000D33',
} as const;

function sourceLabel(source: ProcessedArticle['source']): string {
  if (source === 'carbon-pulse') return 'Carbon Pulse';
  return 'ESG News';
}

function articleUrl(article: ProcessedArticle): string {
  if (article.notionPageId != null) {
    return `https://www.notion.so/${article.notionPageId.replace(/-/g, '')}`;
  }
  return article.url;
}

function buildArticleCard(article: ProcessedArticle): string {
  const url = articleUrl(article);
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;background-color:#ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="display:inline-block;padding:3px 10px;border-radius:12px;background-color:${BRAND.teal};color:#ffffff;font-size:12px;font-weight:600;letter-spacing:0.5px;margin-bottom:10px;">${article.mainTheme}</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:8px;">
                <a href="${url}" style="color:${BRAND.darkNavy};font-size:17px;font-weight:700;text-decoration:none;line-height:1.4;">${article.title}</a>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;">
                <span style="color:#666666;font-size:13px;">
                  ${article.author} &nbsp;|&nbsp; ${sourceLabel(article.source)} &nbsp;|&nbsp; ${article.date}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:14px;">
                <p style="margin:0;color:#333333;font-size:14px;line-height:1.6;">${article.summary}</p>
              </td>
            </tr>
            <tr>
              <td>
                <a href="${url}" style="display:inline-block;padding:8px 18px;background-color:${BRAND.orange};color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:4px;">Read full article</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function buildEmailHtml(articles: readonly ProcessedArticle[], today: string): string {
  const articleCards = articles.map(buildArticleCard).join('');

  const noArticlesSection =
    articles.length === 0
      ? `<p style="color:#666666;font-size:15px;text-align:center;">No articles found for today.</p>`
      : articleCards;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Industry News Digest - ${today}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND.darkNavy};padding:28px 32px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Industry News Digest</h1>
              <p style="margin:6px 0 0;color:#aaaaaa;font-size:14px;">${today} &nbsp;·&nbsp; ${articles.length} article${articles.length === 1 ? '' : 's'}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#f4f4f4;padding:24px 0;">
              ${noArticlesSection}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:${BRAND.darkNavy};padding:20px 32px;border-radius:0 0 8px 8px;text-align:center;">
              <p style="margin:0;color:#aaaaaa;font-size:12px;">Carrot Foundation &nbsp;·&nbsp; Industry Intelligence</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
