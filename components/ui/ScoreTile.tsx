import { Meter } from './Meter';

export function ScoreTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="rounded-card border border-gray-4 p-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-gray-2">
        {label}
      </span>
      <strong className="mt-2 block text-2xl font-bold tracking-[-0.03em]">{pct}</strong>
      <Meter value={pct} label={`${label} score`} />
      <span className="mt-2 block text-xs text-gray-2">{caption}</span>
    </div>
  );
}
