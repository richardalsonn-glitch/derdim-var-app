import 'react-native-gesture-handler';

import { registerGlobals } from '@livekit/react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from './src/data/AppContext';
import { AppNavigator } from './src/navigation/AppNavigator';

registerGlobals();

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
