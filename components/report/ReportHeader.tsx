import type { DataSource, Report } from '@/lib/report/types';

const UNAVAILABLE_LABEL: Record<DataSource, string> = {
  transit: 'Transit data could not be loaded for this address.',
  street: 'Street-network data could not be loaded for this address.',
};

const UNAVAILABLE_CONSEQUENCE: Record<DataSource, string> = {
  transit:
    'Transit shows 0 because we could not retrieve it, not because there is none nearby.',
  street:
    'The urban–suburban index is computed from the remaining signals, so it is less precise than usual.',
};

export function ReportHeader({ report }: { report: Report }) {
  return (
    <>
      <div>
        <h1 className="text-xl">{report.address}</h1>
        <span className="mt-1 block font-mono text-[11px] text-gray-2">
          {report.coordinates.lat.toFixed(4)}, {report.coordinates.lon.toFixed(4)}
        </span>
      </div>

      <div className="flex items-center gap-4 rounded-card bg-charcoal p-5 text-white">
        <span className="text-5xl font-bold leading-none tracking-[-0.04em] text-accent">
          {report.scores.overall}
          <small className="text-base font-normal tracking-normal text-gray-3">/100</small>
        </span>
        <div>
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-gray-3">
            Location score
          </span>
          <span className="text-sm text-gray-4">
            {report.scores.urbanSuburban.band} · walk {report.scores.walk} · transit{' '}
            {report.scores.transit}
          </span>
        </div>
      </div>

      {report.dataSparse && (
        <p
          role="status"
          className="m-0 rounded-btn border-l-[3px] border-gray-3 bg-gray-5 px-4 py-3 text-sm text-gray-2"
        >
          OpenStreetMap has little data for this area, so these scores are based on a thin
          sample. They reflect mapped coverage, not necessarily what is actually there.
        </p>
      )}

      {report.unavailable.length > 0 && (
        <p
          role="status"
          className="m-0 rounded-btn border-l-[3px] border-gray-3 bg-gray-5 px-4 py-3 text-sm text-gray-2"
        >
          {report.unavailable.map((source) => (
            <span key={source}>
              {UNAVAILABLE_LABEL[source]} {UNAVAILABLE_CONSEQUENCE[source]}{' '}
            </span>
          ))}
        </p>
      )}
    </>
  );
}
