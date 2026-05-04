import { isLiveKitEnabled } from '../config/features';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

type FriendCallTarget = {
  id: string;
  isOnline?: boolean;
  callStatus?: 'available' | 'busy' | 'offline';
};

type FriendCallResult = {
  allowed: boolean;
  message?: string;
};

export async function startFriendCall(target: FriendCallTarget): Promise<FriendCallResult> {
  if (!target.isOnline || target.callStatus === 'offline') {
    return { allowed: false, message: 'Bu kullanıcı şu anda çevrim dışı.' };
  }

  if (target.callStatus === 'busy') {
    return { allowed: false, message: 'Bu kullanıcı şu anda müsait değil.' };
  }

  if (!isLiveKitEnabled || !isSupabaseConfigured) {
    return { allowed: true };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ call_status: 'busy' })
    .eq('user_id', target.id)
    .eq('call_status', 'available');

  if (error) {
    console.error('[friend-call] start failed:', error.message);
    return { allowed: false, message: getFriendlyErrorMessage(error, 'Arkadaş çağrısı başlatılamadı. Lütfen tekrar deneyin.') };
  }

  return { allowed: true };
}
