import type { RawArticle } from '../types.js';

export function sourceLabel(source: RawArticle['source']): string {
  switch (source) {
    case 'carbon-pulse':
      return 'Carbon Pulse';
    case 'esgnews':
      return 'ESG News';
    case 'trellis':
      return 'Trellis';
    case 'a16z-crypto':
      return 'a16z crypto';
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}

export function compactSourceLabel(source: RawArticle['source']): string {
  switch (source) {
    case 'carbon-pulse':
      return 'CP';
    case 'esgnews':
      return 'ESG';
    case 'trellis':
      return 'Trellis';
    case 'a16z-crypto':
      return 'a16z';
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}
