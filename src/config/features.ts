import Constants from 'expo-constants';

const livekitFlag = process.env.EXPO_PUBLIC_ENABLE_LIVEKIT?.trim().toLowerCase();
const demoModeFlag = process.env.EXPO_PUBLIC_DEMO_MODE?.trim().toLowerCase();
const livekitUrl = process.env.EXPO_PUBLIC_LIVEKIT_URL?.trim();
const livekitTokenEndpoint = process.env.EXPO_PUBLIC_LIVEKIT_TOKEN_ENDPOINT?.trim();
const isExpoGo = Constants.appOwnership === 'expo';

export const isLiveKitEnabled = !isExpoGo && (livekitFlag === 'true' || (livekitFlag !== 'false' && Boolean(livekitUrl && livekitTokenEndpoint)));
export const isDemoMode = demoModeFlag === 'true';
