import { describe, expect, it } from 'vitest';
import { FOOTER_LINKS, LEGAL_ROUTE_NAMES, hrefFor, isLegalRoute, parseHash } from './routes';

describe('parseHash', () => {
  it('resolves the studio route', () => {
    expect(parseHash('#studio')).toEqual({ name: 'studio' });
  });

  it('resolves the landing route for empty, home and unknown fragments', () => {
    expect(parseHash('')).toEqual({ name: 'landing' });
    expect(parseHash('#')).toEqual({ name: 'landing' });
    expect(parseHash('#home')).toEqual({ name: 'landing' });
    expect(parseHash('#nonsense')).toEqual({ name: 'landing' });
  });

  it('resolves every legal route', () => {
    for (const name of LEGAL_ROUTE_NAMES) {
      expect(parseHash(`#${name}`)).toEqual({ name });
      expect(isLegalRoute(name)).toBe(true);
    }
  });

  it('treats landing section anchors as landing with a scroll target', () => {
    expect(parseHash('#features')).toEqual({ name: 'landing', section: 'features' });
    expect(parseHash('#how-it-works')).toEqual({ name: 'landing', section: 'how-it-works' });
  });

  it('is case and whitespace tolerant', () => {
    expect(parseHash('#  Privacy ')).toEqual({ name: 'privacy' });
    expect(parseHash('#STUDIO')).toEqual({ name: 'studio' });
  });
});

describe('footer destinations', () => {
  it('covers the eight required links in the required order', () => {
    expect(FOOTER_LINKS.map((l) => l.label)).toEqual([
      'Privacy',
      'Terms',
      'Cookies',
      'Disclaimer',
      'Contact',
      'Licenses',
      'Accessibility',
      'Security',
    ]);
  });

  it('gives every link a real hash destination that round-trips', () => {
    for (const link of FOOTER_LINKS) {
      const href = hrefFor(link.route);
      expect(href.startsWith('#')).toBe(true);
      expect(parseHash(href)).toEqual({ name: link.route });
    }
  });
});
