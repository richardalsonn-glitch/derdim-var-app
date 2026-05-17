import { resolveAvatarMeta } from './avatarResolver';

export function buildFriendCallAvatarLog(params: {
  screen: 'outgoing' | 'incoming' | 'voicecall';
  peerUserId: string;
  rawAvatarId: string | null | undefined;
}) {
  const avatarMeta = resolveAvatarMeta(params.rawAvatarId);

  return `screen:${params.screen} peerUserId:${params.peerUserId} rawAvatarId:${params.rawAvatarId ?? 'fallback'} canonicalAvatarId:${avatarMeta.canonicalId} fallbackUsed:${avatarMeta.fallbackUsed}`;
}
