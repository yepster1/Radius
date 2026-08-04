import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreTiles } from '@/components/report/ScoreTiles';

const scores = {
  walk: 94, drive: 71, transit: 88, errand: 91,
  urbanSuburban: { index: 89, band: 'Dense Urban' as const },
  overall: 87,
};

describe('ScoreTiles', () => {
  it('renders all four scores', () => {
    render(<ScoreTiles scores={scores} />);
    for (const label of ['Walk', 'Drive', 'Transit', 'Errand']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('94')).toBeInTheDocument();
    expect(screen.getByText('71')).toBeInTheDocument();
  });

  it('gives each score an accessible meter', () => {
    render(<ScoreTiles scores={scores} />);
    expect(screen.getAllByRole('meter')).toHaveLength(4);
  });
});
