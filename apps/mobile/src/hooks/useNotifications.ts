import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { NotificationDto } from '@repo/types';

import {
  listUnreadNotifications,
  markNotificationRead,
} from '../api/hazardReports';

interface UseNotifications {
  unread: NotificationDto[];
  /** Marks one as read and removes it from the list at once. */
  dismiss: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * The citizen's unread results. There is no push in scope, so this asks the
 * server when the screen comes into view and when the app returns to the
 * front. A failed check keeps what is already shown: being offline is normal.
 */
export function useNotifications(): UseNotifications {
  const [unread, setUnread] = useState<NotificationDto[]>([]);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const items = await listUnreadNotifications();
      // Never let an odd response break the Home screen.
      if (mounted.current && Array.isArray(items)) setUnread(items);
    } catch {
      // Offline or the server is down: keep showing what we have.
    }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    setUnread((items) => items.filter((item) => item.id !== id));
    try {
      await markNotificationRead(id);
    } catch {
      // It will show again next time; better than losing the result.
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { unread, dismiss, refresh };
}
