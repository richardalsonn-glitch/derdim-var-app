import { Asset } from 'expo-asset';
import { ImageSourcePropType } from 'react-native';
import { canonicalAvatarIds } from './avatarAssetMap';
import { avatarAssetMap } from './avatarAssetMap';
import { resolveAvatarSource } from './avatarResolver';

const preloadAvatarIds = canonicalAvatarIds;

export function getAvatarAssetSource(avatarId: string): ImageSourcePropType | undefined {
  return resolveAvatarSource(avatarId) ?? avatarAssetMap[avatarId as keyof typeof avatarAssetMap];
}

let avatarPreloadPromise: Promise<void> | null = null;

export function preloadAvatarAssets() {
  if (!avatarPreloadPromise) {
    avatarPreloadPromise = Promise.all(
      preloadAvatarIds.map((avatarId) => Asset.fromModule(avatarAssetMap[avatarId]).downloadAsync()),
    ).then(() => undefined);
  }

  return avatarPreloadPromise;
}
