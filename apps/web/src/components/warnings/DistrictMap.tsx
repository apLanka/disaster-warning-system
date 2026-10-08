import 'leaflet/dist/leaflet.css';

import {
  Circle,
  MapContainer,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';

import {
  DISTRICT_INFO,
  districtName,
  nearestDistrict,
  type District,
  type WarningLevel,
} from '@repo/types';

import { levelColor } from '../../lib/warningLevels';

const SRI_LANKA: [number, number] = [7.87, 80.77];
const ZOOM = 7;
const RADIUS_METRES = 18_000;

function ClickToToggle({
  onToggle,
}: {
  onToggle: (district: District) => void;
}) {
  useMapEvents({
    click(event) {
      onToggle(
        nearestDistrict({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        }),
      );
    },
  });
  return null;
}

interface DistrictMapProps {
  districts: District[];
  level: WarningLevel | '';
  onToggle?: (district: District) => void;
}

/**
 * Affected districts as circles in the level's colour (finding UI6). Clicking
 * toggles the nearest district, so the officer never has to draw a shape.
 */
export function DistrictMap({ districts, level, onToggle }: DistrictMapProps) {
  const color = levelColor(level);
  const label =
    districts.length === 0
      ? 'Map of Sri Lanka. No district selected yet.'
      : `Map of the affected area: ${districts.map(districtName).join(', ')}`;

  return (
    <div
      role="img"
      aria-label={label}
      className="border-border h-80 overflow-hidden rounded-lg border"
    >
      <MapContainer
        center={SRI_LANKA}
        zoom={ZOOM}
        scrollWheelZoom={false}
        className="size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {districts.map((district) => {
          const { latitude, longitude } = DISTRICT_INFO[district];
          return (
            <Circle
              key={district}
              center={[latitude, longitude]}
              radius={RADIUS_METRES}
              pathOptions={{ color, fillOpacity: 0.3 }}
            >
              <Tooltip>{districtName(district)}</Tooltip>
            </Circle>
          );
        })}
        {onToggle && <ClickToToggle onToggle={onToggle} />}
      </MapContainer>
    </div>
  );
}
