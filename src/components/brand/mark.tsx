export function Mark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="8" cy="8" r="1.1" fill="var(--brass)" />
    </svg>
  );
}
