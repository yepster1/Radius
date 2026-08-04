import Link from 'next/link';

/**
 * The one piece of chrome every route shares. Landing, report, loading, error
 * and not-found each rendered their own bar before — the report's was light and
 * the landing's dark, so navigating between them read as leaving the site.
 * Keeping the bar charcoal everywhere makes the dark hero and the light report
 * surfaces read as two parts of one product rather than two products.
 */
export function SiteNav() {
  return (
    <nav className="flex items-center gap-5 border-b border-white/10 bg-charcoal px-6 py-4">
      <Link
        href="/"
        className="text-base font-bold tracking-[-0.03em] text-white no-underline"
      >
        rad<span className="text-accent">ius</span>
      </Link>
    </nav>
  );
}
