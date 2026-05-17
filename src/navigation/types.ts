import { MatchmakingMode } from '../types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register:
    | {
        mode?: 'default' | 'socialCompletion';
        provider?: 'apple' | 'google';
        suggestedUsername?: string;
        legalAccepted?: boolean;
      }
    | undefined;
  ProfileInfo: undefined;
  AvatarSelection:
    | {
        entry?: 'onboarding' | 'profile';
        mode?: 'onboarding' | 'profile-edit';
      }
    | undefined;
  Home: undefined;
  VoiceCall:
    | {
        mode?: 'friend_call';
        matchReady?: boolean;
        matchedUserId?: string;
        partnerUserId?: string;
        queueMode?: MatchmakingMode;
        friendCall?: boolean;
        partnerName?: string;
        partnerAvatarId?: string;
        durationSeconds?: number;
        matchRoomId?: string;
        roomId?: string;
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
