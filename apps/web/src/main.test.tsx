import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './main';

describe('TopThis landing shell', () => {
  it('renders the official tagline', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Everything beats something. Top this.' }),
    ).toBeTruthy();
  });
});
