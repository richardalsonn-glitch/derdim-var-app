import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { getSession } from './authService';

type ServiceResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

const FRIENDLY_ACCOUNT_ERROR = 'Hesap islemi su anda tamamlanamadi. Lutfen tekrar deneyin.';

export async function freezeCurrentAccount(): Promise<ServiceResult<true>> {
  const sessionResult = await getSession();
  const userId = sessionResult.data?.user?.id;

  if (!isSupabaseConfigured || !userId) {
    return { data: null, error: { message: 'Aktif oturum bulunamadi.' } };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ status: 'frozen', is_frozen: true, is_online: false })
    .eq('user_id', userId);

  if (error) {
    console.error('[account] freeze failed:', error.message);
    return { data: null, error: { message: FRIENDLY_ACCOUNT_ERROR } };
  }

  return { data: true, error: null };
}

export async function reactivateCurrentAccount(): Promise<ServiceResult<true>> {
  const sessionResult = await getSession();
  const userId = sessionResult.data?.user?.id;

  if (!isSupabaseConfigured || !userId) {
    return { data: null, error: { message: 'Aktif oturum bulunamadi.' } };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ status: 'active', is_frozen: false, last_seen_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('[account] reactivate failed:', error.message);
    return { data: null, error: { message: FRIENDLY_ACCOUNT_ERROR } };
  }

  return { data: true, error: null };
}

export async function deleteCurrentAccount(): Promise<ServiceResult<true>> {
  const sessionResult = await getSession();
  const sessionToken = sessionResult.data?.access_token;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

  if (!sessionToken || !supabaseUrl) {
    return { data: null, error: { message: 'Aktif oturum bulunamadi.' } };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        data: null,
        error: { message: getFriendlyErrorMessage(typeof payload?.error === 'string' ? payload.error : null, FRIENDLY_ACCOUNT_ERROR) },
      };
    }

    await supabase.auth.signOut();
    return { data: true, error: null };
  } catch (error) {
    console.error('[account] delete failed:', error instanceof Error ? error.message : 'unknown error');
    return { data: null, error: { message: getFriendlyErrorMessage(error, FRIENDLY_ACCOUNT_ERROR) } };
  }
}
