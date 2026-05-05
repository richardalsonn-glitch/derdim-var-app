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
        friendCall?: boolean;
        partnerName?: string;
        partnerAvatarId?: string;
        durationSeconds?: number;
      }
    | undefined;
  Matching: undefined;
  Chat:
    | {
        threadId?: string;
        peerUserId?: string;
      }
    | undefined;
  Gifts: undefined;
  Friends: undefined;
  FriendProfile: {
    friendId: string;
  };
  FrozenAccount: undefined;
  GiftPopup: undefined;
  Packages: undefined;
  Profile: undefined;
  NightMode: undefined;
  NightRoom: {
    roomId: string;
  };
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
