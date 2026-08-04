'use client';

import { useEffect } from 'react';
import { addToHistory } from '@/lib/history';

/** Renders nothing — its only job is to record the visit client-side. */
export function RecordVisit({ address, slug }: { address: string; slug: string }) {
  useEffect(() => addToHistory({ address, slug }), [address, slug]);
  return null;
}
