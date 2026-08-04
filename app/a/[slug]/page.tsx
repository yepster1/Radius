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
import { SiteNav } from '@/components/ui/SiteNav';

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
      <SiteNav />

      <div className="mx-auto grid max-w-6xl gap-4 p-6">
        <ReportHeader report={report} />
        <RecordVisit address={report.address} slug={slug} />
        <ScoreTiles scores={report.scores} />
        {/* Two rows of two rather than one three-child grid: with three children
            in a two-column grid the third lands bottom-left and leaves an empty
            half-width column beside it. */}
        <div className="grid gap-4 md:grid-cols-2">
          <ReportMap report={report} />
          <NearbyList amenities={report.amenities} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <UrbanSuburbanBar value={report.scores.urbanSuburban} />
          <FifteenMinute data={report.fifteenMinute} />
        </div>
      </div>
    </main>
  );
}
