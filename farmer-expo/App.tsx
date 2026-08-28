import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/auth/AuthContext';
import RootNavigator from './src/navigation';
import { fontMap } from './src/ui/fonts';
import { hydrateCache } from './src/api/cache';
import { warmUp } from './src/api/client';
import { BootLoader } from './src/ui/BootLoader';

export default function App() {
  const [fontsLoaded] = useFonts(fontMap);
  const [cacheReady, setCacheReady] = React.useState(false);

  // Runs in parallel with font loading, so restoring the cache costs nothing —
  // and the first screen then paints with real data instead of skeletons.
  React.useEffect(() => {
    warmUp();
    hydrateCache().finally(() => setCacheReady(true));
  }, []);

  const ready = fontsLoaded && cacheReady;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {ready ? (
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        ) : (
          <BootLoader />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
