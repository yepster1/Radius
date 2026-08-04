import Link from 'next/link';
import { AddressSearch } from '@/components/search/AddressSearch';
import { RecentSearches } from '@/components/search/RecentSearches';
import { SiteNav } from '@/components/ui/SiteNav';

/**
 * A cold visitor has no search history and no reason to know which addresses
 * show the scoring off. These four are the reference locations the scoring was
 * calibrated against, so they span the full range of the index rather than all
 * landing in the same band. Slugs are literal because they are content, not
 * derived state — the geohash is what `parseSlug` reads.
 */
const EXAMPLES = [
  { label: 'New York, NY', slug: '350-5th-ave-new-york-ny-dr5ru6j' },
  { label: 'Washington, DC', slug: '1600-pennsylvania-ave-nw-washington-dc-dqcjqcp' },
  { label: 'Brookline, MA', slug: 'beacon-st-brookline-ma-drt3jcg' },
  { label: 'Plano, TX', slug: 'legacy-dr-plano-tx-9vghpnh' },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-charcoal">
      <SiteNav />

      <main className="flex flex-1 flex-col justify-center px-6 py-20 text-center">
        <h1 className="mx-auto mb-4 max-w-[16ch] text-4xl text-white sm:text-5xl">
          Know the address before you list it.
        </h1>
        <p className="mx-auto mb-8 max-w-[52ch] text-gray-3">
          Walkability, transit, nearby businesses and how urban the area is — for any US address, in one page.
        </p>
        <AddressSearch />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-3">
            Try
          </span>
          {EXAMPLES.map((example) => (
            <Link
              key={example.slug}
              href={`/a/${example.slug}`}
              className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[11px] text-gray-3 no-underline"
            >
              {example.label}
            </Link>
          ))}
        </div>

        <RecentSearches />
      </main>

      {/* gray-3, not gray-2: #4b5563 on charcoal is about 2.6:1, below the 4.5:1
          WCAG AA floor for text this size. */}
      <footer className="px-6 py-6 text-center font-mono text-[11px] text-gray-3">
        Every score is computed here from OpenStreetMap geometry — no black-box index.
      </footer>
    </div>
  );
}
