export const avatarAssetMap = {
  apollo: require('../../assets/avatars/apollo.png'),
  hermes: require('../../assets/avatars/hermes.png'),
  ares: require('../../assets/avatars/ares.png'),
  poseidon: require('../../assets/avatars/poseidon.png'),
  aphrodite: require('../../assets/avatars/aphrodite.png'),
  athena: require('../../assets/avatars/athena.png'),
  selene: require('../../assets/avatars/selene.png'),
  iris: require('../../assets/avatars/iris.png'),
} as const;

export type CanonicalAvatarId = keyof typeof avatarAssetMap;

export const canonicalAvatarIds = Object.keys(avatarAssetMap) as CanonicalAvatarId[];
