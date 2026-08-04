export type HistoryEntry = { address: string; slug: string };

const KEY = 'radius:history';
const MAX_ENTRIES = 8;

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const { address, slug } = value as Record<string, unknown>;
  return typeof address === 'string' && typeof slug === 'string';
}

export function readHistory(): HistoryEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

export function addToHistory(entry: HistoryEntry): void {
  if (typeof localStorage === 'undefined') return;
  const next = [entry, ...readHistory().filter((e) => e.slug !== entry.slug)].slice(
    0,
    MAX_ENTRIES,
  );
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearHistory(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}
