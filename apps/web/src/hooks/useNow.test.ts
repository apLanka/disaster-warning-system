import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the current time', () => {
    const { result } = renderHook(() => useNow());

    expect(result.current.toISOString()).toBe('2026-10-05T10:00:00.000Z');
  });

  it('moves forward every minute', () => {
    const { result } = renderHook(() => useNow());

    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.toISOString()).toBe('2026-10-05T10:01:00.000Z');
  });

  it('stops ticking after unmount', () => {
    const { unmount } = renderHook(() => useNow());

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
