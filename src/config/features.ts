const livekitFlag = process.env.EXPO_PUBLIC_ENABLE_LIVEKIT?.trim().toLowerCase();

export const isLiveKitEnabled = livekitFlag === 'true';
