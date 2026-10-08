import { X } from 'lucide-react';
import { useState } from 'react';

import { DISTRICT_KEYS, districtName, type District } from '@repo/types';

import { Field, INPUT_CLASSES } from '../ui/Field';

const MAX_MATCHES = 6;

interface DistrictPickerProps {
  value: District[];
  onChange: (districts: District[]) => void;
  error?: string;
}

/** Selected districts as removable chips, plus a search box that suggests the rest. */
export function DistrictPicker({
  value,
  onChange,
  error,
}: DistrictPickerProps) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches =
    needle === ''
      ? []
      : DISTRICT_KEYS.filter(
          (district) =>
            !value.includes(district) &&
            districtName(district).toLowerCase().includes(needle),
        ).slice(0, MAX_MATCHES);

  function add(district: District) {
    onChange([...value, district]);
    setQuery('');
  }

  return (
    <Field
      label="Affected districts"
      htmlFor="district-search"
      required
      error={error}
      hint="Type to search, or click near a district on the map."
    >
      <div className="space-y-2">
        {value.length > 0 && (
          <ul aria-label="Selected districts" className="flex flex-wrap gap-2">
            {value.map((district) => (
              <li key={district}>
                <span className="bg-neutral-tint inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-xs font-semibold">
                  {districtName(district)}
                  <button
                    type="button"
                    aria-label={`Remove ${districtName(district)}`}
                    onClick={() =>
                      onChange(value.filter((item) => item !== district))
                    }
                    className="hover:bg-border rounded-full p-1"
                  >
                    <X aria-hidden="true" className="size-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <input
          id="district-search"
          type="search"
          autoComplete="off"
          placeholder="Type to search districts…"
          className={INPUT_CLASSES}
          value={query}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'district-search-error' : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && matches[0]) {
              event.preventDefault();
              add(matches[0]);
            }
          }}
        />
        {matches.length > 0 && (
          <ul
            aria-label="Matching districts"
            className="border-border divide-border divide-y rounded-lg border"
          >
            {matches.map((district) => (
              <li key={district}>
                <button
                  type="button"
                  onClick={() => add(district)}
                  className="hover:bg-page w-full px-3 py-2 text-left text-sm"
                >
                  {districtName(district)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
