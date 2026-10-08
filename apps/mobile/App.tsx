import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AlertsProvider } from './src/context/AlertsContext';
import { ReportDraftProvider } from './src/context/ReportDraftContext';
import { ReportQueueProvider } from './src/context/ReportQueueContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <ReportDraftProvider>
        <ReportQueueProvider>
          <AlertsProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <RootNavigator />
            </NavigationContainer>
          </AlertsProvider>
        </ReportQueueProvider>
      </ReportDraftProvider>
    </SafeAreaProvider>
  );
}
