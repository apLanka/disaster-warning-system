import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useResource } from './useResource';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useResource', () => {
  it('starts loading and then exposes the data', async () => {
    const load = vi.fn().mockResolvedValue('hello');

    const { result } = renderHook(() => useResource(load, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('hello');
    expect(result.current.error).toBeNull();
  });

  it('exposes the error when loading fails', async () => {
    const failure = new Error('down');
    const { result } = renderHook(() =>
      useResource(() => Promise.reject(failure), []),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(failure);
    expect(result.current.data).toBeNull();
  });

  it('loads again when a dependency changes', async () => {
    const load = vi.fn(async () => 'x');
    const { rerender } = renderHook(({ id }) => useResource(load, [id]), {
      initialProps: { id: 1 },
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    rerender({ id: 2 });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('reloads on demand and keeps the old data until the new data arrives', async () => {
    const second = deferred<string>();
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('first')
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useResource(load, []));
    await waitFor(() => expect(result.current.data).toBe('first'));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toBe('first');
    await act(async () => second.resolve('second'));
    expect(result.current.data).toBe('second');
    expect(result.current.loading).toBe(false);
  });

  it('ignores a slow old response that arrives after a newer request', async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const load = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise);
    const { result, rerender } = renderHook(
      ({ id }) => useResource(load, [id]),
      {
        initialProps: { id: 1 },
      },
    );

    rerender({ id: 2 });
    await act(async () => fast.resolve('new'));
    await act(async () => slow.resolve('old'));

    expect(result.current.data).toBe('new');
  });

  it('aborts the request when unmounted', async () => {
    let received!: AbortSignal;
    const { unmount } = renderHook(() =>
      useResource((signal) => {
        received = signal;
        return new Promise<string>(() => undefined);
      }, []),
    );
    await waitFor(() => expect(received).toBeDefined());

    unmount();

    expect(received.aborted).toBe(true);
  });

  it('does not report an error for a request it aborted itself', async () => {
    const slow = deferred<string>();
    const { result, rerender } = renderHook(
      ({ id }) =>
        useResource(
          () => (id === 1 ? slow.promise : Promise.resolve('ok')),
          [id],
        ),
      {
        initialProps: { id: 1 },
      },
    );

    rerender({ id: 2 });
    await act(async () =>
      slow.reject(new DOMException('Aborted', 'AbortError')),
    );

    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.error).toBeNull();
  });
});
