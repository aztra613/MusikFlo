import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LegalPage } from './LegalPage';
import { LEGAL_DOCUMENTS } from '../content/legal';
import { LEGAL_ROUTE_NAMES } from '../routing/routes';

function renderLegal(route: (typeof LEGAL_ROUTE_NAMES)[number]) {
  const doc = LEGAL_DOCUMENTS[route];
  return render(
    <LegalPage
      route={route}
      title={doc.title}
      summary={doc.summary}
      sections={doc.sections}
      theme="light"
      onToggleTheme={() => {}}
      onGoHome={() => {}}
    />
  );
}

describe('legal pages', () => {
  it('renders a document for every footer destination', () => {
    for (const route of LEGAL_ROUTE_NAMES) {
      const { unmount } = renderLegal(route);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(LEGAL_DOCUMENTS[route].title);
      unmount();
    }
  });

  it('includes the footer with working legal links on every page', () => {
    renderLegal('security');
    expect(screen.getByRole('navigation', { name: /legal and product information/i })).toBeInTheDocument();
  });

  it('describes local-only storage without claiming compositions are uploaded', () => {
    renderLegal('privacy');
    // The claim appears more than once (general storage and audio transcription).
    expect(screen.getAllByText(/never uploaded to us/i).length).toBeGreaterThan(0);
    // It names the actual storage it uses.
    expect(screen.getByText(/musikflo_db/)).toBeInTheDocument();
    expect(screen.getByText(/musikflo_latest_id/)).toBeInTheDocument();
    expect(screen.queryByText(/uploaded to our servers/i)).not.toBeInTheDocument();
  });

  it('explains that transcription runs on the device and does not upload audio', () => {
    renderLegal('privacy');
    expect(screen.getByText(/decoded and analysed entirely inside your browser/i)).toBeInTheDocument();
    expect(screen.getByText(/never uploaded to us or to any third-party service/i)).toBeInTheDocument();
  });

  it('states plainly that no contact channel is configured', () => {
    renderLegal('contact');
    expect(screen.getByText(/no public support, privacy or legal contact address is configured/i)).toBeInTheDocument();
  });

  it('does not claim an external security audit took place', () => {
    renderLegal('security');
    expect(screen.getByText(/has not undergone an independent security audit or penetration test/i)).toBeInTheDocument();
  });

  it('describes cookies accurately rather than assuming they are used', () => {
    renderLegal('cookies');
    expect(screen.getByText(/does not create, read or rely on cookies/i)).toBeInTheDocument();
  });
});
