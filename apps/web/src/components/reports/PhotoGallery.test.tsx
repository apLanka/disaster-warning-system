import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { HazardPhoto } from '@repo/types';

import { PhotoGallery } from './PhotoGallery';

function photo(n: number): HazardPhoto {
  return {
    publicId: `hazard-reports/p${n}`,
    secureUrl: `https://res.cloudinary.com/demo/image/upload/v1/hazard-reports/p${n}.jpg`,
    width: 800,
    height: 600,
    bytes: 1000,
  };
}

describe('PhotoGallery', () => {
  it('says so when no photo was attached', () => {
    render(<PhotoGallery photos={[]} />);

    expect(screen.getByText('No photo attached')).toBeInTheDocument();
  });

  it('shows the first photo, resized, linking to the full image', () => {
    render(<PhotoGallery photos={[photo(1)]} />);

    const image = screen.getByRole('img', { name: 'Photo evidence 1 of 1' });
    expect(image).toHaveAttribute(
      'src',
      expect.stringContaining('c_fill,w_800,h_450'),
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      photo(1).secureUrl,
    );
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noreferrer');
  });

  it('shows no thumbnails for a single photo', () => {
    render(<PhotoGallery photos={[photo(1)]} />);

    expect(
      screen.queryByRole('list', { name: 'Photo thumbnails' }),
    ).not.toBeInTheDocument();
  });

  it('lets the officer switch between several photos', async () => {
    render(<PhotoGallery photos={[photo(1), photo(2), photo(3)]} />);

    expect(
      screen.getByRole('button', { name: 'Show photo 1' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Show photo 3' }));

    expect(
      screen.getByRole('img', { name: 'Photo evidence 3 of 3' }),
    ).toHaveAttribute('src', expect.stringContaining('p3.jpg'));
    expect(
      screen.getByRole('button', { name: 'Show photo 3' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Show photo 1' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
