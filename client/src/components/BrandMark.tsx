import React from 'react';

interface BrandMarkProps {
  /** 'badge' renders the circular white plate + dark P matching the landing navbar and favicon.svg; 'glyph' renders just the crisp P in currentColor. */
  variant?: 'badge' | 'glyph';
  className?: string;
  label?: string;
}

const P_PATH =
  'M9.5 8H17.8A5 5 0 0 1 17.8 18H12.5V24H9.5V8ZM12.5 10.8V15.2H17.8A2.2 2.2 0 0 0 17.8 10.8H12.5Z';

/**
 * Single-letter geometric 'P' emblem for Prism.
 * Shares exact contour geometry with client/public/favicon.svg.
 */
export function BrandMark({
  variant = 'glyph',
  className = 'w-5 h-5',
  label = 'Prism',
}: BrandMarkProps) {
  if (variant === 'badge') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        fill="none"
        className={className}
        role="img"
        aria-label={label}
      >
        <circle
          cx="16"
          cy="16"
          r="15"
          fill="#FFFFFF"
          stroke="#E4E4E7"
          strokeWidth="1"
        />
        <g transform="translate(16 16) scale(0.92) translate(-16.15 -16)">
          <path fillRule="evenodd" clipRule="evenodd" d={P_PATH} fill="#111827" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="8 7 16.2 18"
      fill="none"
      className={className}
      role="img"
      aria-label={label}
    >
      <path fillRule="evenodd" clipRule="evenodd" d={P_PATH} fill="currentColor" />
    </svg>
  );
}
