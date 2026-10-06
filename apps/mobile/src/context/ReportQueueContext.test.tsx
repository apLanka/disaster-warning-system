import { useNetInfo } from '@react-native-community/netinfo';
import { act, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { Text } from 'react-native';

import type { HazardReportDto } from '@repo/types';

import {
  ReportQueue,
  type Deliver,
  type KeyValueStore,
  type NewQueuedReport,
} from '../offline/reportQueue';
import { ReportQueueProvider, useReportQueue } from './ReportQueueContext';

const mockedNetInfo = jest.mocked(useNetInfo);
const stored = { id: 'r', reference: 'HR-2026-0001' } as HazardReportDto;

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
}

function report(n = 1): NewQueuedReport {
  return {
    id: `id-${n}`,
    type: 'FLOOD',
    description: `Report ${n} near the river`,
    location: { latitude: 7.29, longitude: 80.63 },
    photos: [],
    createdAt: `2026-10-05T10:0${n}:00.000Z`,
  };
}

let current: ReturnType<typeof useReportQueue>;
function Probe() {
  current = useReportQueue();
  return (
    <Text>{`queued:${current.queued.length} failed:${current.failed.length}`}</Text>
  );
}

function online(isConnected: boolean | null = true) {
  mockedNetInfo.mockReturnValue({ isConnected } as ReturnType<
    typeof useNetInfo
  >);
}

async function mount(
  deliver: Deliver,
  queue = new ReportQueue(memoryStore(), deliver),
) {
  await render(
    <ReportQueueProvider queue={queue}>
      <Probe />
    </ReportQueueProvider>,
  );
  return queue;
}

/** Lets pending promises settle without moving the clock. */
const settle = () => act(async () => jest.advanceTimersByTimeAsync(0));

describe('ReportQueueProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-06T08:00:00.000Z'));
    online();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends what is waiting as soon as it starts, when online', async () => {
    const deliver = jest.fn<ReturnType<Deliver>, Parameters<Deliver>>(
      async () => ({
        kind: 'delivered',
        report: stored,
      }),
    );
    const queue = new ReportQueue(memoryStore(), deliver);
    await queue.enqueue(report());

    await mount(deliver, queue);
    await settle();

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(screen.getByText('queued:0 failed:0')).toBeOnTheScreen();
  });

  it('does not try to send while the phone is offline', async () => {
    online(false);
    const deliver = jest.fn<ReturnType<Deliver>, Parameters<Deliver>>(
      async () => ({
        kind: 'delivered',
        report: stored,
      }),
    );
    const queue = new ReportQueue(memoryStore(), deliver);
    await queue.enqueue(report());

    await mount(deliver, queue);
    await settle();

    expect(deliver).not.toHaveBeenCalled();
    expect(screen.getByText('queued:1 failed:0')).toBeOnTheScreen();
  });

  it('retries by itself once a failed report has waited out its backoff, without the app being reopened', async () => {
    let calls = 0;
    const deliver: Deliver = async () => {
      calls += 1;
      return calls === 1
        ? { kind: 'retry' }
        : { kind: 'delivered', report: stored };
    };
    const queue = new ReportQueue(memoryStore(), deliver);
    await queue.enqueue(report());

    await mount(deliver, queue);
    await settle();
    expect(calls).toBe(1);
    expect(screen.getByText('queued:1 failed:0')).toBeOnTheScreen();

    // Just before the 30 s backoff ends: still waiting.
    await act(async () => jest.advanceTimersByTimeAsync(29_000));
    expect(calls).toBe(1);

    // The moment it is due: sent, with nobody touching the app.
    await act(async () => jest.advanceTimersByTimeAsync(1_500));
    expect(calls).toBe(2);
    expect(screen.getByText('queued:0 failed:0')).toBeOnTheScreen();
  });

  it('waits longer between each failed attempt, and stops once delivered', async () => {
    let calls = 0;
    const deliver: Deliver = async () => {
      calls += 1;
      return calls < 3
        ? { kind: 'retry' }
        : { kind: 'delivered', report: stored };
    };
    const queue = new ReportQueue(memoryStore(), deliver);
    await queue.enqueue(report());

    await mount(deliver, queue);
    await settle();
    await act(async () => jest.advanceTimersByTimeAsync(30_500));
    expect(calls).toBe(2);

    // Second backoff is 60 s, not 30 s.
    await act(async () => jest.advanceTimersByTimeAsync(31_000));
    expect(calls).toBe(2);
    await act(async () => jest.advanceTimersByTimeAsync(30_000));
    expect(calls).toBe(3);

    await act(async () => jest.advanceTimersByTimeAsync(10 * 60_000));
    expect(calls).toBe(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('schedules nothing when the queue is empty', async () => {
    await mount(async () => ({ kind: 'delivered', report: stored }));
    await settle();

    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not schedule a retry while offline, since the reconnect will trigger one', async () => {
    online(false);
    const queue = new ReportQueue(memoryStore(), async () => ({
      kind: 'retry',
    }));
    await queue.enqueue(report());

    await mount(async () => ({ kind: 'retry' }), queue);
    await settle();

    expect(jest.getTimerCount()).toBe(0);
  });

  it('shows a report the server refused, and lets it be dismissed', async () => {
    const queue = new ReportQueue(memoryStore(), async () => ({
      kind: 'rejected',
      message: 'A photo is too large.',
    }));
    await queue.enqueue(report());

    await mount(async () => ({ kind: 'rejected', message: 'x' }), queue);
    await settle();
    expect(screen.getByText('queued:0 failed:1')).toBeOnTheScreen();

    await act(async () => current.dismissFailed('id-1'));

    expect(screen.getByText('queued:0 failed:0')).toBeOnTheScreen();
  });

  it('saves a new report and shows it as waiting', async () => {
    online(false);
    await mount(async () => ({ kind: 'retry' }));

    await act(async () => current.enqueue(report()));

    expect(screen.getByText('queued:1 failed:0')).toBeOnTheScreen();
  });

  it('sends again when the app returns to the foreground', async () => {
    const deliver = jest.fn<ReturnType<Deliver>, Parameters<Deliver>>(
      async () => ({
        kind: 'delivered',
        report: stored,
      }),
    );
    let onChange: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (state: string) => void,
    ) => {
      onChange = handler;
      return { remove: jest.fn() };
    }) as never);
    const queue = await mount(deliver);
    await settle();

    await queue.enqueue(report());
    await act(async () => onChange?.('active'));
    await settle();

    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when used outside its provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(render(<Probe />)).rejects.toThrow(
      /inside ReportQueueProvider/,
    );
  });
});
