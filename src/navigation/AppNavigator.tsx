import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '../constants/theme';
import { AvatarSelectionScreen } from '../screens/AvatarSelectionScreen';
import { BadgesScreen } from '../screens/BadgesScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { GiftPopupScreen } from '../screens/GiftPopupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LettersScreen } from '../screens/LettersScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MatchingScreen } from '../screens/MatchingScreen';
import { NightModeScreen } from '../screens/NightModeScreen';
import { PackagesScreen } from '../screens/PackagesScreen';
import { ProfileInfoScreen } from '../screens/ProfileInfoScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { RematchScreen } from '../screens/RematchScreen';
import { SilentScreamScreen } from '../screens/SilentScreamScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: 'transparent',
    primary: colors.purple,
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen component={SplashScreen} name="Splash" />
        <Stack.Screen component={LoginScreen} name="Login" />
        <Stack.Screen component={RegisterScreen} name="Register" />
        <Stack.Screen component={ProfileInfoScreen} name="ProfileInfo" />
        <Stack.Screen component={AvatarSelectionScreen} name="AvatarSelection" />
        <Stack.Screen component={HomeScreen} name="Home" />
        <Stack.Screen component={MatchingScreen} name="Matching" />
        <Stack.Screen component={ChatScreen} name="Chat" />
        <Stack.Screen component={PackagesScreen} name="Packages" />
        <Stack.Screen component={ProfileScreen} name="Profile" />
        <Stack.Screen component={NightModeScreen} name="NightMode" />
        <Stack.Screen component={SilentScreamScreen} name="SilentScream" />
        <Stack.Screen component={LettersScreen} name="Letters" />
        <Stack.Screen component={RematchScreen} name="Rematch" />
        <Stack.Screen component={BadgesScreen} name="Badges" />
        <Stack.Screen
          component={GiftPopupScreen}
          name="GiftPopup"
          options={{
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
            presentation: 'transparentModal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
