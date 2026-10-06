import type { HazardReportDto } from '@repo/types';

import {
  backoffMs,
  msUntilNextAttempt,
  FAILED_KEY,
  QUEUE_KEY,
  ReportQueue,
  type Deliver,
  type KeyValueStore,
  type NewQueuedReport,
} from './reportQueue';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
}

function entry(
  n: number,
  overrides: Partial<NewQueuedReport> = {},
): NewQueuedReport {
  return {
    id: `id-${n}`,
    type: 'FLOOD',
    description: `Report number ${n} near the river`,
    location: { latitude: 7.29, longitude: 80.63 },
    photos: [],
    createdAt: `2026-10-05T10:0${n}:00.000Z`,
    ...overrides,
  };
}

const stored = { id: 'r', reference: 'HR-2026-0001' } as HazardReportDto;
const delivered: Deliver = async () => ({ kind: 'delivered', report: stored });
const NOW = 1_000_000;

describe('backoffMs', () => {
  it.each([
    [1, 30_000],
    [2, 60_000],
    [3, 120_000],
    [5, 480_000],
    [6, 900_000],
    [20, 900_000],
  ])(
    'waits %i attempts for %i ms, never more than 15 minutes',
    (attempts, expected) => {
      expect(backoffMs(attempts)).toBe(expected);
    },
  );

  it('never waits a negative or fractional time for zero attempts', () => {
    expect(backoffMs(0)).toBe(30_000);
  });
});

describe('msUntilNextAttempt', () => {
  it('is null when nothing is waiting', () => {
    expect(msUntilNextAttempt([], NOW)).toBeNull();
  });

  it('is zero for a report that is already due', () => {
    expect(msUntilNextAttempt([{ nextAttemptAt: 0 }], NOW)).toBe(0);
    expect(msUntilNextAttempt([{ nextAttemptAt: NOW - 5000 }], NOW)).toBe(0);
  });

  it('counts down to a report in backoff', () => {
    expect(msUntilNextAttempt([{ nextAttemptAt: NOW + 30_000 }], NOW)).toBe(
      30_000,
    );
  });

  it('waits only for the earliest of several reports', () => {
    expect(
      msUntilNextAttempt(
        [
          { nextAttemptAt: NOW + 120_000 },
          { nextAttemptAt: NOW + 30_000 },
          { nextAttemptAt: NOW + 60_000 },
        ],
        NOW,
      ),
    ).toBe(30_000);
  });
});

