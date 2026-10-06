import { NavigationContainer } from '@react-navigation/native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ReportDraftProvider } from '../context/ReportDraftContext';
import { ReportQueueProvider } from '../context/ReportQueueContext';
import { RootNavigator } from '../navigation/RootNavigator';
import {
  ReportQueue,
  type Deliver,
  type KeyValueStore,
} from '../offline/reportQueue';

export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
}

export const neverDelivers: Deliver = async () => ({ kind: 'retry' });

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** The whole app: real navigation, draft, and queue contexts over an in-memory outbox. */
export async function renderApp(queue?: ReportQueue) {
  const outbox = queue ?? new ReportQueue(memoryStore(), neverDelivers);
  const view = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ReportDraftProvider>
        <ReportQueueProvider queue={outbox}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </ReportQueueProvider>
      </ReportDraftProvider>
    </SafeAreaProvider>,
  );
  return { ...view, queue: outbox };
}
