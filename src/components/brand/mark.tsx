/**
 * A watch face with a single brass hand. The ring opens where the hand
 * points, so the mark reads as both a clock and a sweep.
 */
export function Mark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none">
      <path
        d="M 13.42 7.05 A 5.5 5.5 0 1 1 8.95 2.58"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M 8 8 L 11.9 4.1" stroke="var(--brass)" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1.25" fill="var(--brass)" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Mark />
      <span className="text-sm font-medium tracking-[-0.01em]">Wallet Watch</span>
    </span>
  );
}
