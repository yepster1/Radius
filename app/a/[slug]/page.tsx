import Link from 'next/link';
import { notFound } from 'next/navigation';
import { parseSlug } from '@/lib/geo/slug';
import { reverseGeocode } from '@/lib/providers/mapbox';
import { buildReport } from '@/lib/report/buildReport';
import { ReportHeader } from '@/components/report/ReportHeader';
import { ScoreTiles } from '@/components/report/ScoreTiles';
import { NearbyList } from '@/components/report/NearbyList';
import { UrbanSuburbanBar } from '@/components/report/UrbanSuburbanBar';
import { FifteenMinute } from '@/components/report/FifteenMinute';
import { ReportMap } from '@/components/report/ReportMap';
import { RecordVisit } from '@/components/report/RecordVisit';

/**
 * Last-resort label if reverse geocoding is unavailable. The slug's readable
 * portion is lossy — it cannot recover "NW" from "nw" or restore commas — so
 * this is a fallback, never the primary source.
 */
function humanise(slug: string): string {
  return slug
    .split('-')
    .slice(0, -1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const coords = parseSlug(slug);
  if (!coords) notFound();

  // Resolve the canonical address from coordinates. The slug is decorative.
  const canonical = await reverseGeocode(coords);
  const report = await buildReport(canonical ?? humanise(slug), coords);

  return (
    <main className="min-h-screen">
      <nav className="flex items-center gap-5 border-b border-gray-4 px-6 py-4">
        <Link href="/" className="text-base font-bold tracking-[-0.03em] text-gray-1 no-underline">
          rad<span className="text-accent">ius</span>
        </Link>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-4 p-6">
        <ReportHeader report={report} />
        <RecordVisit address={report.address} slug={slug} />
        <ScoreTiles scores={report.scores} />
        <div className="grid gap-4 md:grid-cols-2">
          <ReportMap report={report} />
          <NearbyList amenities={report.amenities} />
          <div className="grid content-start gap-4">
            <UrbanSuburbanBar value={report.scores.urbanSuburban} />
            <FifteenMinute data={report.fifteenMinute} />
          </div>
        </div>
      </div>
    </main>
  );
}
