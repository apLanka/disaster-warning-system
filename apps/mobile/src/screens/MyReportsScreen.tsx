import { FileText } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { describeError } from '../api/client';
import { listMyReports } from '../api/hazardReports';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { OfflineBanner } from '../components/OfflineBanner';
import { ReportCard } from '../components/ReportCard';
import { useReportQueue } from '../context/ReportQueueContext';
import { useResource } from '../hooks/useResource';
import { formatRelativeTime } from '../lib/time';
import type { TabScreenProps } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

export function MyReportsScreen({ navigation }: TabScreenProps<'Reports'>) {
  const { data, error, loading, reload } = useResource(
    (signal) => listMyReports(signal),
    [],
  );
  const { queued } = useReportQueue();
  const [refreshing, setRefreshing] = useState(false);
  const now = useMemo(() => new Date(), [data, queued]);

  // Fresh results whenever the citizen comes back to this screen. The first
  // focus is skipped: the initial load is already running.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else reload();
    }, [reload]),
  );

  async function pullToRefresh() {
    setRefreshing(true);
    reload();
    setRefreshing(false);
  }

  const empty = data !== null && data.length === 0 && queued.length === 0;

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || (loading && data !== null)}
            onRefresh={() => void pullToRefresh()}
          />
        }
      >
        {error !== null && (
          <Banner
            tone="danger"
            action={
              <Button title="Try again" variant="ghost" onPress={reload} />
            }
          >
            {describeError(error)}
          </Banner>
        )}

        {loading && data === null && error === null && (
          <View
            accessibilityLabel="Loading your reports"
            accessibilityRole="progressbar"
            style={styles.skeletons}
          >
            {[0, 1, 2].map((n) => (
              <View key={n} style={styles.skeleton} />
            ))}
          </View>
        )}

        {queued.map((report) => (
          <ReportCard
            key={report.id}
            type={report.type}
            description={report.description}
            status="PENDING_SYNC"
            when={formatRelativeTime(report.createdAt, now)}
          />
        ))}

        {data?.map((report) => (
          <ReportCard
            key={report.id}
            type={report.type}
            description={report.description}
            status={report.status}
            reference={report.reference}
            when={formatRelativeTime(report.createdAt, now)}
            onPress={() =>
              navigation.navigate('ReportDetail', { id: report.id })
            }
          />
        ))}

        {empty && (
          <View style={styles.empty}>
            <FileText size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              You have not reported anything yet
            </Text>
            <Text style={styles.emptyText}>
              Reports you submit will appear here with their status.
            </Text>
            <Button
              title="Report a Hazard"
              onPress={() => navigation.navigate('ReportHazard')}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.md },
  skeletons: { gap: spacing.md },
  skeleton: {
    height: 110,
    borderRadius: 12,
    backgroundColor: colors.neutralTint,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
