import React from 'react';
import {
  FOOTER_LINKS,
  PRODUCT_NAME,
  PRODUCT_OWNER,
  PRODUCT_OWNER_LOCATION,
  PRODUCT_VERSION,
  hrefFor,
} from '../routing/routes';

interface FooterProps {
  title?: string;
  subtitle?: string;
}

/**
 * Editorial site footer. It deliberately uses a deep ink surface in both
 * themes, as specified, and keeps the legal links in one compact row on wide
 * screens while allowing natural wrapping on smaller ones.
 */
export const Footer: React.FC<FooterProps> = ({
  title = `${PRODUCT_NAME} · ${PRODUCT_VERSION}`,
  subtitle = `Product of ${PRODUCT_OWNER}, ${PRODUCT_OWNER_LOCATION}.`,
}) => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-footer-bg text-footer-text border-t border-footer-border">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          {/* Brand + attribution */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <span className="font-serif text-lg font-bold tracking-tight text-footer-text">{title}</span>
            <span className="text-xs text-footer-muted max-w-xs">{subtitle}</span>
          </div>

          {/* Legal + product links */}
          <nav aria-label="Legal and product information" className="lg:pt-1">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              {FOOTER_LINKS.map((link, index) => (
                <li key={link.route} className="flex items-center gap-4">
                  <a
                    href={hrefFor(link.route)}
                    className="text-footer-muted hover:text-footer-text underline-offset-4 hover:underline transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-footer-focus focus-visible:ring-offset-2 focus-visible:ring-offset-footer-bg"
                  >
                    {link.label}
                  </a>
                  {index < FOOTER_LINKS.length - 1 && (
                    <span aria-hidden="true" className="text-footer-border select-none">
                      ·
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 pt-5 border-t border-footer-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[11px] text-footer-muted">
            © {year} {PRODUCT_OWNER}. All rights reserved.
          </p>
          <p className="text-[11px] text-footer-muted">
            Independent client-side software. Users are solely responsible for copyright compliance and lawful use.
          </p>
        </div>
      </div>
    </footer>
  );
};
