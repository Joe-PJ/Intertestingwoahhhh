import { useId } from 'react';

interface VampireMarkProps {
  /** Rendered size in px (square). */
  size?: number;
  /** Accessible name. Omit when the mark sits next to visible text that already names it. */
  title?: string;
  className?: string;
}

/**
 * The Day Walker mark: a vampire in a high collar against a blood moon.
 * Drawn from palette tokens so it follows theme changes; the same drawing
 * ships as public/day-walker.svg for the favicon.
 */
export function VampireMark({ size = 64, title, className }: VampireMarkProps) {
  const clipId = useId();
  const labelled = Boolean(title);
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {labelled && <title>{title}</title>}
      <clipPath id={clipId}>
        <circle cx="32" cy="32" r="31" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {/* Moon */}
        <circle cx="32" cy="32" r="31" fill="var(--color-accent)" />
        {/* Cape and high collar */}
        <path d="M-2 66 8 30l15 16 9 6 9-6 15-16 10 36Z" fill="var(--color-bg)" />
        <path d="M23 46 32 64l9-18-9 6Z" fill="var(--color-text)" />
        {/* Face */}
        <ellipse cx="32" cy="32" rx="11.5" ry="14.5" fill="var(--color-text)" />
        {/* Hair with a widow's peak */}
        <path
          d="M19.4 32c-.9-12 4.8-17 12.6-17s13.5 5 12.6 17c-2.4-5.6-6.6-7.8-12.6-2.2-6-5.6-10.2-3.4-12.6 2.2Z"
          fill="var(--color-bg)"
        />
        {/* Eyes */}
        <path d="M24.6 34q2.8-2.4 5.6.4-2.8.8-5.6-.4Z" fill="var(--color-accent)" />
        <path d="M39.4 34q-2.8-2.4-5.6.4 2.8.8 5.6-.4Z" fill="var(--color-accent)" />
        {/* Mouth and fangs */}
        <path d="M27 40q5 1.4 10 0-1.3 4.2-5 4.2T27 40Z" fill="var(--color-bg)" />
        <path d="m28.8 40.5 1.1 2.9 1-2.6Zm6.4 0-1.1 2.9-1-2.6Z" fill="var(--color-text)" />
      </g>
    </svg>
  );
}
