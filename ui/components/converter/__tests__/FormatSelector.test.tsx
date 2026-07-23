import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormatSelector } from '../FormatSelector';

describe('FormatSelector', () => {
  it('renders the selected format and its description', () => {
    render(<FormatSelector value="webp" onChange={() => {}} />);
    expect(screen.getAllByText(/WebP/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Best compression for web/i),
    ).toBeInTheDocument();
  });

  it('renders a different description when format changes', () => {
    const { rerender } = render(<FormatSelector value="webp" onChange={() => {}} />);
    expect(screen.getByText(/Best compression for web/i)).toBeInTheDocument();
    rerender(<FormatSelector value="avif" onChange={vi.fn()} />);
    expect(screen.getByText(/Smallest file size/i)).toBeInTheDocument();
  });

  it('has a label associated with the trigger', () => {
    render(<FormatSelector value="png" onChange={() => {}} />);
    expect(screen.getByLabelText(/output format/i)).toBeInTheDocument();
  });
});
