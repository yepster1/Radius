'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { clearHistory, readHistory, type HistoryEntry } from '@/lib/history';

// localStorage is an external, mutable data source (React doesn't own it and
// same-tab writes fire no `storage` event), so it's read via
// useSyncExternalStore rather than useEffect + setState. That also gives us
// SSR safety for free: getServerSnapshot returns an empty list on the server,
// and React reconciles it with the real client value after hydration without
// any component code calling setState directly inside an effect.
const EMPTY: HistoryEntry[] = [];
const listeners = new Set<() => void>();
let cached: HistoryEntry[] = EMPTY;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function sameEntries(a: HistoryEntry[], b: HistoryEntry[]): boolean {
  return (
    a.length === b.length &&
    a.every((entry, i) => entry.slug === b[i]?.slug && entry.address === b[i]?.address)
  );
}

function getSnapshot(): HistoryEntry[] {
  const next = readHistory();
  if (!sameEntries(next, cached)) cached = next;
  return cached;
}

function getServerSnapshot(): HistoryEntry[] {
  return EMPTY;
}

/** Called after any local mutation so subscribed components re-read the list. */
function notify(): void {
  listeners.forEach((listener) => listener());
}

export function RecentSearches() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (entries.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-3">
          Recent
        </span>
        <button
          type="button"
          onClick={() => {
            clearHistory();
            notify();
          }}
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-3 underline"
        >
          Clear
        </button>
      </div>

      <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/a/${entry.slug}`}
              className="block rounded-full border border-white/20 px-3 py-1.5 font-mono text-[11px] text-gray-3 no-underline"
            >
              {entry.address}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
