import { beforeEach, describe, expect, it } from 'vitest';
import { addToHistory, clearHistory, readHistory } from '@/lib/history';

beforeEach(() => localStorage.clear());

describe('history', () => {
  it('starts empty', () => {
    expect(readHistory()).toEqual([]);
  });

  it('stores and reads back an entry', () => {
    addToHistory({ address: '1600 Pennsylvania Ave NW', slug: 'a-dqcjqcp' });
    expect(readHistory()).toEqual([{ address: '1600 Pennsylvania Ave NW', slug: 'a-dqcjqcp' }]);
  });

  it('puts the most recent entry first', () => {
    addToHistory({ address: 'First', slug: 'one-dqcjqcp' });
    addToHistory({ address: 'Second', slug: 'two-dqcjqcp' });
    expect(readHistory()[0].address).toBe('Second');
  });

  it('de-duplicates by slug and promotes the repeat to the front', () => {
    addToHistory({ address: 'First', slug: 'one-dqcjqcp' });
    addToHistory({ address: 'Second', slug: 'two-dqcjqcp' });
    addToHistory({ address: 'First', slug: 'one-dqcjqcp' });
    const history = readHistory();
    expect(history).toHaveLength(2);
    expect(history[0].slug).toBe('one-dqcjqcp');
  });

  it('caps the list at 8 entries', () => {
    for (let i = 0; i < 12; i += 1) {
      addToHistory({ address: `Address ${i}`, slug: `slug-${i}-dqcjqcp` });
    }
    expect(readHistory()).toHaveLength(8);
  });

  it('clears', () => {
    addToHistory({ address: 'First', slug: 'one-dqcjqcp' });
    clearHistory();
    expect(readHistory()).toEqual([]);
  });

  it('returns an empty list when storage holds malformed JSON', () => {
    localStorage.setItem('radius:history', 'not json');
    expect(readHistory()).toEqual([]);
  });

  it('returns an empty list when storage holds the wrong shape', () => {
    localStorage.setItem('radius:history', '{"nope":true}');
    expect(readHistory()).toEqual([]);
  });
});
