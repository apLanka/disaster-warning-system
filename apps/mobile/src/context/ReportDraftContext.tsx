import * as Crypto from 'expo-crypto';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { ReportDraft } from '../lib/draft';

type DraftChanges = Partial<Omit<ReportDraft, 'clientRequestId'>>;

interface ReportDraftValue {
  draft: ReportDraft;
  update: (changes: DraftChanges) => void;
  /** Starts a fresh draft, with a new request id. Only after a report was sent or saved. */
  reset: () => void;
}

const ReportDraftContext = createContext<ReportDraftValue | null>(null);

function emptyDraft(): ReportDraft {
  return {
    clientRequestId: Crypto.randomUUID(),
    type: null,
    description: '',
    photos: [],
    location: null,
  };
}

/**
 * Holds what the citizen has typed, above the screens, so going back from the
 * review screen to edit keeps everything. The request id stays the same until
 * the draft is reset, so a failed send can be retried without duplicating.
 */
export function ReportDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<ReportDraft>(emptyDraft);

  const update = useCallback((changes: DraftChanges) => {
    setDraft((current) => ({ ...current, ...changes }));
  }, []);
  const reset = useCallback(() => setDraft(emptyDraft()), []);

  const value = useMemo(
    () => ({ draft, update, reset }),
    [draft, update, reset],
  );
  return (
    <ReportDraftContext.Provider value={value}>
      {children}
    </ReportDraftContext.Provider>
  );
}

export function useReportDraft(): ReportDraftValue {
  const value = useContext(ReportDraftContext);
  if (!value) {
    throw new Error('useReportDraft must be used inside ReportDraftProvider');
  }
  return value;
}
