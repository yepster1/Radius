import { Card } from '@/components/ui/Card';
import { ScoreTile } from '@/components/ui/ScoreTile';

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-4xl text-charcoal">Radius</h1>
        <p className="mt-2 text-gray-2">
          Know the address before you list it.
        </p>
      </div>
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ScoreTile label="Walk" value={94} caption="Daily errands on foot" />
          <ScoreTile label="Transit" value={78} caption="Nearby transit access" />
          <ScoreTile label="Drive" value={62} caption="Typical commute ease" />
          <ScoreTile label="Errand" value={85} caption="Nearby businesses" />
        </div>
      </Card>
    </main>
  );
}
