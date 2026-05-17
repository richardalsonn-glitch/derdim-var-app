import { logSafeDebug } from '../lib/safeLogger';
import { Gender } from '../types';
import { legacyAvatarToSymbolMap, SymbolId, symbolAvatarIds } from './symbolAvatar';

type AvatarDefinition = {
  canonicalId: SymbolId;
  gender: Gender;
  aliases: string[];
};

const avatarDefinitions: AvatarDefinition[] = [
  { canonicalId: 'heart', gender: 'Kadın', aliases: ['heart'] },
  { canonicalId: 'moon', gender: 'Kadın', aliases: ['moon'] },
  { canonicalId: 'headset', gender: 'Erkek', aliases: ['headset'] },
  { canonicalId: 'wave', gender: 'Erkek', aliases: ['wave'] },
];

const avatarAliasMap = new Map<string, AvatarDefinition>();

export type AvatarFallbackReason =
  | 'missing-avatar-id'
  | 'unsupported-avatar-id'
  | 'asset-not-found'
  | null;

function normalizeGender(gender?: Gender | null) {
  return gender === 'Erkek' || gender === 'Kadın' ? gender : null;
}

export function normalizeAvatarId(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-');

  if (/^(f|female|woman)-?[1-4]$/.test(normalized)) {
    return `f-${normalized.slice(-1)}`;
  }

  if (/^(m|male|man)-?[1-4]$/.test(normalized)) {
    return `m-${normalized.slice(-1)}`;
  }

  if (/^(female|woman)[1-4]$/.test(normalized)) {
    return `f-${normalized.slice(-1)}`;
  }

  if (/^(male|man)[1-4]$/.test(normalized)) {
    return `m-${normalized.slice(-1)}`;
  }

  return normalized;
}

avatarDefinitions.forEach((definition) => {
  definition.aliases.forEach((alias) => {
    avatarAliasMap.set(normalizeAvatarId(alias), definition);
  });
});

Object.entries(legacyAvatarToSymbolMap).forEach(([legacyId, symbolId]) => {
  const definition = avatarDefinitions.find((item) => item.canonicalId === symbolId);

  if (definition) {
    avatarAliasMap.set(normalizeAvatarId(legacyId), definition);
  }
});

function getGenderFallback(gender?: Gender | null) {
  if (normalizeGender(gender) === 'Erkek') {
    return avatarDefinitions.find((definition) => definition.canonicalId === 'headset') ?? avatarDefinitions[0];
  }

  return avatarDefinitions.find((definition) => definition.canonicalId === 'heart') ?? avatarDefinitions[0];
}

export function getDeterministicAvatarId(seed: string, gender?: Gender | null): SymbolId {
  const normalizedSeed = String(seed ?? '').trim();

  if (!normalizedSeed) {
    return getGenderFallback(gender).canonicalId;
  }

  const hash = [...normalizedSeed].reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);
  return symbolAvatarIds[Math.abs(hash) % symbolAvatarIds.length] ?? getGenderFallback(gender).canonicalId;
}

export function resolveAvatarMeta(avatarId: unknown, gender?: Gender | null) {
  const rawAvatarId = typeof avatarId === 'string' ? avatarId : avatarId == null ? '' : String(avatarId);
  const normalizedAvatarId = normalizeAvatarId(avatarId);
  const matched = normalizedAvatarId ? avatarAliasMap.get(normalizedAvatarId) : undefined;
  const fallback = getGenderFallback(gender);
  const resolved = matched ?? fallback;
  const fallbackReason: AvatarFallbackReason = !normalizedAvatarId
    ? 'missing-avatar-id'
    : !matched
      ? 'unsupported-avatar-id'
      : null;
  const fallbackUsed = fallbackReason !== null;

  if (__DEV__) {
    logSafeDebug(
      '[avatar-resolver]',
      `rawAvatarId:${rawAvatarId || 'empty'} normalizedAvatarId:${normalizedAvatarId || 'empty'} canonicalAvatarId:${resolved.canonicalId} assetFound:true fallbackUsed:${fallbackUsed} fallbackReason:${fallbackReason ?? 'none'}`,
    );
  }

  return {
    rawAvatarId,
    normalizedAvatarId,
    canonicalId: resolved.canonicalId,
    sourceName: resolved.canonicalId,
    source: undefined,
    gender: resolved.gender,
    assetFound: true,
    fallbackUsed,
    fallbackReason,
  };
}

export function resolveAvatarId(avatarId: unknown, gender?: Gender | null) {
  return resolveAvatarMeta(avatarId, gender).canonicalId;
}

export function resolveAvatarSource(avatarId: unknown, gender?: Gender | null) {
  return resolveAvatarMeta(avatarId, gender).source;
}

export function getAvatarSourceName(avatarId: unknown, gender?: Gender | null) {
  return resolveAvatarMeta(avatarId, gender).sourceName;
}

export function getSupportedAvatarSourceNames() {
  return [...symbolAvatarIds];
}
