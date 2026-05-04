const DEFAULT_ERROR_MESSAGE = 'Bir sorun oluştu. Lütfen tekrar deneyin.';

function normalizeError(error: unknown) {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return String(error);
}

export function getFriendlyErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE) {
  const message = normalizeError(error).trim();
  const lower = message.toLowerCase();

  if (!message) {
    return fallback;
  }

  if (lower.includes('invalid login credentials') || lower.includes('user not found') || lower.includes('deleted account')) {
    return 'Bu hesap silinmiş veya bilgiler hatalı. Lütfen yeniden kayıt ol.';
  }

  if (lower.includes('email not confirmed')) {
    return 'E-posta adresini doğrulaman gerekiyor.';
  }

  if (lower.includes('user already registered') || lower.includes('already registered')) {
    return 'Bu e-posta ile kayıtlı bir hesap var. Giriş yapmayı deneyebilirsin.';
  }

  if (lower.includes('password should be') || lower.includes('password')) {
    return 'Şifren yeterince güçlü değil. Lütfen daha güçlü bir şifre belirle.';
  }

  if (lower.includes('network request failed') || lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Bağlantı sorunu yaşandı. İnternetini kontrol edip tekrar dene.';
  }

  if (lower.includes('duplicate key value') || lower.includes('duplicate key')) {
    return 'İşlem zaten başlatılmış görünüyor. Lütfen birkaç saniye sonra tekrar dene.';
  }

  if (lower.includes('could not find the table') || lower.includes('schema cache') || lower.includes('relation') && lower.includes('does not exist')) {
    return 'Bu özellik şu anda hazırlanıyor. Lütfen daha sonra tekrar dene.';
  }

  if (lower.includes('mode is ambiguous') || lower.includes('column reference') || lower.includes('ambiguous')) {
    return 'Eşleşme başlatılamadı. Lütfen tekrar deneyin.';
  }

  if (lower.includes('missing authorization header') || lower.includes('unauthorized') || lower.includes('jwt') || lower.includes('oturum')) {
    return 'Oturumun sona ermiş olabilir. Lütfen tekrar giriş yap.';
  }

  if (lower.includes('livekit') || lower.includes('token endpoint')) {
    return 'Sesli görüşme başlatılamadı. Lütfen tekrar deneyin.';
  }

  return fallback;
}

export function isMissingTableError(error: unknown) {
  const message = normalizeError(error).toLowerCase();

  return message.includes('could not find the table') || message.includes('schema cache') || (message.includes('relation') && message.includes('does not exist'));
}
