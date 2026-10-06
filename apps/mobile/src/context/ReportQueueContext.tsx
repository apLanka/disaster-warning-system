import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { deliverQueuedReport } from '../offline/deliver';
import {
  ReportQueue,
  msUntilNextAttempt,
  type FailedReport,
  type NewQueuedReport,
  type QueuedReport,
} from '../offline/reportQueue';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface ReportQueueValue {
  queued: QueuedReport[];
  failed: FailedReport[];
  enqueue: (report: NewQueuedReport) => Promise<void>;
  dismissFailed: (id: string) => Promise<void>;
  /** Tries to send everything that is waiting. Safe to call at any time. */
  sync: () => Promise<void>;
}

const ReportQueueContext = createContext<ReportQueueValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Tests pass their own queue; the app uses the one on the device. */
  queue?: ReportQueue;
}

/**
 * Keeps the outbox in step with the screen and sends it whenever there is a
 * chance: at start-up, when the connection comes back, and when the app is
 * brought back to the front.
 */
export function ReportQueueProvider({ children, queue: given }: ProviderProps) {
  const queue = useMemo(
    () => given ?? new ReportQueue(AsyncStorage, deliverQueuedReport),
    [given],
  );
  const [queued, setQueued] = useState<QueuedReport[]>([]);
  const [failed, setFailed] = useState<FailedReport[]>([]);
  const { isOffline } = useNetworkStatus();
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const [waiting, refused] = await Promise.all([
      queue.list(),
      queue.listFailed(),
    ]);
    if (mounted.current) {
      setQueued(waiting);
      setFailed(refused);
    }
  }, [queue]);

  const sync = useCallback(async () => {
    await queue.sync();
    await refresh();
  }, [queue, refresh]);

  const enqueue = useCallback(
    async (report: NewQueuedReport) => {
      await queue.enqueue(report);
      await refresh();
    },
    [queue, refresh],
  );

  const dismissFailed = useCallback(
    async (id: string) => {
      await queue.dismissFailed(id);
      await refresh();
    },
    [queue, refresh],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Show what is saved on the device straight away, even with no connection:
  // sending is skipped offline, but the citizen should still see what is waiting.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Start-up, and again each time the connection returns.
  useEffect(() => {
    if (!isOffline) void sync();
  }, [isOffline, sync]);

  // Nothing else wakes a report that is waiting out its backoff, so schedule a
  // retry for the moment the earliest one is due. Without this it would sit
  // there until the user happened to reopen the app.
  useEffect(() => {
    const wait = msUntilNextAttempt(queued, Date.now());
    if (wait === null || isOffline) return;

    const timer = setTimeout(() => void sync(), wait);
    return () => clearTimeout(timer);
  }, [queued, isOffline, sync]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  const value = useMemo(
    () => ({ queued, failed, enqueue, dismissFailed, sync }),
    [queued, failed, enqueue, dismissFailed, sync],
  );
  return (
    <ReportQueueContext.Provider value={value}>
      {children}
    </ReportQueueContext.Provider>
  );
}

export function useReportQueue(): ReportQueueValue {
  const value = useContext(ReportQueueContext);
  if (!value) {
    throw new Error('useReportQueue must be used inside ReportQueueProvider');
  }
  return value;
}
