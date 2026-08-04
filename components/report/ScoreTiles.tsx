import { ScoreTile } from '@/components/ui/ScoreTile';
import type { Scores } from '@/lib/report/types';

export function ScoreTiles({ scores }: { scores: Scores }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <ScoreTile label="Walk" value={scores.walk} caption="Daily errands on foot" />
      <ScoreTile label="Drive" value={scores.drive} caption="Reach within 8 km" />
      <ScoreTile label="Transit" value={scores.transit} caption="Stops and routes nearby" />
      <ScoreTile label="Errand" value={scores.errand} caption="15-minute needs met" />
    </div>
  );
}
