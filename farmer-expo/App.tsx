import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/auth/AuthContext';
import RootNavigator from './src/navigation';
import { fontMap } from './src/ui/fonts';
import { LoaderScreen } from './src/ui';

export default function App() {
  const [fontsLoaded] = useFonts(fontMap);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {fontsLoaded ? (
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        ) : (
          <LoaderScreen label="AgriPod" />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
