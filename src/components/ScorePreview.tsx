import React, { useEffect, useRef } from 'react';
import { Score } from '../types/music';
import { DEFAULT_LAYOUT, totalHeight, totalWidth } from '../score/geometry';
import { DARK_NOTATION_PALETTE, LIGHT_NOTATION_PALETTE, renderScoreInto } from '../score/renderScore';

interface ScorePreviewProps {
  score: Score;
  theme: 'light' | 'dark';
  /** Displayed width multiplier; the preview scales to its container. */
  zoom?: number;
}

/**
 * Read-only engraving of a candidate score, used by the transcription review step.
 *
 * Deliberately separate from `ScoreCanvas`: the review step must not mount the
 * editing surface, hit-testing or selection state, so it cannot interfere with the
 * composition the user already has open.
 */
export const ScorePreview: React.FC<ScorePreviewProps> = ({ score, theme, zoom = 1 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = theme === 'dark' ? DARK_NOTATION_PALETTE : LIGHT_NOTATION_PALETTE;
    const rendered = renderScoreInto(container, { score, palette, background: undefined });

    const width = totalWidth(DEFAULT_LAYOUT);
    const height = totalHeight(score.measures.length, DEFAULT_LAYOUT);

    if (rendered.svg) {
      rendered.svg.style.width = `${width * zoom}px`;
      rendered.svg.style.height = `${height * zoom}px`;
      rendered.svg.style.display = 'block';
      rendered.svg.style.maxWidth = '100%';
      rendered.svg.style.height = 'auto';
    }

    return () => {
      container.innerHTML = '';
    };
  }, [score, theme, zoom]);

  return (
    <div
      className="w-full overflow-auto rounded-lg border border-border bg-paper p-3"
      data-testid="transcription-preview"
    >
      <div ref={containerRef} className="w-full" />
    </div>
  );
};
