import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NearbyList } from '@/components/report/NearbyList';
import type { Amenity } from '@/lib/report/types';

const amenities: Amenity[] = [
  { id: 1, name: 'Whole Foods', category: 'grocery', lat: 0, lon: 0, distanceM: 320 },
  { id: 2, name: 'Compass Coffee', category: 'cafe', lat: 0, lon: 0, distanceM: 210 },
  { id: 3, name: 'Far Gym', category: 'fitness', lat: 0, lon: 0, distanceM: 4000 },
];

describe('NearbyList', () => {
  it('shows the nearest amenities with walk times', () => {
    render(<NearbyList amenities={amenities} />);
    expect(screen.getByText('Compass Coffee')).toBeInTheDocument();
    expect(screen.getByText('3 min')).toBeInTheDocument(); // 210m / 80 = 2.6 -> 3
  });

  it('excludes anything beyond a 10-minute walk', () => {
    render(<NearbyList amenities={amenities} />);
    expect(screen.queryByText('Far Gym')).not.toBeInTheDocument();
  });

  it('renders an explanatory message when nothing is walkable', () => {
    render(<NearbyList amenities={[amenities[2]]} />);
    expect(screen.getByText(/nothing within a 10-minute walk/i)).toBeInTheDocument();
  });

  it('excludes unnamed amenities (name equal to their category label)', () => {
    const withUnnamed: Amenity[] = [
      ...amenities,
      { id: 4, name: 'Parks', category: 'parks', lat: 0, lon: 0, distanceM: 100 },
    ];
    render(<NearbyList amenities={withUnnamed} />);
    // No parks-category entry in the list is named, so "Parks" — neither as
    // a place name nor a category tag — should not render at all.
    expect(screen.queryByText('Parks')).not.toBeInTheDocument();
  });

  it('dedupes by name and category, keeping the nearest', () => {
    const duplicated: Amenity[] = [
      { id: 5, name: 'Rose Garden', category: 'parks', lat: 0, lon: 0, distanceM: 300 },
      { id: 6, name: 'Rose Garden', category: 'parks', lat: 0, lon: 0, distanceM: 150 },
    ];
    render(<NearbyList amenities={duplicated} />);
    expect(screen.getAllByText('Rose Garden')).toHaveLength(1);
    expect(screen.getByText('2 min')).toBeInTheDocument(); // 150m / 80 = 1.9 -> 2, the nearer one
  });

  it('keeps the header count as the total walkable amenities, unfiltered', () => {
    const withUnnamedAndDuplicates: Amenity[] = [
      ...amenities, // 2 walkable: Whole Foods, Compass Coffee
      { id: 4, name: 'Parks', category: 'parks', lat: 0, lon: 0, distanceM: 100 }, // unnamed, walkable
      { id: 5, name: 'Rose Garden', category: 'parks', lat: 0, lon: 0, distanceM: 300 },
      { id: 6, name: 'Rose Garden', category: 'parks', lat: 0, lon: 0, distanceM: 150 },
    ];
    render(<NearbyList amenities={withUnnamedAndDuplicates} />);
    // 5 total within the 800m walkable radius, even though only 3 named,
    // deduped rows are listed below.
    expect(screen.getByText('5 within a 10-minute walk')).toBeInTheDocument();
  });
});
