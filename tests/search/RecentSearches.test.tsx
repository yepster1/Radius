import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { RecentSearches } from '@/components/search/RecentSearches';
import { addToHistory } from '@/lib/history';

beforeEach(() => localStorage.clear());

describe('RecentSearches', () => {
  it('renders nothing when there is no history', () => {
    const { container } = render(<RecentSearches />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists stored addresses as links to their reports', () => {
    addToHistory({ address: '1600 Pennsylvania Ave NW', slug: 'penn-dqcjqcp' });
    render(<RecentSearches />);
    const link = screen.getByRole('link', { name: '1600 Pennsylvania Ave NW' });
    expect(link).toHaveAttribute('href', '/a/penn-dqcjqcp');
  });

  it('clears the list when Clear is pressed', async () => {
    addToHistory({ address: 'Somewhere', slug: 'x-dqcjqcp' });
    render(<RecentSearches />);
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.queryByText('Somewhere')).not.toBeInTheDocument();
  });
});
