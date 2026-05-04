import 'expo-dev-client';
import { registerGlobals } from '@livekit/react-native';
import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { logSafeError } from './src/lib/safeLogger';

registerGlobals();

function FallbackApp() {
  return null;
}

class RootErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    logSafeError('Root render failed', error);
  }

  render() {
    if (this.state.hasError) {
      return <FallbackApp />;
    }

    return this.props.children;
  }
}

function loadAppProvider() {
  try {
    const module = require('./src/data/AppContext');
    return module.AppProvider ?? (({ children }: React.PropsWithChildren) => <>{children}</>);
  } catch (error) {
    logSafeError('AppContext import failed', error);
    return ({ children }: React.PropsWithChildren) => <>{children}</>;
  }
}

function loadAppNavigator() {
  try {
    const module = require('./src/navigation/AppNavigator');
    return module.AppNavigator ?? FallbackApp;
  } catch (error) {
    logSafeError('AppNavigator import failed', error);
    return FallbackApp;
  }
}

export default function App() {
  const AppProvider = loadAppProvider();
  const AppNavigator = loadAppNavigator();

  try {
    return (
      <RootErrorBoundary>
        <SafeAreaProvider>
          <AppProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </AppProvider>
        </SafeAreaProvider>
      </RootErrorBoundary>
    );
  } catch (error) {
    logSafeError('App bootstrap failed', error);
    return <FallbackApp />;
  }
}
