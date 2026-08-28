import React from 'react';
import { Alert, View } from 'react-native';
import { Card, Icon, Row, Screen, Text, PressableScale, palette, radius, space } from '../ui';
import { useAuth } from '../auth/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <Card>
        <Row gap={space.md}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.pill,
              backgroundColor: palette.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="title" color="#fff">
              {(user?.name?.[0] ?? 'F').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title">{user?.name}</Text>
            <Text variant="caption" muted>
              {user?.phone ?? user?.email}
            </Text>
          </View>
        </Row>
      </Card>

      <Card elevation="flat">
        <Detail icon="hotspot" label="District" value={user?.region ?? 'Not set'} />
        <Detail icon="scroll" label="Language" value={user?.preferred_language ?? 'en'} />
      </Card>

      <PressableScale
        onPress={() =>
          Alert.alert('Log out?', '', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: logout },
          ])
        }
        style={{ alignSelf: 'center', padding: space.lg, marginTop: space.md }}
      >
        <Row gap={space.sm}>
          <Icon name="signOut" size={18} color={palette.danger} />
          <Text variant="bodyStrong" color={palette.danger}>
            Log out
          </Text>
        </Row>
      </PressableScale>
    </Screen>
  );
}

function Detail({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Row gap={space.md} style={{ paddingVertical: space.xs }}>
      <Icon name={icon} size={20} color={palette.textMuted} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" faint>
          {label}
        </Text>
        <Text variant="body">{value}</Text>
      </View>
    </Row>
  );
}
