import { describe, it, expect } from 'vitest';
import { sanitizeArticleText } from '../content.helpers.js';

// These fixtures are trimmed copies of the *actual* broken content the
// pipeline wrote to Notion on 2026-05-18 (ESG News article body + Carbon
// Pulse "Daily News Ticker" listing page). They lock in the regression.

describe('sanitizeArticleText', () => {
  it('strips literal <img> markup leaked from <noscript> lazy-load wrappers', () => {
    const raw =
      'Indonesia plans to rehabilitate 12 million hectares of degraded land.\n' +
      '<img loading="lazy" width="780" height="439" ' +
      'src="https://esgnews.com/wp-content/uploads/2026/05/Indonesia.webp" ' +
      'class="tw-absolute tw-top-0" alt="Indonesia" decoding="async" ' +
      'srcset="https://esgnews.com/x.webp 780w" sizes="(max-width: 780px) 100vw, 780px" />\n' +
      'Forestry officials announced the commitment.';

    const cleaned = sanitizeArticleText(raw);

    expect(cleaned).not.toContain('<img');
    expect(cleaned).not.toContain('srcset');
    expect(cleaned).not.toContain('.webp');
    expect(cleaned).toContain('Indonesia plans to rehabilitate 12 million hectares of degraded land.');
    expect(cleaned).toContain('Forestry officials announced the commitment.');
  });

  it('strips stray <br> and other residual HTML tags', () => {
    const raw = 'First sentence.<br><br>Second sentence.<br /> <p>Third.</p>';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).not.toMatch(/<[^>]+>/);
    expect(cleaned).toContain('First sentence.');
    expect(cleaned).toContain('Second sentence.');
    expect(cleaned).toContain('Third.');
  });

  it('collapses CSS-layout whitespace/newline runs into clean paragraphs', () => {
    const raw =
      '      \n        \n          \n            Real article paragraph one.\n\n\n\n\n' +
      '          \n        \n      Real article paragraph two.\n\n\n\n';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).not.toMatch(/^\s{2,}/m);
    expect(cleaned).not.toMatch(/\n{3,}/);
    expect(cleaned).toContain('Real article paragraph one.');
    expect(cleaned).toContain('Real article paragraph two.');
  });

  it('removes social share boilerplate (ESG News chrome)', () => {
    const raw =
      'Share:\nShare on Facebook\nShare on Twitter\nShare on LinkedIn\n' +
      'New Zealand plans to amend the Climate Change Response Act 2002.';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).not.toMatch(/Share on (Facebook|Twitter|LinkedIn)/);
    expect(cleaned).not.toMatch(/^Share:/m);
    expect(cleaned).toContain('New Zealand plans to amend the Climate Change Response Act 2002.');
  });

  it('removes the ESG News newsletter signup and editorial-team bio footer', () => {
    const raw =
      'The answer could affect how boards assess transition plans.\n' +
      'Subscribe & Follow for Daily ESG Insights\n' +
      'Stay Informed: Subscribe to the ESG News Daily Snapshot for the latest updates.\n' +
      'Join the Conversation: Follow ESG News on LinkedIn to engage with our community.\n' +
      'ESG News Editorial Team The ESG News Editorial Team is comprised of veteran ' +
      'financial journalists and sustainability analysts dedicated to providing real-time reporting.';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).toContain('The answer could affect how boards assess transition plans.');
    expect(cleaned).not.toMatch(/Subscribe & Follow/);
    expect(cleaned).not.toMatch(/Stay Informed:/);
    expect(cleaned).not.toMatch(/Join the Conversation:/);
    expect(cleaned).not.toMatch(/ESG News Editorial Team is comprised of/);
  });

  it('removes inline "RELATED ARTICLE:" promo lines', () => {
    const raw =
      'Indonesia has already issued regulations.\n' +
      'RELATED ARTICLE: Indonesia Launches Digital Tracker for Agricultural Commodities\n' +
      'That local element is important.';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).not.toMatch(/RELATED ARTICLE:/);
    expect(cleaned).toContain('Indonesia has already issued regulations.');
    expect(cleaned).toContain('That local element is important.');
  });

  it('returns empty string for a Carbon Pulse listing/ticker page (no article body)', () => {
    // The "CP Daily News Ticker" page is a date-filter calendar widget, not an
    // article. After chrome removal nothing real remains, so the caller can skip it.
    const raw =
      'Click on the coloured labels below to filter by region or topic\n' +
      'Filter by dateClear filter×See the past posts by selecting a date in the calendar below:' +
      '(Note: No posts before 28 April 2025)\n' +
      'January February March April May June July August September October November December\n' +
      '2016 2017 2018 2019 2020 2021 2022 2023 2024 2025 2026';
    expect(sanitizeArticleText(raw).trim()).toBe('');
  });

  it('preserves a real multi-paragraph article body intact', () => {
    const raw =
      'New Zealand’s government plans to change climate law to stop courts from finding ' +
      'companies liable in private cases for harm linked to greenhouse gas emissions.\n\n' +
      'Justice Minister Paul Goldsmith said the government would amend the Climate Change ' +
      'Response Act 2002. The change would apply to both current and future court proceedings.';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).toContain('New Zealand’s government plans to change climate law');
    expect(cleaned).toContain('Justice Minister Paul Goldsmith said the government would amend');
    expect(cleaned).toMatch(/\n\n/); // paragraph break preserved
  });

  it('is idempotent on already-clean Trellis-style content', () => {
    const clean =
      'Corporate demand is driving a boom in farmland carbon credits.\n\n' +
      'Farmers are increasingly turning to carbon markets.';
    expect(sanitizeArticleText(clean)).toBe(clean);
  });

  it('returns empty string for empty or whitespace-only input', () => {
    expect(sanitizeArticleText('')).toBe('');
    expect(sanitizeArticleText('   \n\t  \n ')).toBe('');
  });

  // Regression: 2026-05-20 prod Notion page (Trellis EDF article) shipped with
  // ~80% page chrome — newsletter signup, share buttons, repeated H1, author
  // bio, and a giant "Featured Reports" sponsored-cards block. These cases
  // lock in the post-fix behavior so a future template change is loud.
  it('strips Trellis newsletter signup + share strip + utm form-field artifacts', () => {
    const raw =
      '[Skip to content](https://trellis.net/article/x/#content)\n\n' +
      '**Subscribe to Trellis Briefing**\n\n' +
      'Please enable JavaScript in your browser to complete this form.\n\n' +
      'Email address \\*\n\n' +
      'utmCampaignLast\n\nutmMediumLast\n\nutmSourceLast\n\n' +
      'Subscribe![Loading](https://trellis.net/wp-content/themes/greenbiz/static/loader.svg)\n\n' +
      '[LinkedIn](https://linkedin.com/share?url=https://trellis.net/article/x/)[X](https://x.com/share?url=https://trellis.net/article/x/)[Facebook](https://facebook.com/sharer?u=https://trellis.net/article/x/)\n\n' +
      'The actual article begins here with substantive content about climate frameworks.';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).not.toContain('Skip to content');
    expect(cleaned).not.toContain('Subscribe to Trellis Briefing');
    expect(cleaned).not.toContain('Please enable JavaScript');
    expect(cleaned).not.toContain('Email address');
    expect(cleaned).not.toContain('utmCampaignLast');
    expect(cleaned).not.toContain('utmMediumLast');
    expect(cleaned).not.toContain('utmSourceLast');
    expect(cleaned).not.toContain('Loading');
    // cspell:disable-next-line
    expect(cleaned).not.toContain('linkedin.com/share');
    expect(cleaned).toContain('The actual article begins here with substantive content about climate frameworks.');
  });

  it('drops standalone image markdown lines (Firecrawl emits them for hero/byline images)', () => {
    const raw =
      '![Hero image alt text describing the figure](https://trellis.net/uploads/hero.jpg?w=1024)\n' +
      'The article paragraph that follows the hero image.\n' +
      '![](https://trellis.net/uploads/chart.png)\n' +
      'Second paragraph after a chart with empty alt text.';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).not.toContain('![');
    expect(cleaned).not.toContain('hero.jpg');
    expect(cleaned).not.toContain('chart.png');
    expect(cleaned).toContain('The article paragraph that follows the hero image.');
    expect(cleaned).toContain('Second paragraph after a chart with empty alt text.');
  });

  it('truncates everything from the "Featured Reports" heading onwards (Trellis sponsored block)', () => {
    const raw =
      'The article body ends here with a meaningful conclusion.\n' +
      '### Featured Reports\n' +
      '[![Sponsored card 1](https://trellis.net/img1.png)](https://trellis.net/resource/a/)\n' +
      'Sponsored\n' +
      '[![Sponsored card 2](https://trellis.net/img2.png)](https://trellis.net/resource/b/)\n' +
      'reCAPTCHA\n' +
      'protected by reCAPTCHA';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).not.toContain('Featured Reports');
    expect(cleaned).not.toContain('Sponsored card');
    expect(cleaned).not.toContain('reCAPTCHA');
    expect(cleaned).toContain('The article body ends here with a meaningful conclusion.');
  });

  it('truncates at the second "Subscribe to Trellis Briefing" heading (post-article repost)', () => {
    const raw =
      'Final paragraph of the article with substantive content here.\n' +
      '## Subscribe to Trellis Briefing\n' +
      'Get real case studies, expert action steps and the latest sustainability trends.\n' +
      'Please enable JavaScript in your browser to complete this form.';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).toContain('Final paragraph of the article with substantive content here.');
    expect(cleaned).not.toContain('Subscribe to Trellis Briefing');
    expect(cleaned).not.toContain('Get real case studies');
  });

  it('strips share-button-strip lines (pure inline-link sequences) but preserves inline links inside article paragraphs', () => {
    const raw =
      '[LinkedIn](https://www.linkedin.com/share?url=x)[X](https://x.com/share?url=x)[Facebook](https://facebook.com/sharer?u=x)\n' +
      'See the [Climate Contribution Framework white paper](https://example.com/paper.pdf) for details on methodology.';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).not.toMatch(/^\[LinkedIn\]/m);
    expect(cleaned).not.toContain('facebook.com/sharer');
    expect(cleaned).toContain('See the [Climate Contribution Framework white paper](https://example.com/paper.pdf) for details on methodology.');
  });

  it('strips collapsed-card backslash artifacts and standalone "By" byline label', () => {
    const raw =
      'By\n[Jim Giles](https://trellis.net/article/author/jim-giles/)\n\\\\\n\nSponsored\\\\\n\nThe article body paragraph.';
    const cleaned = sanitizeArticleText(raw);
    expect(cleaned).not.toMatch(/^By$/m);
    expect(cleaned).not.toMatch(/^Sponsored/m);
    expect(cleaned).not.toMatch(/^\\+$/m);
    expect(cleaned).toContain('The article body paragraph.');
  });
});
