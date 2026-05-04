export function getSafeErrorMessage(error: unknown, fallbackMessage = 'Beklenmeyen bir hata olustu.') {
  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return fallbackMessage;
}

export function logSafeError(scope: string, error: unknown, fallbackMessage?: string) {
  console.error(`${scope}: ${getSafeErrorMessage(error, fallbackMessage)}`);
}
