import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';
import { FOOTER_LINKS, PRODUCT_OWNER } from '../routing/routes';

describe('Footer', () => {
  it('renders the brand and version block', () => {
    render(<Footer />);
    expect(screen.getByText(/MusikFlo · v1\.0/)).toBeInTheDocument();
  });

  it('states the product attribution without inventing a different company', () => {
    render(<Footer />);
    expect(screen.getByText(/Product of Aztras AI Tech Solutions, Chennai, India\./)).toBeInTheDocument();
  });

  it('lists every legal link in the required order as a real link', () => {
    render(<Footer />);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(FOOTER_LINKS.map((link) => link.label));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(FOOTER_LINKS.map((link) => `#${link.route}`));
  });

  it('renders a dynamic copyright year using the verified owner', () => {
    render(<Footer />);
    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} ${PRODUCT_OWNER}. All rights reserved.`)).toBeInTheDocument();
  });

  it('wraps the links in a navigation landmark', () => {
    render(<Footer />);
    expect(screen.getByRole('navigation', { name: /legal and product information/i })).toBeInTheDocument();
  });
});
