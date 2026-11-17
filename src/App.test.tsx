import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the Day Walker heading and OpenStreetMap credit', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Day Walker' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OpenStreetMap contributors' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    );
  });
});
