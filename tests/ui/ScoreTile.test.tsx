import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreTile } from '@/components/ui/ScoreTile';

describe('ScoreTile', () => {
  it('renders the label, value and caption', () => {
    render(<ScoreTile label="Walk" value={94} caption="Daily errands on foot" />);
    expect(screen.getByText('Walk')).toBeInTheDocument();
    expect(screen.getByText('94')).toBeInTheDocument();
    expect(screen.getByText('Daily errands on foot')).toBeInTheDocument();
  });

  it('exposes the score to assistive tech as a meter', () => {
    render(<ScoreTile label="Walk" value={94} caption="Daily errands on foot" />);
    const meter = screen.getByRole('meter', { name: /walk score/i });
    expect(meter).toHaveAttribute('aria-valuenow', '94');
  });

  it('clamps an out-of-range value into 0-100', () => {
    render(<ScoreTile label="Walk" value={140} caption="x" />);
    expect(screen.getByRole('meter', { name: /walk score/i }))
      .toHaveAttribute('aria-valuenow', '100');
  });
});
