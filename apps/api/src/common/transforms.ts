export function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Blank optional text is treated as not provided. */
export function trimToUndefined({ value }: { value: unknown }): unknown {
  const trimmed = trim({ value });
  return trimmed === '' ? undefined : trimmed;
}
