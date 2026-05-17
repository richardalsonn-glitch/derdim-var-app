type SafeLogContext = {
  functionName?: string;
  source?: string;
  table?: string;
  rpc?: string;
};

type SafeErrorShape = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
};

const REDACT_PATTERNS: [RegExp, string][] = [
  [/(bearer\s+)[a-z0-9\-._~+/]+=*/gi, '$1[REDACTED]'],
  [/("?(?:token|access_token|refresh_token|service_role|apikey|api_key|authorization|secret)"?\s*[:=]\s*")([^"]+)(")/gi, '$1[REDACTED]$3'],
  [/('(?:token|access_token|refresh_token|service_role|apikey|api_key|authorization|secret)'\s*[:=]\s*')([^']+)(')/gi, '$1[REDACTED]$3'],
  [/((?:token|access_token|refresh_token|service_role|apikey|api_key|authorization|secret)\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]'],
];

function redactValue(input: string) {
  return REDACT_PATTERNS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), input);
}

function toSafeString(value: unknown) {
  if (typeof value === 'string') {
    return redactValue(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (!value) {
    return '';
  }

  try {
    return redactValue(JSON.stringify(value));
  } catch {
    return '';
  }
}

function normalizeError(error: unknown): SafeErrorShape {
  if (!error) {
    return {};
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  if (typeof error === 'object') {
    const maybeError = error as Record<string, unknown>;
    return {
      code: toSafeString(maybeError.code),
      message: toSafeString(maybeError.message),
      details: toSafeString(maybeError.details),
      hint: toSafeString(maybeError.hint),
      status: typeof maybeError.status === 'number' ? maybeError.status : undefined,
    };
  }

  return { message: toSafeString(error) };
}

export function getSafeErrorMessage(error: unknown, fallbackMessage = 'Beklenmeyen bir hata oluştu.') {
  const normalized = normalizeError(error);
  return normalized.message || fallbackMessage;
}

function resolveContextAndFallback(contextOrFallback?: SafeLogContext | string, fallbackMessage?: string) {
  if (typeof contextOrFallback === 'string') {
    return { context: undefined, fallback: contextOrFallback };
  }

  return { context: contextOrFallback, fallback: fallbackMessage };
}

function formatDebug(scope: string, error: unknown, context?: SafeLogContext, fallbackMessage?: string) {
  const normalized = normalizeError(error);

  if (!__DEV__) {
    return `${scope}: ${normalized.message || fallbackMessage || 'Beklenmeyen bir hata oluştu.'}`;
  }

  const parts = [
    `scope=${scope}`,
    context?.functionName ? `fn=${context.functionName}` : '',
    context?.rpc ? `rpc=${context.rpc}` : '',
    context?.table ? `table=${context.table}` : '',
    context?.source ? `source=${context.source}` : '',
    normalized.code ? `code=${normalized.code}` : '',
    normalized.status ? `status=${normalized.status}` : '',
    normalized.message ? `message=${normalized.message}` : '',
    normalized.details ? `details=${normalized.details}` : '',
    normalized.hint ? `hint=${normalized.hint}` : '',
  ].filter(Boolean);

  return parts.join(' | ');
}

export function logSafeError(scope: string, error: unknown, contextOrFallback?: SafeLogContext | string, fallbackMessage?: string) {
  const { context, fallback } = resolveContextAndFallback(contextOrFallback, fallbackMessage);
  console.warn(formatDebug(scope, error, context, fallback));
}

export function logSafeWarn(scope: string, error: unknown, contextOrFallback?: SafeLogContext | string, fallbackMessage?: string) {
  const { context, fallback } = resolveContextAndFallback(contextOrFallback, fallbackMessage);
  console.warn(formatDebug(scope, error, context, fallback));
}

export function logSafeDebug(scope: string, error: unknown, contextOrFallback?: SafeLogContext | string, fallbackMessage?: string) {
  if (!__DEV__) {
    return;
  }

  const { context, fallback } = resolveContextAndFallback(contextOrFallback, fallbackMessage);
  console.debug(formatDebug(scope, error, context, fallback));
}
