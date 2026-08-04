import { Card } from '@/components/ui/Card';
import { categoryById } from '@/lib/scoring/categories';
import type { Report } from '@/lib/report/types';

export function FifteenMinute({ data }: { data: Report['fifteenMinute'] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-gray-2">
        <span>15-minute check</span>
        <span className="text-gray-3">{data.met.length} of 9 on foot</span>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {data.met.map((id) => (
          <li key={id} className="rounded-full bg-accent-tint px-3 py-1 text-xs text-gray-1">
            ✓ {categoryById(id).label}
          </li>
        ))}
        {data.missing.map((id) => (
          <li key={id} className="rounded-full bg-gray-5 px-3 py-1 text-xs text-gray-3">
            ✕ {categoryById(id).label}
          </li>
        ))}
      </ul>
    </Card>
  );
}
