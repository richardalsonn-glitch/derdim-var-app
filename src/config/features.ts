const livekitFlag = process.env.EXPO_PUBLIC_ENABLE_LIVEKIT?.trim().toLowerCase();
const demoModeFlag = process.env.EXPO_PUBLIC_DEMO_MODE?.trim().toLowerCase();

export const isLiveKitEnabled = livekitFlag === 'true';
export const isDemoMode = demoModeFlag === 'true';
