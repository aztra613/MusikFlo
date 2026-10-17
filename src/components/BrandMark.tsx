import React from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/** The MusikFlo mark: three staff rules with a notehead and stem. */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 20, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={`fill-current ${className}`} aria-hidden="true">
    <line x1="3" y1="7" x2="21" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="3" y1="17" x2="21" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <ellipse cx="10" cy="12" rx="3" ry="2.2" transform="rotate(-20 10 12)" fill="currentColor" />
    <line x1="12.5" y1="11" x2="12.5" y2="3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);
