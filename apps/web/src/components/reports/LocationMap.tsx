import 'leaflet/dist/leaflet.css';

import { MapContainer, CircleMarker, TileLayer } from 'react-leaflet';

import type { GeoLocation } from '@repo/types';

import { formatCoordinates } from '../../lib/format';

const ZOOM = 15;

export function LocationMap({ location }: { location: GeoLocation }) {
  const center: [number, number] = [location.latitude, location.longitude];
  const { latitude, longitude } = location;

  return (
    <div>
      <div
        role="img"
        aria-label={`Map showing the reported location at ${formatCoordinates(location)}`}
        className="border-border h-56 overflow-hidden rounded-lg border"
      >
        <MapContainer
          center={center}
          zoom={ZOOM}
          scrollWheelZoom={false}
          className="size-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CircleMarker
            center={center}
            radius={10}
            pathOptions={{ color: '#c1392b', fillOpacity: 0.6 }}
          />
        </MapContainer>
      </div>
      <p className="mt-2 flex items-center justify-between text-sm">
        <span className="font-mono">{formatCoordinates(location)}</span>
        <a
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${ZOOM}/${latitude}/${longitude}`}
          target="_blank"
          rel="noreferrer"
          className="text-orange font-semibold"
        >
          Open full map<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}
