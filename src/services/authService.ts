import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { defaultProfile } from '../data/mockData';
import { getSafeErrorMessage, logSafeError } from '../lib/safeLogger';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { MembershipPlan } from '../types';

WebBrowser.maybeCompleteAuthSession();

type AuthServiceError = {
  message: string;
};

type AuthServiceResult<T> = {
  data: T | null;
  error: AuthServiceError | null;
};

type ProfileSeed = {
  username: string;
  plan: MembershipPlan;
  avatarId: string;
  email?: string;
};

type AuthPayload = {
  user: User | null;
  session: Session | null;
  profile: ProfileSeed | null;
};

const AUTH_CALLBACK_PATH = 'auth-callback';
const NATIVE_REDIRECT_URI = 'derdimvar://auth-callback';

export const authRedirectUri = makeRedirectUri({
  scheme: 'derdimvar',
  path: AUTH_CALLBACK_PATH,
});

function getMissingEnvError(): AuthServiceError {
  return {
    message:
      'Supabase env bilgileri eksik. EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY degerlerini doldur.',
  };
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function slugifyUsername(value: string) {
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized.slice(0, 24);
}

function buildUsername(user: User, preferredName?: string) {
  const candidates = [
    preferredName,
    normalizeText(user.user_metadata?.username),
    normalizeText(user.user_metadata?.full_name),
    normalizeText(user.user_metadata?.name),
    normalizeText(user.user_metadata?.given_name),
    normalizeText(user.email?.split('@')[0]),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const slug = slugifyUsername(candidate);

    if (slug.length > 0) {
      return slug;
    }
  }

  return `gizli_kullanici_${user.id.slice(0, 6)}`;
}

function parseCallbackUrl(url: string) {
  const [baseUrl, hashFragment = ''] = url.split('#');
  const queryString = baseUrl.includes('?') ? baseUrl.split('?')[1] ?? '' : '';
  const query = new URLSearchParams(queryString);
  const hash = new URLSearchParams(hashFragment);

  const getValue = (key: string) => hash.get(key) ?? query.get(key) ?? undefined;

  return {
    error: getValue('error'),
    errorDescription: getValue('error_description'),
    accessToken: getValue('access_token'),
    refreshToken: getValue('refresh_token'),
    code: getValue('code'),
  };
}

function normalizePlan(value: unknown): MembershipPlan {
  return value === 'plus' || value === 'vip' ? value : 'free';
}

async function upsertProfileRecord(
  user: User,
  seed?: Partial<Pick<ProfileSeed, 'username' | 'plan' | 'avatarId'>>,
): Promise<ProfileSeed> {
  const fallbackProfile: ProfileSeed = {
    username: normalizeText(seed?.username) || buildUsername(user),
    plan: seed?.plan ?? 'free',
    avatarId: normalizeText(seed?.avatarId) || defaultProfile.avatarId,
    email: user.email ?? undefined,
  };

  if (!isSupabaseConfigured) {
    return fallbackProfile;
  }

  try {
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('user_id, username, plan, avatar_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existingProfile) {
      return {
        username: normalizeText(existingProfile.username) || fallbackProfile.username || 'user',
        plan: normalizePlan(existingProfile.plan),
        avatarId: normalizeText(existingProfile.avatar_id) || fallbackProfile.avatarId,
        email: fallbackProfile.email,
      };
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          username: fallbackProfile.username || 'user',
          plan: fallbackProfile.plan,
          avatar_id: fallbackProfile.avatarId,
          email: fallbackProfile.email ?? null,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('user_id, username, plan, avatar_id')
      .single();

    if (error) {
      throw error;
    }

    return {
      username: normalizeText(data?.username) || fallbackProfile.username || 'user',
      plan: normalizePlan(data?.plan),
      avatarId: normalizeText(data?.avatar_id) || fallbackProfile.avatarId,
      email: fallbackProfile.email,
    };
  } catch (error) {
    console.warn('[auth] profiles upsert skipped:', getSafeErrorMessage(error, 'unknown error'));
    return fallbackProfile;
  }
}

async function ensureProfileRecord(user: User, preferredName?: string): Promise<ProfileSeed> {
  return upsertProfileRecord(user, {
    username: buildUsername(user, preferredName) || 'user',
    plan: 'free',
    avatarId: defaultProfile.avatarId,
  });
}

function toAuthError(error: unknown, fallbackMessage: string): AuthServiceError {
  if (error instanceof Error && error.message) {
    return { message: error.message };
  }

  return { message: fallbackMessage };
}

async function finalizeAuthSession(
  resultUrl: string,
): Promise<AuthServiceResult<{ user: User | null; session: Session | null }>> {
  const callbackData = parseCallbackUrl(resultUrl);

  if (callbackData.error) {
    return {
      data: null,
      error: {
        message: callbackData.errorDescription ?? 'Sosyal giris sirasinda bir hata olustu.',
      },
    };
  }

  if (callbackData.accessToken && callbackData.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: callbackData.accessToken,
      refresh_token: callbackData.refreshToken,
    });

    return {
      data: error ? null : { user: data.user, session: data.session },
      error: error ? { message: error.message } : null,
    };
  }

  if (callbackData.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(callbackData.code);

    return {
      data: error ? null : { user: data.user, session: data.session },
      error: error ? { message: error.message } : null,
    };
  }

  return {
    data: null,
    error: {
      message: 'Auth callback icinde session veya code bulunamadi.',
    },
  };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  username: string,
): Promise<AuthServiceResult<{ user: User | null; session: Session | null }>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
    },
  });

  if (!error && data.user) {
    await upsertProfileRecord(data.user, {
      username: normalizeText(username) || 'user',
      plan: 'free',
      avatarId: defaultProfile.avatarId,
    });
  }

  return {
    data: error ? null : { user: data.user, session: data.session },
    error: error ? { message: error.message } : null,
  };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthServiceResult<{ user: User | null; session: Session | null }>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return {
    data: error ? null : { user: data.user, session: data.session },
    error: error ? { message: error.message } : null,
  };
}

