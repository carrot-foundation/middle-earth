import type { ThemeConfig } from './types.js';

export const THEMES: readonly ThemeConfig[] = [
  { name: 'Methane & Super Pollutants', frequency: 'daily', carbonPulseSearchTerms: 'methane', esgNewsSearchTerms: 'methane superpollutant' },
  { name: 'Methane Detection & MRV', frequency: 'daily', carbonPulseSearchTerms: 'MRV monitoring measurement', esgNewsSearchTerms: 'methane detection monitoring MRV' },
  { name: 'Circularity & Composting', frequency: 'daily', carbonPulseSearchTerms: 'waste recycling biochar composting', esgNewsSearchTerms: 'circular economy composting waste' },
  { name: 'Global Events & COP30', frequency: 'daily', carbonPulseSearchTerms: 'COP30 Article 6 climate summit NDC', esgNewsSearchTerms: 'COP30 climate summit Paris Agreement' },
  { name: 'Carrot Mentions', frequency: 'daily', carbonPulseSearchTerms: 'carrot BOLD circularity credits', esgNewsSearchTerms: 'carrot foundation BOLD' },
  { name: 'Carbon Markets', frequency: 'weekly', carbonPulseSearchTerms: 'carbon market pricing ETS', esgNewsSearchTerms: 'carbon market credits pricing' },
  { name: 'Corporate Carbon Credit Purchases', frequency: 'weekly', carbonPulseSearchTerms: 'corporate carbon credit purchase retirement', esgNewsSearchTerms: 'corporate carbon credit purchase' },
  { name: 'Tokenized Carbon & Web3', frequency: 'weekly', carbonPulseSearchTerms: 'tokenized carbon blockchain digital', esgNewsSearchTerms: 'tokenized carbon blockchain' },
  { name: 'Extended Producer Responsibility', frequency: 'weekly', carbonPulseSearchTerms: 'producer responsibility EPR', esgNewsSearchTerms: 'extended producer responsibility' },
  { name: 'Waste Policy & Regulation', frequency: 'weekly', carbonPulseSearchTerms: 'waste regulation policy circular', esgNewsSearchTerms: 'waste policy regulation' },
  { name: 'Composting Infrastructure', frequency: 'weekly', carbonPulseSearchTerms: 'composting infrastructure facility', esgNewsSearchTerms: 'composting infrastructure' },
  { name: 'Climate Finance & AMC', frequency: 'weekly', carbonPulseSearchTerms: 'climate finance AMC investment', esgNewsSearchTerms: 'climate finance green bond' },
  { name: 'Circularity Technology', frequency: 'weekly', carbonPulseSearchTerms: 'circularity technology traceability', esgNewsSearchTerms: 'circular technology traceability' },
  { name: 'Social Impact & Inclusion', frequency: 'weekly', carbonPulseSearchTerms: 'social impact inclusion green jobs', esgNewsSearchTerms: 'social impact inclusion' },
  { name: 'Verification & Auditing', frequency: 'monthly', carbonPulseSearchTerms: 'verification auditing integrity', esgNewsSearchTerms: 'ESG verification audit' },
  { name: 'Circularity Investors', frequency: 'monthly', carbonPulseSearchTerms: 'circularity investor fund', esgNewsSearchTerms: 'circular economy investor fund' },
] as const;

export const FREQUENCY_DAYS: Readonly<Record<string, number>> = {
  daily: 0,
  weekly: 7,
  monthly: 30,
};

export const SEGMENTS = [
  'Policy & Regulation',
  'Climate Finance',
  'Financial Services',
  'Energy',
  'Big Tech',
  'Project Developer',
  'Registry',
  'Academic',
  'Consumer Goods',
  'Insurance',
  'Commodity & Energy Trader',
  'Non-Profit Buyer',
  'Sustainability Consultancy',
] as const;

export const NOTION_VALID_THEMES = [
  'Social Impact & Inclusion',
  'Circularity & Composting',
  'Methane Detection & MRV',
  'Waste Policy & Regulation',
  'Corporate Carbon Credit Purchases',
  'Tokenized Carbon & Web3',
  'Methane & Super Pollutants',
  'Climate Finance & AMC',
  'Carbon Markets',
  'Extended Producer Responsibility',
  'Global Events & COP30',
] as const;
