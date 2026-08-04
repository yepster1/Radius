import { describe, expect, it } from 'vitest';
import { parseSuggestResponse, parseReverseResponse } from '@/lib/providers/mapbox';

const valid = {
  suggestions: [
    {
      mapbox_id: 'abc123',
      name: '1600 Pennsylvania Avenue NW',
      place_formatted: 'Washington, DC 20500, United States',
    },
    {
      mapbox_id: 'def456',
      name: '1600 Pennsylvania Ave SE',
      place_formatted: 'Washington, DC 20003, United States',
    },
  ],
};

describe('parseSuggestResponse', () => {
  it('maps the Mapbox payload to typed suggestions', () => {
    const parsed = parseSuggestResponse(valid);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      mapboxId: 'abc123',
      primary: '1600 Pennsylvania Avenue NW',
      secondary: 'Washington, DC 20500, United States',
    });
  });

  it('returns an empty array for a malformed payload rather than throwing', () => {
    expect(parseSuggestResponse(null)).toEqual([]);
    expect(parseSuggestResponse({})).toEqual([]);
    expect(parseSuggestResponse({ suggestions: 'nope' })).toEqual([]);
  });

  it('skips entries missing an id or name', () => {
    const partial = { suggestions: [{ mapbox_id: 'x' }, { name: 'y' }, valid.suggestions[0]] };
    expect(parseSuggestResponse(partial)).toHaveLength(1);
  });

  it('defaults a missing place_formatted to an empty string', () => {
    const noPlace = { suggestions: [{ mapbox_id: 'x', name: 'Somewhere' }] };
    expect(parseSuggestResponse(noPlace)[0].secondary).toBe('');
  });
});

describe('parseReverseResponse', () => {
  it('returns the full formatted address', () => {
    const json = {
      features: [{ properties: { full_address: '1600 Pennsylvania Ave NW, Washington, DC 20500' } }],
    };
    expect(parseReverseResponse(json)).toBe('1600 Pennsylvania Ave NW, Washington, DC 20500');
  });

  it('falls back to place_formatted when full_address is absent', () => {
    const json = { features: [{ properties: { place_formatted: 'Washington, DC' } }] };
    expect(parseReverseResponse(json)).toBe('Washington, DC');
  });

  it('returns null for an empty or malformed payload', () => {
    expect(parseReverseResponse({ features: [] })).toBeNull();
    expect(parseReverseResponse(null)).toBeNull();
    expect(parseReverseResponse({})).toBeNull();
  });
});