export async function signOut(): Promise<AuthServiceResult<true>> {
  if (!isSupabaseConfigured) {
    console.warn('[auth] signOut called without Supabase env. Clearing local navigation only.');
    return { data: true, error: null };
  }

  const { error } = await supabase.auth.signOut();
  return {
    data: error ? null : true,
    error: error ? { message: error.message } : null,
  };
}

export async function getCurrentUser(): Promise<AuthServiceResult<User | null>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  const { data, error } = await supabase.auth.getUser();
  return {
    data: error ? null : data.user,
    error: error ? { message: error.message } : null,
  };
}

export async function getSession(): Promise<AuthServiceResult<Session | null>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  const { data, error } = await supabase.auth.getSession();
  return {
    data: error ? null : data.session,
    error: error ? { message: error.message } : null,
  };
}

export async function restoreAuthProfile(
  preferredUser?: User | null,
): Promise<AuthServiceResult<AuthPayload>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  const sessionResult = await getSession();

  if (sessionResult.error) {
    return { data: null, error: sessionResult.error };
  }

  const session = sessionResult.data;
  const user = preferredUser ?? session?.user ?? null;

  if (!session || !user) {
    return {
      data: { user: null, session: null, profile: null },
      error: null,
    };
  }

  const profile = await ensureProfileRecord(user);

  return {
    data: { user, session, profile },
    error: null,
  };
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function updateCurrentUserPlan(plan: MembershipPlan): Promise<AuthServiceResult<ProfileSeed>> {
  const userResult = await getCurrentUser();

  if (userResult.error) {
    return { data: null, error: userResult.error };
  }

  if (!userResult.data) {
    return {
      data: null,
      error: { message: 'Plan guncellemek icin aktif oturum bulunamadi.' },
    };
  }

  const baseProfile = await ensureProfileRecord(userResult.data);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: userResult.data.id,
          username: baseProfile.username || 'user',
          plan,
          avatar_id: baseProfile.avatarId,
          email: userResult.data.email ?? null,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('username, plan, avatar_id')
      .single();

    if (error) {
      return { data: null, error: { message: error.message } };
    }

    return {
      data: {
        username: normalizeText(data?.username) || baseProfile.username || 'user',
        plan: normalizePlan(data?.plan),
        avatarId: normalizeText(data?.avatar_id) || baseProfile.avatarId,
        email: userResult.data.email ?? undefined,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toAuthError(error, 'Plan guncellenemedi.'),
    };
  }
}

export async function signInWithApple(): Promise<AuthServiceResult<AuthPayload>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  if (Platform.OS !== 'ios') {
    return {
      data: null,
      error: {
        message: 'Apple ile giris yalnizca iOS cihazlarda kullanilabilir.',
      },
    };
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync();

    if (!available) {
      return {
        data: null,
        error: {
          message: 'Bu cihazda Apple ile giris kullanilamiyor.',
        },
      };
    }

    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return {
        data: null,
        error: {
          message: 'Apple kimlik dogrulama tokeni alinmadi.',
        },
      };
    }

    const fullName = [
      normalizeText(credential.fullName?.givenName),
      normalizeText(credential.fullName?.middleName),
      normalizeText(credential.fullName?.familyName),
    ]
      .filter(Boolean)
      .join(' ');

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      return { data: null, error: { message: error.message } };
    }

    const profile = data.user ? await ensureProfileRecord(data.user, fullName) : null;

    return {
      data: { user: data.user, session: data.session, profile },
      error: null,
    };
  } catch (error) {
    logSafeError('[auth] Apple sign-in failed', error);

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ERR_REQUEST_CANCELED'
    ) {
      return {
        data: null,
        error: { message: 'Apple ile giris iptal edildi.' },
      };
    }

    return { data: null, error: toAuthError(error, 'Apple ile giris basarisiz oldu.') };
  }
}

export async function signInWithGoogle(): Promise<AuthServiceResult<AuthPayload>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { data: null, error: { message: error.message } };
    }

    if (!data?.url) {
      return {
        data: null,
        error: { message: 'Google auth URL olusturulamadi.' },
      };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, authRedirectUri);

    if (result.type !== 'success' || !result.url) {
      return {
        data: null,
        error: {
          message:
            result.type === 'cancel' || result.type === 'dismiss'
              ? 'Google ile giris iptal edildi.'
              : 'Google auth oturumu tamamlanamadi.',
        },
      };
    }

    const authResult = await finalizeAuthSession(result.url);

    if (authResult.error || !authResult.data?.user) {
      return {
        data: null,
        error: authResult.error ?? { message: 'Google ile giris tamamlanamadi.' },
      };
    }

    const profile = await ensureProfileRecord(authResult.data.user);

    return {
      data: {
        user: authResult.data.user,
        session: authResult.data.session,
        profile,
      },
      error: null,
    };
  } catch (error) {
    logSafeError('[auth] Google sign-in failed', error);
    return { data: null, error: toAuthError(error, 'Google ile giris basarisiz oldu.') };
  }
}
