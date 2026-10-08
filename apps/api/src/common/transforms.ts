export function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Blank optional text is treated as not provided. */
export function trimToUndefined({ value }: { value: unknown }): unknown {
  const trimmed = trim({ value });
  return trimmed === '' ? undefined : trimmed;
}

/** Trims each string in a list and drops the blank ones (empty form rows). */
export function trimEachDroppingBlank({ value }: { value: unknown }): unknown {
  if (!Array.isArray(value)) return value;
  return value
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
    .filter((item: unknown) => item !== '');
}
