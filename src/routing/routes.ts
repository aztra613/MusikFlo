/**
 * Hash-based routing
 * ------------------
 * MusikFlo deploys as a static site, so every destination is addressed by hash
 * (`/#privacy`) rather than a pathname. A static host serves `index.html` for
 * `/` regardless of the fragment, which means direct refresh, deep links and
 * browser back/forward all work without any SPA rewrite rules.
 */

export type RouteName =
  | 'landing'
  | 'studio'
  | 'transcribe'
  | 'privacy'
  | 'terms'
  | 'cookies'
  | 'disclaimer'
  | 'contact'
  | 'licenses'
  | 'accessibility'
  | 'security'
  | 'pravin';

export const LEGAL_ROUTE_NAMES = [
  'privacy',
  'terms',
  'cookies',
  'disclaimer',
  'contact',
  'licenses',
  'accessibility',
  'security',
] as const;

export type LegalRouteName = (typeof LEGAL_ROUTE_NAMES)[number];

export const LANDING_SECTIONS = ['features', 'how-it-works', 'instruments', 'exports'] as const;
export type LandingSection = (typeof LANDING_SECTIONS)[number];

export interface Route {
  name: RouteName;
  /** Landing-page section to scroll to, when the hash targets one. */
  section?: LandingSection;
}

export function isLegalRoute(name: RouteName): name is LegalRouteName {
  return (LEGAL_ROUTE_NAMES as readonly string[]).includes(name);
}

const ROUTE_NAMES: RouteName[] = [
  'studio',
  'transcribe',
  'privacy',
  'terms',
  'cookies',
  'disclaimer',
  'contact',
  'licenses',
  'accessibility',
  'security',
  'pravin',
];

/**
 * Resolve a `location.hash` into a route. Unknown fragments resolve to the
 * landing page so the rendered view can never disagree with the URL.
 */
export function parseHash(hash: string): Route {
  const raw = (hash || '').replace(/^#\/?/, '').trim().toLowerCase();

  if (!raw || raw === 'home') return { name: 'landing' };

  if ((LANDING_SECTIONS as readonly string[]).includes(raw)) {
    return { name: 'landing', section: raw as LandingSection };
  }

  const match = ROUTE_NAMES.find((name) => name === raw);
  if (match) return { name: match };

  return { name: 'landing' };
}

/**
 * Resolve the current window.location (both pathname and hash) into a route.
 * Ensures easter egg routes like /pravin resolve correctly whether visited as /pravin or /#pravin.
 */
export function parseLocation(loc?: { pathname?: string; hash?: string }): Route {
  if (typeof window === 'undefined') return { name: 'landing' };
  const current = loc ?? window.location;
  const path = (current.pathname || '').replace(/^\/+|\/+$/g, '').toLowerCase();
  const hash = (current.hash || '').replace(/^#\/?/, '').trim().toLowerCase();

  // If the user navigated to any specific destination hash (e.g. #home, #studio, #transcribe, legal pages), respect it!
  if (hash && hash !== 'pravin' && !hash.startsWith('pravin')) {
    return parseHash(current.hash || '');
  }

  if (path === 'pravin' || path.startsWith('pravin/')) {
    return { name: 'pravin' };
  }

  if (hash === 'pravin' || hash.startsWith('pravin')) {
    return { name: 'pravin' };
  }

  return parseHash(current.hash || '');
}

export function hrefFor(name: RouteName): string {
  if (name === 'landing') return '#home';
  if (name === 'pravin') return '#pravin';
  return `#${name}`;
}

/** Real destinations for the footer, in the order required by the design brief. */
export const FOOTER_LINKS: Array<{ label: string; route: LegalRouteName }> = [
  { label: 'Privacy', route: 'privacy' },
  { label: 'Terms', route: 'terms' },
  { label: 'Cookies', route: 'cookies' },
  { label: 'Disclaimer', route: 'disclaimer' },
  { label: 'Contact', route: 'contact' },
  { label: 'Licenses', route: 'licenses' },
  { label: 'Accessibility', route: 'accessibility' },
  { label: 'Security', route: 'security' },
];

export const PRODUCT_NAME = 'MusikFlo';
export const PRODUCT_VERSION = 'v1.0';
export const PRODUCT_OWNER = 'Aztras AI Tech Solutions';
export const PRODUCT_OWNER_LOCATION = 'Chennai, India';
