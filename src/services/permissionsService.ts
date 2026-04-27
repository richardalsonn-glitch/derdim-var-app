import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';

// TODO: Supabase Realtime / WebRTC sesli eslesme baglanacak

export type MicrophonePermissionResult = {
  granted: boolean;
  canAskAgain: boolean;
};

export async function requestMicrophonePermission(): Promise<MicrophonePermissionResult> {
  const current = await getRecordingPermissionsAsync();

  if (current.granted) {
    return { granted: true, canAskAgain: current.canAskAgain };
  }

  const next = await requestRecordingPermissionsAsync();
  return { granted: next.granted, canAskAgain: next.canAskAgain };
}
