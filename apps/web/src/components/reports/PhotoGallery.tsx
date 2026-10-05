import { ImageOff } from 'lucide-react';
import { useState } from 'react';

import type { HazardPhoto } from '@repo/types';

import { thumbnailUrl } from '../../lib/cloudinary';
import { EmptyState } from '../ui/EmptyState';

export function PhotoGallery({ photos }: { photos: HazardPhoto[] }) {
  const [selected, setSelected] = useState(0);

  if (photos.length === 0) {
    return (
      <EmptyState
        icon={<ImageOff className="size-8" />}
        title="No photo attached"
        description="Review the description and location instead."
      />
    );
  }

  const main = photos[selected] ?? photos[0]!;

  return (
    <div className="space-y-3">
      <a
        href={main.secureUrl}
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        <img
          src={thumbnailUrl(main.secureUrl, 800, 450)}
          alt={`Photo evidence ${selected + 1} of ${photos.length}`}
          className="bg-neutral-tint aspect-video w-full rounded-lg object-cover"
        />
        <span className="sr-only">Open the full size photo in a new tab</span>
      </a>

      {photos.length > 1 && (
        <ul className="flex flex-wrap gap-2" aria-label="Photo thumbnails">
          {photos.map((photo, index) => (
            <li key={photo.publicId}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-pressed={index === selected}
                className={`overflow-hidden rounded-lg border-2 ${
                  index === selected ? 'border-orange' : 'border-transparent'
                }`}
              >
                <img
                  src={thumbnailUrl(photo.secureUrl)}
                  alt=""
                  className="h-14 w-20 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
