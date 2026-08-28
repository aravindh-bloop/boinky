import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from './auth/AuthContext';
import { LoaderScreen, palette, fonts } from './ui';
import { TabBar } from './ui/TabBar';

import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import WeatherScreen from './screens/WeatherScreen';
import TasksScreen from './screens/TasksScreen';
import ActivityScreen from './screens/ActivityScreen';
import AlertsScreen from './screens/AlertsScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import FieldsScreen from './screens/FieldsScreen';
import FieldFormScreen from './screens/FieldFormScreen';
import FieldDetailScreen from './screens/FieldDetailScreen';
import CalendarScreen from './screens/CalendarScreen';
import ScanScreen from './screens/ScanScreen';
import ScanResultScreen from './screens/ScanResultScreen';
import SchemesScreen from './screens/SchemesScreen';
import StockScreen from './screens/StockScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import HarvestScreen from './screens/HarvestScreen';
import LogActivityScreen from './screens/LogActivityScreen';

export type HomeStackParams = {
  HomeMain: undefined;
  Weather: { fieldId?: string } | undefined;
  Tasks: undefined;
  Activity: undefined;
  Alerts: undefined;
  History: undefined;
  Profile: undefined;
  ScanResult: { scanId: string };
  FieldDetail: { fieldId: string };
};
export type FieldsStackParams = {
  FieldsList: undefined;
  FieldForm: { fieldId?: string } | undefined;
  FieldDetail: { fieldId: string };
  Calendar: { fieldId: string; crop: string };
  ScanResult: { scanId: string };
  LogActivity: { fieldId?: string; taskId?: string; presetKind?: string } | undefined;
  Weather: { fieldId?: string } | undefined;
};
export type ScanStackParams = {
  ScanCapture: undefined;
  ScanResult: { scanId: string };
};
export type SchemesStackParams = {
  SchemesList: undefined;
};
export type StockStackParams = {
  StockMain: undefined;
  Expenses: undefined;
  Harvest: undefined;
  LogActivity: { fieldId?: string } | undefined;
};

const screenOpts = {
  headerStyle: { backgroundColor: palette.canvas },
  headerShadowVisible: false,
  headerTintColor: palette.primaryDeep,
  headerTitleStyle: { fontFamily: fonts.display, fontSize: 19, color: palette.text },
  headerBackButtonDisplayMode: 'minimal' as const,
  contentStyle: { backgroundColor: palette.canvas },
};

const HomeNav = createNativeStackNavigator<HomeStackParams>();
function HomeStack() {
  return (
    <HomeNav.Navigator screenOptions={screenOpts}>
      <HomeNav.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <HomeNav.Screen name="Weather" component={WeatherScreen} options={{ headerShown: false }} />
      <HomeNav.Screen name="Tasks" component={TasksScreen} options={{ title: 'Tasks' }} />
      <HomeNav.Screen name="Activity" component={ActivityScreen} options={{ title: 'Activity log' }} />
      <HomeNav.Screen name="Alerts" component={AlertsScreen} options={{ headerShown: false }} />
      <HomeNav.Screen name="History" component={HistoryScreen} options={{ headerShown: false }} />
      <HomeNav.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <HomeNav.Screen name="ScanResult" component={ScanResultScreen} options={{ headerTransparent: true, title: '' }} />
      <HomeNav.Screen name="FieldDetail" component={FieldDetailScreen} options={{ headerTransparent: true, title: '' }} />
    </HomeNav.Navigator>
  );
}

const FieldsNav = createNativeStackNavigator<FieldsStackParams>();
function FieldsStack() {
  return (
    <FieldsNav.Navigator screenOptions={screenOpts}>
      <FieldsNav.Screen name="FieldsList" component={FieldsScreen} options={{ headerShown: false }} />
      <FieldsNav.Screen name="FieldForm" component={FieldFormScreen} options={{ title: 'New field' }} />
      <FieldsNav.Screen name="FieldDetail" component={FieldDetailScreen} options={{ headerTransparent: true, title: '' }} />
      <FieldsNav.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Crop calendar' }} />
      <FieldsNav.Screen name="ScanResult" component={ScanResultScreen} options={{ headerTransparent: true, title: '' }} />
      <FieldsNav.Screen name="LogActivity" component={LogActivityScreen} options={{ title: 'Log activity' }} />
      <FieldsNav.Screen name="Weather" component={WeatherScreen} options={{ headerShown: false }} />
    </FieldsNav.Navigator>
  );
}

const ScanNav = createNativeStackNavigator<ScanStackParams>();
function ScanStack() {
  return (
    <ScanNav.Navigator screenOptions={screenOpts}>
      <ScanNav.Screen name="ScanCapture" component={ScanScreen} options={{ headerShown: false }} />
      <ScanNav.Screen name="ScanResult" component={ScanResultScreen} options={{ headerTransparent: true, title: '' }} />
    </ScanNav.Navigator>
  );
}

const SchemesNav = createNativeStackNavigator<SchemesStackParams>();
function SchemesStack() {
  return (
    <SchemesNav.Navigator screenOptions={screenOpts}>
      <SchemesNav.Screen name="SchemesList" component={SchemesScreen} options={{ headerShown: false }} />
    </SchemesNav.Navigator>
  );
}

const StockNav = createNativeStackNavigator<StockStackParams>();
function StockStack() {
  return (
    <StockNav.Navigator screenOptions={screenOpts}>
      <StockNav.Screen name="StockMain" component={StockScreen} options={{ headerShown: false }} />
      <StockNav.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Expenses' }} />
      <StockNav.Screen name="Harvest" component={HarvestScreen} options={{ title: 'Harvest records' }} />
      <StockNav.Screen name="LogActivity" component={LogActivityScreen} options={{ title: 'Log activity' }} />
    </StockNav.Navigator>
  );
}

const Tabs = createBottomTabNavigator();
function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="Home" component={HomeStack} />
      <Tabs.Screen name="Fields" component={FieldsStack} />
      <Tabs.Screen name="Scan" component={ScanStack} />
      <Tabs.Screen name="Schemes" component={SchemesStack} />
      <Tabs.Screen name="Stock" component={StockStack} />
    </Tabs.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: palette.canvas, primary: palette.primary },
};

export default function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <LoaderScreen label="AgriPod" />;
  return (
    <NavigationContainer theme={navTheme}>
      {user ? <MainTabs /> : <AuthScreen />}
    </NavigationContainer>
  );
}
