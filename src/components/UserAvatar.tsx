import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { logSafeDebug } from '../lib/safeLogger';
import { Gender } from '../types';
import { getDeterministicAvatarId, resolveAvatarMeta } from '../utils/avatarResolver';
import { getSymbolDefinition } from '../utils/symbolAvatar';

type AvatarSourceType = 'current-profile' | 'peer-profile' | 'friend-profile' | 'route-param';

type UserAvatarScreen =
  | 'home'
  | 'friends'
  | 'friend-profile'
  | 'incoming-call'
  | 'outgoing-call'
  | 'voicecall'
  | 'night-mode'
  | 'night-room';

type UserAvatarProps = {
  avatarId?: string | null;
  username?: string;
  currentUserId?: string | null;
  renderedUserId?: string | null;
  avatarSourceType?: AvatarSourceType;
  size?: number;
  fallbackGender?: Gender | null;
  style?: StyleProp<ViewStyle>;
  screen?: UserAvatarScreen;
};

export function UserAvatar({
  avatarId,
  username,
  currentUserId,
  renderedUserId,
  avatarSourceType,
  size = 88,
  fallbackGender,
  style,
  screen,
}: UserAvatarProps) {
  const normalizedAvatarId = typeof avatarId === 'string' ? avatarId.trim() : '';
  const effectiveAvatarId = normalizedAvatarId || (renderedUserId ? getDeterministicAvatarId(renderedUserId, fallbackGender) : avatarId);
  const avatarMeta = resolveAvatarMeta(effectiveAvatarId, fallbackGender);
  const symbol = getSymbolDefinition(avatarMeta.canonicalId);

  if (__DEV__ && screen && avatarSourceType) {
    logSafeDebug(
      '[avatar-source]',
      `screen:${screen} currentUserId:${currentUserId ?? 'unknown'} renderedUserId:${renderedUserId ?? 'unknown'} avatarSourceType:${avatarSourceType} rawAvatarId:${normalizedAvatarId || 'empty'} canonicalAvatarId:${avatarMeta.canonicalId}`,
    );
    logSafeDebug(
      '[avatar-render]',
      `screen:${screen} rawAvatarId:${normalizedAvatarId || 'empty'} canonicalAvatarId:${avatarMeta.canonicalId} hasAsset:${avatarMeta.assetFound} fallbackUsed:${avatarMeta.fallbackUsed} reason:${avatarMeta.fallbackReason ?? (normalizedAvatarId ? 'none' : renderedUserId ? 'missing-avatar-id-deterministic-user' : 'none')} username:${username?.trim() || 'unknown'}`,
    );
  }

  return (
    <View style={style}>
      <LinearGradient
        colors={symbol.palette}
        style={[styles.core, { width: size, height: size, borderRadius: size / 2, shadowColor: symbol.glow }]}
      >
        <View style={[styles.halo, { backgroundColor: symbol.accent }]} />
        <Ionicons color={symbol.accent} name={symbol.icon} size={Math.max(18, Math.round(size * 0.46))} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  core: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    elevation: 8,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
  },
  halo: {
    borderRadius: 999,
    height: '74%',
    opacity: 0.16,
    position: 'absolute',
    width: '74%',
  },
});
