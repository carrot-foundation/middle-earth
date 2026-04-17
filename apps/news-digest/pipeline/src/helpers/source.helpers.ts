import type { RawArticle } from '../types.js';

export function sourceLabel(source: RawArticle['source']): string {
  switch (source) {
    case 'carbon-pulse':
      return 'Carbon Pulse';
    case 'esgnews':
      return 'ESG News';
    case 'trellis':
      return 'Trellis';
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}
