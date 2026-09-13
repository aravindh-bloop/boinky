import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { I18nProvider } from './src/i18n';
import RootNavigator from './src/navigation';
import { fontMap } from './src/ui/fonts';
import { hydrateCache } from './src/api/cache';
import { warmUp } from './src/api/client';
import { BootLoader } from './src/ui/BootLoader';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { installErrorHook, logEvent } from './src/debug/eventlog';

installErrorHook();
logEvent('info', 'app launch');

/**
 * The one and only place that decides "are we still booting". AuthProvider is
 * mounted unconditionally (below) so its token check runs in parallel with
 * fonts/cache instead of after them, and so BootLoader never has to mount a
 * second time waiting on auth — a second mount was restarting its photo
 * animation from scratch, which read as the app "reloading" mid-launch.
 */
function AppGate({ assetsReady }: { assetsReady: boolean }) {
  const { loading: authLoading } = useAuth();
  if (!assetsReady || authLoading) return <BootLoader />;
  return <RootNavigator />;
}

export default function App() {
  const [fontsLoaded] = useFonts(fontMap);
  const [cacheReady, setCacheReady] = React.useState(false);

  // Runs in parallel with font loading, so restoring the cache costs nothing —
  // and the first screen then paints with real data instead of skeletons.
  // Raced against a short timer: a cache that will not load is a reason to start
  // without it, never a reason to hold the app on a spinner.
  React.useEffect(() => {
    warmUp();
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setCacheReady(true);
      }
    };
    const bail = setTimeout(finish, 2000);
    hydrateCache().finally(() => {
      clearTimeout(bail);
      finish();
    });
    return () => clearTimeout(bail);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ErrorBoundary>
          <AuthProvider>
            <I18nProvider>
              <AppGate assetsReady={fontsLoaded && cacheReady} />
            </I18nProvider>
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
