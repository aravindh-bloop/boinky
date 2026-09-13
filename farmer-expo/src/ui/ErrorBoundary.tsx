import React from 'react';
import { View } from 'react-native';
import { Icon } from './Icon';
import { Text } from './Text';
import { Button } from './Button';
import { palette, space } from './tokens';
import { logEvent } from '../debug/eventlog';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches any render-time error anywhere below it and shows a recoverable
 * screen instead of taking the whole app down — the only safety net once this
 * is running on a stranger's phone instead of a dev build we're watching.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    logEvent('error', 'React render error', error.message);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.canvas,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.xl,
          gap: space.md,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: palette.dangerSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="warning" size={30} color={palette.danger} weight="fill" />
        </View>
        <Text variant="title" style={{ textAlign: 'center' }}>
          Something went wrong
        </Text>
        <Text variant="body" muted style={{ textAlign: 'center' }}>
          AgriPod ran into a problem. Your data is safe — try again.
        </Text>
        <Button title="Try again" onPress={() => this.setState({ error: null })} />
      </View>
    );
  }
}
