import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddressSearch } from '@/components/search/AddressSearch';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const suggestions = [
  { mapboxId: 'a', primary: '1600 Pennsylvania Avenue NW', secondary: 'Washington, DC' },
  { mapboxId: 'b', primary: '1600 Pennsylvania Ave SE', secondary: 'Washington, DC' },
];

beforeEach(() => {
  push.mockReset();
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes('id=')) {
      return new Response(JSON.stringify({
        address: '1600 Pennsylvania Avenue NW, Washington, DC',
        lat: 38.8977, lon: -77.0365,
      }));
    }
    return new Response(JSON.stringify({ suggestions }));
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('AddressSearch', () => {
  it('exposes correct combobox semantics', () => {
    render(<AddressSearch />);
    const input = screen.getByRole('combobox', { name: /address/i });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('shows suggestions after typing at least 3 characters', async () => {
    const user = userEvent.setup();
    render(<AddressSearch />);
    await user.type(screen.getByRole('combobox'), '1600 Penn');
    expect(await screen.findByText('1600 Pennsylvania Avenue NW')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not query for fewer than 3 characters', async () => {
    const user = userEvent.setup();
    render(<AddressSearch />);
    await user.type(screen.getByRole('combobox'), '16');
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates to the report on selection', async () => {
    const user = userEvent.setup();
    render(<AddressSearch />);
    await user.type(screen.getByRole('combobox'), '1600 Penn');
    await user.click(await screen.findByText('1600 Pennsylvania Avenue NW'));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push.mock.calls[0][0]).toMatch(/^\/a\/1600-pennsylvania-avenue-nw-washington-dc-[0-9a-z]{7}$/);
  });

  it('supports arrow-key navigation and Enter', async () => {
    const user = userEvent.setup();
    render(<AddressSearch />);
    const input = screen.getByRole('combobox');
    await user.type(input, '1600 Penn');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push.mock.calls[0][0]).toContain('1600-pennsylvania-ave-se');
  });

  it('closes the list on Escape', async () => {
    const user = userEvent.setup();
    render(<AddressSearch />);
    await user.type(screen.getByRole('combobox'), '1600 Penn');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });
});
