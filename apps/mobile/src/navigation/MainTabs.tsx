import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Bell, ClipboardList, Home, User } from 'lucide-react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNotifications } from '../hooks/useNotifications';
import { HomeScreen } from '../screens/HomeScreen';
import { MyReportsScreen } from '../screens/MyReportsScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { colors, TOUCH_TARGET, typography } from '../theme';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const AlertsScreen = () => <PlaceholderScreen title="Alerts" />;
const ProfileScreen = () => <PlaceholderScreen title="Profile" />;

/** Bell with the number of results the citizen has not looked at yet. */
function BellButton({
  navigation,
}: {
  navigation: BottomTabNavigationProp<TabParamList, 'Home'>;
}) {
  const { unread } = useNotifications();
  const label =
    unread.length === 0
      ? 'Notifications, none new'
      : `Notifications, ${unread.length} new`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => navigation.navigate('Tasks')}
      style={styles.bell}
    >
      <Bell size={22} color={colors.white} />
      {unread.length > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unread.length > 9 ? '9+' : unread.length}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Navy app bar and an orange active tab (style guide 5.9). */
export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.white,
        headerTitleStyle: { ...typography.screenTitle, color: colors.white },
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Disaster Alerts',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          headerRight: () => <BellButton navigation={navigation} />,
        })}
      />
      <Tab.Screen
        name="Tasks"
        component={MyReportsScreen}
        options={{
          title: 'My Reports',
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <ClipboardList size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bell: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
