import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { isLiveKitEnabled } from './src/config/features';
import { logSafeError } from './src/lib/safeLogger';

let livekitGlobalsRegistered = false;

function initializeOptionalNativeModules() {
  if (!isLiveKitEnabled || livekitGlobalsRegistered) {
    return;
  }

  try {
    const { registerGlobals } = require('@livekit/react-native') as {
      registerGlobals: () => void;
    };
    registerGlobals();
    livekitGlobalsRegistered = true;
  } catch (error) {
    logSafeError('LiveKit globals init failed', error);
  }
}

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
  initializeOptionalNativeModules();
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
