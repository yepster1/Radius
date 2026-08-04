import { Card } from '@/components/ui/Card';
import { Meter } from '@/components/ui/Meter';
import type { Scores } from '@/lib/report/types';

export function UrbanSuburbanBar({ value }: { value: Scores['urbanSuburban'] }) {
  return (
    <Card>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-2">
        Urban ↔ suburban
      </div>
      <Meter value={value.index} label="Urban to suburban index" />
      <div className="mt-2 flex justify-between font-mono text-[10px]">
        <span className="text-gray-2">RURAL</span>
        <span className="text-accent">
          {value.band.toUpperCase()} · {value.index}
        </span>
      </div>
    </Card>
  );
}
