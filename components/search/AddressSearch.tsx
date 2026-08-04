'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { buildSlug } from '@/lib/geo/slug';
import type { AddressSuggestion } from '@/lib/report/types';

const DEBOUNCE_MS = 250;
const MIN_QUERY = 3;

export function AddressSearch() {
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  // One session token per widget instance — Mapbox bills per session, not per
  // keystroke. Lazily initialised: `useRef(crypto.randomUUID())` would call it
  // on every render and discard the result, and it throws outside a secure context.
  const session = useRef<string | null>(null);
  if (session.current === null) session.current = crypto.randomUUID();

  // Set when `select` rewrites the query, so the debounce effect skips the run
  // that change triggers. Without it every selection fires one more billable
  // autocomplete call and can reopen the list with stale results after the
  // user has already chosen.
  const skipNextQuery = useRef(false);

  useEffect(() => {
    if (skipNextQuery.current) {
      skipNextQuery.current = false;
      return;
    }

    // The short-query reset lives in onQueryChange (an event handler), not
    // here — calling setState synchronously in an effect body just to derive
    // state trips react-hooks/set-state-in-effect and causes an extra render.
    if (query.trim().length < MIN_QUERY) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/autocomplete?q=${encodeURIComponent(query)}&session=${session.current}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { suggestions?: AddressSuggestion[] };
        setSuggestions(json.suggestions ?? []);
        setOpen((json.suggestions ?? []).length > 0);
        setActive(-1);
      } catch {
        // Aborted or offline — leave the previous list in place.
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const select = useCallback(
    async (suggestion: AddressSuggestion) => {
      setOpen(false);
      skipNextQuery.current = true;
      setQuery(suggestion.primary);

      try {
        const res = await fetch(
          `/api/autocomplete?id=${encodeURIComponent(suggestion.mapboxId)}&session=${session.current}`,
        );
        if (!res.ok) return;

        const { lat, lon } = (await res.json()) as { lat: number; lon: number };

        // The slug's readable prefix is decorative (see lib/geo/slug.ts) — the
        // geohash suffix is the payload. Build the text from the suggestion the
        // user actually picked, since that's what's already on screen; only
        // the coordinates need to come from the retrieve call.
        const address = [suggestion.primary, suggestion.secondary].filter(Boolean).join(', ');
        router.push(`/a/${buildSlug(address, lat, lon)}`);
      } catch {
        // Network failure or malformed JSON: stay put rather than reject unhandled.
      }
    },
    [router],
  );

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < MIN_QUERY) {
      setSuggestions([]);
      setOpen(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void select(suggestions[Math.max(0, active)]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-xl text-left">
      <input
        type="text"
        role="combobox"
        aria-label="Address"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listboxId}-${active}` : undefined}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Enter a US address"
        className="w-full rounded-btn px-4 py-4 text-base text-gray-1 shadow-lg outline-none"
      />

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-10 mt-2 w-full overflow-hidden rounded-btn bg-white shadow-xl"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.mapboxId}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                void select(s);
              }}
              className={`cursor-pointer border-b border-gray-4 px-4 py-3 last:border-b-0 ${
                i === active ? 'bg-accent-tint' : ''
              }`}
            >
              <span className="block text-sm font-medium text-gray-1">{s.primary}</span>
              <span className="block text-xs text-gray-2">{s.secondary}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
