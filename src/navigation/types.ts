import { MatchmakingMode } from '../types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ProfileInfo: undefined;
  AvatarSelection: undefined;
  Home: undefined;
  VoiceCall:
    | {
        matchReady?: boolean;
        matchedUserId?: string;
        queueMode?: MatchmakingMode;
      }
    | undefined;
  Matching: undefined;
  Chat: undefined;
  GiftPopup: undefined;
  Packages: undefined;
  Profile: undefined;
  NightMode: undefined;
  SilentScream: undefined;
  Letters: undefined;
  Rematch: undefined;
  Badges: undefined;
  Settings: undefined;
};

export type AppScreenProps<RouteName extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  RouteName
>;
