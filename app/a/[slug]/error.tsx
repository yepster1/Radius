'use client';

import Link from 'next/link';
import { SiteNav } from '@/components/ui/SiteNav';

/**
 * Shown when `buildReport` cannot get amenity data — almost always because the
 * public OpenStreetMap Overpass mirrors are overloaded, which happens often
 * enough to be a normal condition rather than an exceptional one. A stack trace
 * would tell the visitor nothing useful; naming the dependency and offering a
 * retry does.
 */
export default function ReportError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen">
      <SiteNav />

      <div className="mx-auto max-w-xl p-16 text-center">
        <h1 className="mb-3 text-3xl">Couldn&rsquo;t build this report</h1>
        <p className="mb-2 text-gray-2">
          The OpenStreetMap data service didn&rsquo;t respond in time. It&rsquo;s a free,
          shared service and it throttles under load, so this is usually temporary.
        </p>
        <p className="mb-6 text-sm text-gray-3">
          Nothing is wrong with the address — we just couldn&rsquo;t fetch what surrounds it.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-btn bg-accent px-6 py-3 font-mono text-sm text-white"
        >
          Try again
        </button>
        <p className="mt-6">
          <Link href="/" className="font-mono text-sm text-accent">
            &larr; Search another address
          </Link>
        </p>
      </div>
    </main>
  );
}
