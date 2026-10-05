import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LocationMap } from './LocationMap';

// Leaflet needs a real browser layout engine, so the map itself is stubbed and
// the test checks what the component hands to it.
const mapProps = vi.fn();
vi.mock('react-leaflet', () => ({
  MapContainer: (props: { children: React.ReactNode }) => {
    mapProps(props);
    return <div data-testid="map">{props.children}</div>;
  },
  TileLayer: () => <div data-testid="tiles" />,
  CircleMarker: () => <div data-testid="marker" />,
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

describe('LocationMap', () => {
  const location = { latitude: 7.2906, longitude: 80.6337 };

  it('centres the map on the reported location with a marker', () => {
    render(<LocationMap location={location} />);

    expect(mapProps).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [7.2906, 80.6337],
        zoom: 15,
        scrollWheelZoom: false,
      }),
    );
    expect(screen.getByTestId('marker')).toBeInTheDocument();
  });

  it('describes the map and prints the coordinates as text', () => {
    render(<LocationMap location={location} />);

    expect(
      screen.getByRole('img', {
        name: 'Map showing the reported location at 7.2906° N, 80.6337° E',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('7.2906° N, 80.6337° E')).toBeInTheDocument();
  });

  it('links to the full map in a new tab', () => {
    render(<LocationMap location={location} />);

    const link = screen.getByRole('link', { name: /Open full map/ });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('mlat=7.2906&mlon=80.6337'),
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});
