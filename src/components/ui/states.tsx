export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-y border-line py-16">
      <h3 className="text-2xl tracking-tight">{title}</h3>
      <p className="mt-3 max-w-md text-muted">{body}</p>
    </div>
  );
}

export function ErrorState({
  title,
  body,
  technical,
  onRetry,
}: {
  title: string;
  body: string;
  technical?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="max-w-xl py-16">
      <h2 className="text-4xl tracking-tight">{title}</h2>
      <p className="mt-4 text-muted">{body}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-8 h-10 border border-line px-4 text-sm active:translate-y-px"
        >
          Try again
        </button>
      ) : null}
      {technical ? (
        <details className="mt-8 text-sm text-faint">
          <summary className="cursor-pointer">View technical details</summary>
          <pre className="mt-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap">{technical}</pre>
        </details>
      ) : null}
    </div>
  );
}

export function LoadingLine({ label }: { label: string }) {
  return (
    <div className="py-24">
      <p className="eyebrow">Wallet</p>
      <p className="mt-5 text-3xl tracking-tight">{label}</p>
    </div>
  );
}
