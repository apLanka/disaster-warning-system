import type { GeoLocation, HazardReportDto, HazardType } from '@repo/types';

export const QUEUE_KEY = 'reportQueue';
export const FAILED_KEY = 'failedReports';

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 15 * 60_000;

export interface QueuedPhoto {
  uri: string;
  mimeType: string;
  fileName: string;
}

/** A report saved on the device because it could not be sent yet (PENDING_SYNC). */
export interface QueuedReport {
  /** The clientRequestId: replaying it can never create a duplicate on the server. */
  id: string;
  type: HazardType;
  description: string;
  location: GeoLocation;
  photos: QueuedPhoto[];
  createdAt: string;
  attempts: number;
  /** Epoch ms before which a retry is not attempted. */
  nextAttemptAt: number;
}

/** A queued report the server refused for good, kept so the citizen can see what happened. */
export interface FailedReport {
  report: QueuedReport;
  message: string;
  failedAt: string;
}

export type DeliveryResult =
  | { kind: 'delivered'; report: HazardReportDto }
  /** The server will never accept it (a 4xx): retrying would change nothing. */
  | { kind: 'rejected'; message: string }
  /** No connection or a server problem: try again later. */
  | { kind: 'retry' };

export type Deliver = (report: QueuedReport) => Promise<DeliveryResult>;

/** The slice of AsyncStorage the queue needs, so tests can use a plain object. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface SyncSummary {
  delivered: HazardReportDto[];
  dropped: number;
  remaining: number;
}

/**
 * How long until the next report is due for another try, or null when
 * nothing is waiting. A due report gives 0.
 */
export function msUntilNextAttempt(
  queue: readonly Pick<QueuedReport, 'nextAttemptAt'>[],
  now: number,
): number | null {
  if (queue.length === 0) return null;
  const earliest = Math.min(...queue.map((entry) => entry.nextAttemptAt));
  return Math.max(0, earliest - now);
}

export function backoffMs(attempts: number): number {
  return Math.min(
    BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1),
    MAX_BACKOFF_MS,
  );
}

export type NewQueuedReport = Omit<QueuedReport, 'attempts' | 'nextAttemptAt'>;

/**
 * Durable outbox for reports written without a connection. Every read and
 * write goes through one lock, so an enqueue that happens while a sync is
 * running cannot be lost.
 */
export class ReportQueue {
  private readonly store: KeyValueStore;
  private readonly deliver: Deliver;
  private readonly now: () => number;
  private lock: Promise<unknown> = Promise.resolve();

  constructor(
    store: KeyValueStore,
    deliver: Deliver,
    now: () => number = Date.now,
  ) {
    this.store = store;
    this.deliver = deliver;
    this.now = now;
  }

  list(): Promise<QueuedReport[]> {
    return this.exclusive(() => this.read<QueuedReport>(QUEUE_KEY));
  }

  listFailed(): Promise<FailedReport[]> {
    return this.exclusive(() => this.read<FailedReport>(FAILED_KEY));
  }

  /** Saves a report for later. Saving the same id twice keeps one copy. */
  enqueue(report: NewQueuedReport): Promise<QueuedReport> {
    return this.exclusive(async () => {
      const queued: QueuedReport = { ...report, attempts: 0, nextAttemptAt: 0 };
      const rest = (await this.read<QueuedReport>(QUEUE_KEY)).filter(
        (entry) => entry.id !== report.id,
      );
      await this.write(QUEUE_KEY, [...rest, queued]);
      return queued;
    });
  }

  dismissFailed(id: string): Promise<void> {
    return this.exclusive(async () => {
      const failed = await this.read<FailedReport>(FAILED_KEY);
      await this.write(
        FAILED_KEY,
        failed.filter((entry) => entry.report.id !== id),
      );
    });
  }

  /**
   * Tries every report that is due, oldest first. Stops at the first sign the
   * connection is still down, so a dead network costs one attempt, not one per report.
   */
  sync(): Promise<SyncSummary> {
    return this.exclusive(async () => {
      const queue = (await this.read<QueuedReport>(QUEUE_KEY)).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
      const failed = await this.read<FailedReport>(FAILED_KEY);
      const delivered: HazardReportDto[] = [];
      const kept: QueuedReport[] = [];
      let dropped = 0;
      let stopped = false;

      for (const report of queue) {
        if (stopped || report.nextAttemptAt > this.now()) {
          kept.push(report);
          continue;
        }

        const result = await this.deliver(report);
        if (result.kind === 'delivered') {
          delivered.push(result.report);
        } else if (result.kind === 'rejected') {
          dropped += 1;
          failed.push({
            report,
            message: result.message,
            failedAt: new Date(this.now()).toISOString(),
          });
        } else {
          const attempts = report.attempts + 1;
          kept.push({
            ...report,
            attempts,
            nextAttemptAt: this.now() + backoffMs(attempts),
          });
          stopped = true;
        }
      }

      await this.write(QUEUE_KEY, kept);
      await this.write(FAILED_KEY, failed);
      return { delivered, dropped, remaining: kept.length };
    });
  }

  private async read<T>(key: string): Promise<T[]> {
    const raw = await this.store.getItem(key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      // A damaged outbox must not crash the app; start again from empty.
      return [];
    }
  }

  private write(key: string, value: unknown[]): Promise<void> {
    return this.store.setItem(key, JSON.stringify(value));
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lock.then(task, task);
    this.lock = run.catch(() => undefined);
    return run;
  }
}