describe('ReportQueue', () => {
  let store: ReturnType<typeof memoryStore>;

  beforeEach(() => {
    store = memoryStore();
  });

  const queueWith = (deliver: Deliver, now = () => NOW) =>
    new ReportQueue(store, deliver, now);

  describe('enqueue and list', () => {
    it('starts empty', async () => {
      expect(await queueWith(delivered).list()).toEqual([]);
    });

    it('saves a report with no attempts yet', async () => {
      const queue = queueWith(delivered);

      const saved = await queue.enqueue(entry(1));

      expect(saved).toMatchObject({
        id: 'id-1',
        attempts: 0,
        nextAttemptAt: 0,
      });
      expect(await queue.list()).toEqual([saved]);
    });

    it('keeps one copy when the same id is saved twice', async () => {
      const queue = queueWith(delivered);
      await queue.enqueue(entry(1));

      await queue.enqueue(
        entry(1, { description: 'Edited description near the river' }),
      );

      const items = await queue.list();
      expect(items).toHaveLength(1);
      expect(items[0]?.description).toBe('Edited description near the river');
    });

    it('survives a restart, because it lives in storage', async () => {
      await queueWith(delivered).enqueue(entry(1));

      expect(await queueWith(delivered).list()).toHaveLength(1);
    });

    it('starts from empty rather than crashing when storage is damaged', async () => {
      store.data.set(QUEUE_KEY, '{not json');
      const queue = queueWith(delivered);

      expect(await queue.list()).toEqual([]);
      await expect(queue.enqueue(entry(1))).resolves.toBeDefined();
    });

    it('ignores stored data that is not a list', async () => {
      store.data.set(QUEUE_KEY, '{"a":1}');

      expect(await queueWith(delivered).list()).toEqual([]);
    });
  });

  describe('sync', () => {
    it('does nothing for an empty queue', async () => {
      const deliver = jest.fn(delivered);

      expect(await queueWith(deliver).sync()).toEqual({
        delivered: [],
        dropped: 0,
        remaining: 0,
      });
      expect(deliver).not.toHaveBeenCalled();
    });

    it('sends each report and removes it once delivered', async () => {
      const queue = queueWith(delivered);
      await queue.enqueue(entry(1));
      await queue.enqueue(entry(2));

      const summary = await queue.sync();

      expect(summary.delivered).toHaveLength(2);
      expect(summary.remaining).toBe(0);
      expect(await queue.list()).toEqual([]);
    });

    it('sends the oldest report first', async () => {
      const sent: string[] = [];
      const queue = queueWith(async (report) => {
        sent.push(report.id);
        return { kind: 'delivered', report: stored };
      });
      await queue.enqueue(entry(3));
      await queue.enqueue(entry(1));
      await queue.enqueue(entry(2));

      await queue.sync();

      expect(sent).toEqual(['id-1', 'id-2', 'id-3']);
    });

    it('sends the same request id every time, so a retry cannot duplicate a report', async () => {
      const ids: string[] = [];
      let now = NOW;
      let calls = 0;
      const queue = queueWith(
        async (report) => {
          ids.push(report.id);
          calls += 1;
          return calls === 1
            ? { kind: 'retry' }
            : { kind: 'delivered', report: stored };
        },
        () => now,
      );
      await queue.enqueue(entry(1));

      await queue.sync();
      now += 10 * 60_000;
      await queue.sync();

      expect(ids).toEqual(['id-1', 'id-1']);
      expect(await queue.list()).toEqual([]);
    });

    it('keeps a report and backs off when the network is down', async () => {
      const queue = queueWith(async () => ({ kind: 'retry' }));
      await queue.enqueue(entry(1));

      const summary = await queue.sync();

      expect(summary).toEqual({ delivered: [], dropped: 0, remaining: 1 });
      expect(await queue.list()).toEqual([
        expect.objectContaining({
          id: 'id-1',
          attempts: 1,
          nextAttemptAt: NOW + 30_000,
        }),
      ]);
    });

    it('waits longer after each failed attempt', async () => {
      let now = NOW;
      const queue = queueWith(
        async () => ({ kind: 'retry' }),
        () => now,
      );
      await queue.enqueue(entry(1));

      await queue.sync();
      now += 30_000;
      await queue.sync();

      expect((await queue.list())[0]).toMatchObject({
        attempts: 2,
        nextAttemptAt: now + 60_000,
      });
    });

    it('does not try a report again before its backoff has passed', async () => {
      const deliver = jest.fn<ReturnType<Deliver>, Parameters<Deliver>>(
        async () => ({ kind: 'retry' }),
      );
      const queue = queueWith(deliver);
      await queue.enqueue(entry(1));
      await queue.sync();
      deliver.mockClear();

      await queue.sync();

      expect(deliver).not.toHaveBeenCalled();
      expect(await queue.list()).toHaveLength(1);
    });

    it('stops after the first failure so a dead network costs one attempt', async () => {
      const deliver = jest.fn<ReturnType<Deliver>, Parameters<Deliver>>(
        async () => ({ kind: 'retry' }),
      );
      const queue = queueWith(deliver);
      await queue.enqueue(entry(1));
      await queue.enqueue(entry(2));
      await queue.enqueue(entry(3));

      const summary = await queue.sync();

      expect(deliver).toHaveBeenCalledTimes(1);
      expect(summary.remaining).toBe(3);
      const items = await queue.list();
      expect(items.find((item) => item.id === 'id-2')?.attempts).toBe(0);
    });

    it('delivers the reports before a failure and keeps the rest', async () => {
      const queue = queueWith(async (report) =>
        report.id === 'id-2'
          ? { kind: 'retry' }
          : { kind: 'delivered', report: stored },
      );
      await queue.enqueue(entry(1));
      await queue.enqueue(entry(2));
      await queue.enqueue(entry(3));

      const summary = await queue.sync();

      expect(summary.delivered).toHaveLength(1);
      expect((await queue.list()).map((item) => item.id)).toEqual([
        'id-2',
        'id-3',
      ]);
    });

    it('still sends a later report when an earlier one is merely waiting out its backoff', async () => {
      const sent: string[] = [];
      const queue = queueWith(async (report) => {
        sent.push(report.id);
        return { kind: 'delivered', report: stored };
      });
      store.data.set(
        QUEUE_KEY,
        JSON.stringify([
          { ...entry(1), attempts: 3, nextAttemptAt: NOW + 60_000 },
          { ...entry(2), attempts: 0, nextAttemptAt: 0 },
        ]),
      );

      await queue.sync();

      expect(sent).toEqual(['id-2']);
      expect((await queue.list()).map((item) => item.id)).toEqual(['id-1']);
    });

    it('moves a report the server refused to the failed list instead of retrying forever', async () => {
      const queue = queueWith(async () => ({
        kind: 'rejected',
        message: 'description is wrong',
      }));
      await queue.enqueue(entry(1));

      const summary = await queue.sync();

      expect(summary).toEqual({ delivered: [], dropped: 1, remaining: 0 });
      expect(await queue.list()).toEqual([]);
      expect(await queue.listFailed()).toEqual([
        {
          report: expect.objectContaining({ id: 'id-1' }),
          message: 'description is wrong',
          failedAt: new Date(NOW).toISOString(),
        },
      ]);
    });

    it('keeps going after a refusal, since it says nothing about the connection', async () => {
      const queue = queueWith(async (report) =>
        report.id === 'id-1'
          ? { kind: 'rejected', message: 'bad' }
          : { kind: 'delivered', report: stored },
      );
      await queue.enqueue(entry(1));
      await queue.enqueue(entry(2));

      const summary = await queue.sync();

      expect(summary).toMatchObject({ dropped: 1, remaining: 0 });
      expect(summary.delivered).toHaveLength(1);
    });

    it('does not lose a report saved while a sync is running', async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const queue = queueWith(async () => {
        await gate;
        return { kind: 'delivered', report: stored };
      });
      await queue.enqueue(entry(1));

      const syncing = queue.sync();
      const saving = queue.enqueue(entry(2));
      release();
      await Promise.all([syncing, saving]);

      expect((await queue.list()).map((item) => item.id)).toEqual(['id-2']);
    });

    it('lets a failed delivery attempt through without wedging the queue', async () => {
      let calls = 0;
      const queue = queueWith(async () => {
        calls += 1;
        if (calls === 1) throw new Error('unexpected');
        return { kind: 'delivered', report: stored };
      });
      await queue.enqueue(entry(1));

      await expect(queue.sync()).rejects.toThrow('unexpected');

      expect((await queue.sync()).delivered).toHaveLength(1);
    });
  });

  describe('failed reports', () => {
    it('lets the citizen dismiss one', async () => {
      store.data.set(
        FAILED_KEY,
        JSON.stringify([
          { report: entry(1), message: 'a', failedAt: 'x' },
          { report: entry(2), message: 'b', failedAt: 'y' },
        ]),
      );
      const queue = queueWith(delivered);

      await queue.dismissFailed('id-1');

      expect((await queue.listFailed()).map((item) => item.report.id)).toEqual([
        'id-2',
      ]);
    });
  });
});
