import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { HealthStatus } from './src/components/HealthStatus';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <HealthStatus />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
