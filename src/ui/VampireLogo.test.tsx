import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VampireLogo } from './VampireLogo';

const favicon = readFileSync(resolve(__dirname, '../../public/favicon.svg'), 'utf8');
const shapes = (markup: string) => [...markup.matchAll(/\s(?:d|cx|cy|r|rx|ry)="([^"]+)"/g)].map((m) => m[1]);

describe('VampireLogo', () => {
  it('is an image with an accessible name', () => {
    render(<VampireLogo />);
    expect(screen.getByRole('img', { name: 'Day Walker vampire logo' })).toBeInTheDocument();
  });

  it('draws the same shapes as the favicon', () => {
    const { container } = render(<VampireLogo />);
    expect(shapes(container.innerHTML)).toEqual(shapes(favicon));
  });
});
