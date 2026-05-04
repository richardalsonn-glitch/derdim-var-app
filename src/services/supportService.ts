import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { getCurrentUser } from './authService';

type SupportReportInput = {
  type: 'report' | 'support' | 'safety';
  message: string;
  reportedUserId?: string | null;
};

type ServiceResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export async function submitSupportReport(input: SupportReportInput): Promise<ServiceResult<true>> {
  const trimmedMessage = input.message.trim();

  if (!trimmedMessage) {
    return { data: null, error: { message: 'Lütfen kısa bir açıklama yaz.' } };
  }

  if (!isSupabaseConfigured) {
    return { data: true, error: null };
  }

  const userResult = await getCurrentUser();

  if (userResult.error || !userResult.data?.id) {
    return { data: null, error: { message: 'Oturumun sona ermiş olabilir. Lütfen tekrar giriş yap.' } };
  }

  const { error } = await supabase.from('support_reports').insert({
    reporter_id: userResult.data.id,
    reported_user_id: input.reportedUserId ?? null,
    type: input.type,
    message: trimmedMessage,
  });

  if (error) {
    console.error('[support] submit report failed:', error.message);
    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Talebin gönderilemedi. Lütfen tekrar deneyin.') } };
  }

  return { data: true, error: null };
}
