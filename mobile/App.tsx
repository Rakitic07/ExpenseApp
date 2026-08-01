import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { StoreProvider, useStore } from './src/state/store';
import { PeriodProvider } from './src/state/period';
import { UpdatesProvider } from './src/state/updates';
import { CurrencyProvider } from './src/lib/currency';
import { AuthScreen } from './src/screens/AuthScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { ChartsScreen } from './src/screens/ChartsScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { ExpenseFormScreen } from './src/screens/ExpenseFormScreen';
import { TabBar } from './src/components/TabBar';
import { FloatingAddButton } from './src/components/FloatingAddButton';
import { Background } from './src/components/Background';
import type { RootStackParamList, TabParamList } from './src/navigation';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Transparent so the global gradient Background shows through every screen.
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent', card: 'transparent', primary: colors.primary },
};

function Tabs() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={props => <TabBar {...props} />}
        screenOptions={{ headerShown: false, lazy: true }}>
        <Tab.Screen name="Overview" component={OverviewScreen} />
        <Tab.Screen name="Charts" component={ChartsScreen} />
        <Tab.Screen name="Activity" component={ActivityScreen} />
      </Tab.Navigator>
      <FloatingAddButton />
    </View>
  );
}

function Splash() {
  return (
    <View style={styles.splash}>
      <Text style={styles.logo}>Spendly+</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
    </View>
  );
}

function Root() {
  const { status, name } = useStore();

  if (status === 'loading') return <Splash />;
  if (status === 'guest') return <AuthScreen />;

  return (
    <CurrencyProvider space={name}>
      <PeriodProvider>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={Tabs} />
          <Stack.Screen
            name="ExpenseForm"
            component={ExpenseFormScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack.Navigator>
      </PeriodProvider>
    </CurrencyProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <Background />
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <NavigationContainer theme={navTheme}>
            <UpdatesProvider>
              <StoreProvider>
                <Root />
              </StoreProvider>
            </UpdatesProvider>
          </NavigationContainer>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { color: colors.primary, fontSize: 34, fontWeight: '800' },
});
