import { formatHour } from "@/lib/format";

export function ActivityClock({ hours, start }: { hours: number[]; start: number }) {
  const max = Math.max(1, ...hours);
  const cx = 140;
  const cy = 140;

  return (
    <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
      <svg viewBox="0 0 280 280" className="h-72 w-72" role="img" aria-label="Activity by hour">
        <circle cx={cx} cy={cy} r={72} fill="none" stroke="var(--line)" />
        {hours.map((count, hour) => {
          const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
          const length = 10 + (count / max) * 42;
          const inner = 78;
          const x1 = round(cx + Math.cos(angle) * inner);
          const y1 = round(cy + Math.sin(angle) * inner);
          const x2 = round(cx + Math.cos(angle) * (inner + length));
          const y2 = round(cy + Math.sin(angle) * (inner + length));
          const active = inWindow(hour, start);
          return (
            <line
              key={hour}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={active ? "var(--brass)" : "var(--line-strong)"}
              strokeWidth={active ? 2 : 1}
            />
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--ink)" fontSize="16">
          {formatHour(start)}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="var(--faint)" fontSize="11">
          {formatHour((start + 4) % 24)} UTC
        </text>
      </svg>
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function inWindow(hour: number, start: number) {
  for (let offset = 0; offset < 4; offset += 1) {
    if ((start + offset) % 24 === hour) return true;
  }
  return false;
}
