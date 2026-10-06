import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../screens/HomeScreen';
import { ReportHazardScreen } from '../screens/ReportHazardScreen';
import { ReportSubmittedScreen } from '../screens/ReportSubmittedScreen';
import { ReviewReportScreen } from '../screens/ReviewReportScreen';
import { colors, typography } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Navy app bar with a white title and a back arrow (style guide 5.9). */
export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.white,
        headerTitleStyle: { ...typography.screenTitle, color: colors.white },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Disaster Alerts' }}
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
