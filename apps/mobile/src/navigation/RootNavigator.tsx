import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HazardAlertScreen } from '../screens/HazardAlertScreen';
import { ReportDetailScreen } from '../screens/ReportDetailScreen';
import { ReportResultScreen } from '../screens/ReportResultScreen';
import { ReportHazardScreen } from '../screens/ReportHazardScreen';
import { ReportSubmittedScreen } from '../screens/ReportSubmittedScreen';
import { ReviewReportScreen } from '../screens/ReviewReportScreen';
import { SafetyInfoScreen } from '../screens/SafetyInfoScreen';
import { colors, typography } from '../theme';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Navy app bar with a white title and a back arrow (style guide 5.9). */
export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Main"
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.white,
        headerTitleStyle: { ...typography.screenTitle, color: colors.white },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ReportHazard"
        component={ReportHazardScreen}
        options={{ title: 'Report Hazard' }}
      />
      <Stack.Screen
        name="ReviewReport"
        component={ReviewReportScreen}
        options={{ title: 'Review Report' }}
      />
      <Stack.Screen
        name="ReportDetail"
        component={ReportDetailScreen}
        options={{ title: 'Report' }}
      />
      <Stack.Screen
        name="ReportResult"
        component={ReportResultScreen}
        options={{ title: 'Report Result' }}
      />
      <Stack.Screen
        name="HazardAlert"
        component={HazardAlertScreen}
        options={{ title: 'Hazard Alert' }}
      />
      <Stack.Screen
        name="SafetyInfo"
        component={SafetyInfoScreen}
        options={{ title: 'Safety Info' }}
      />
      <Stack.Screen
        name="ReportSubmitted"
        component={ReportSubmittedScreen}
        options={{
          title: 'Report Submitted',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}
