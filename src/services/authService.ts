import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { defaultProfile } from '../data/mockData';
import { getSafeErrorMessage, logSafeError, logSafeWarn } from '../lib/safeLogger';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Gender, MembershipPlan } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { resolveAvatarId } from '../utils/avatarResolver';

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
  gender: Gender;
  email?: string;
  isFrozen?: boolean;
};

type AuthPayload = {
  user: User | null;
  session: Session | null;
  profile: ProfileSeed | null;
  isNewUser?: boolean;
  requiresProfileCompletion?: boolean;
};

type EmailSignUpPayload = {
  user: User | null;
  session: Session | null;
  requiresEmailConfirmation: boolean;
};

type ProfileSeedResult = {
  profile: ProfileSeed;
  isNewUser: boolean;
};

const AUTH_CALLBACK_PATH = 'auth-callback';
const NATIVE_REDIRECT_URI = 'derdimvar://auth-callback';
const DEFAULT_PROFILE_AVATAR_ID = 'heart';

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

function normalizeOptionalAvatarId(value: unknown) {
  return normalizeText(value);
}

function normalizeGender(value: unknown): Gender {
  return value === 'Erkek' || value === defaultProfile.gender ? value : defaultProfile.gender;
}

function getEmailPrefix(email: unknown) {
  const normalizedEmail = normalizeText(email);

  if (!normalizedEmail.includes('@')) {
    return '';
  }

  return normalizeText(normalizedEmail.split('@')[0]);
}

export function resolveUsernameByPriority(input: {
  profileUsername?: unknown;
  metadataUsername?: unknown;
  email?: unknown;
}) {
  const profileUsername = normalizeText(input.profileUsername);

  if (profileUsername) {
    return profileUsername;
  }

  const metadataUsername = normalizeText(input.metadataUsername);

  if (metadataUsername) {
    return metadataUsername;
  }

  const emailPrefix = getEmailPrefix(input.email);

  if (emailPrefix) {
    return emailPrefix;
  }

  return 'Anonim';
}

export function resolveDisplayName(input: {
  username?: unknown;
  displayName?: unknown;
  currentUserMetadataUsername?: unknown;
}) {
  const username = normalizeText(input.username);

  if (username) {
    return username;
  }

  const displayName = normalizeText(input.displayName);

  if (displayName) {
    return displayName;
  }

  const metadataUsername = normalizeText(input.currentUserMetadataUsername);

  if (metadataUsername) {
    return metadataUsername;
  }

  return 'Anonim';
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
  const prioritizedUsername = resolveUsernameByPriority({
    profileUsername: preferredName,
    metadataUsername: user.user_metadata?.username,
    email: user.email,
  });

  const slug = slugifyUsername(prioritizedUsername);

  if (slug.length > 0) {
    return slug;
  }

  return 'anonim';
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

function hasAcceptedLegal(user?: User | null) {
  return Boolean(user?.user_metadata?.legalAcceptedAt);
}

function isRecentlyCreatedUser(user?: User | null) {
  const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;

  if (!createdAt || Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() - createdAt < 2 * 60 * 1000;
}

function needsSocialProfileCompletion(user?: User | null, profile?: ProfileSeed | null, isNewUser = false) {
  if (!user) {
    return false;
  }

  const username = normalizeText(profile?.username);
  const avatarId = normalizeText(profile?.avatarId);
  return isNewUser || isRecentlyCreatedUser(user) || !hasAcceptedLegal(user) || !username || !avatarId;
}

async function upsertProfileRecord(
  user: User,
  seed?: Partial<Pick<ProfileSeed, 'username' | 'plan' | 'avatarId' | 'gender'>>,
): Promise<ProfileSeedResult> {
  const fallbackProfile: ProfileSeed = {
    username: normalizeText(seed?.username) || buildUsername(user),
    plan: seed?.plan ?? 'free',
    avatarId: normalizeText(seed?.avatarId) || DEFAULT_PROFILE_AVATAR_ID,
    gender: normalizeGender(seed?.gender),
    email: user.email ?? undefined,
    isFrozen: false,
  };

  if (!isSupabaseConfigured) {
    return { profile: fallbackProfile, isNewUser: false };
  }

  try {
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('user_id, username, plan, avatar_id, gender, status, is_frozen')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existingProfile) {
      return {
        profile: {
          username: normalizeText(existingProfile.username) || fallbackProfile.username || 'user',
          plan: normalizePlan(existingProfile.plan),
          avatarId: normalizeOptionalAvatarId(existingProfile.avatar_id),
          gender: normalizeGender(existingProfile.gender),
          email: fallbackProfile.email,
          isFrozen: Boolean(existingProfile.is_frozen) || existingProfile.status === 'frozen',
        },
        isNewUser: false,
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
          gender: fallbackProfile.gender,
          status: 'active',
          is_frozen: false,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('user_id, username, plan, avatar_id, gender')
      .single();

    if (error) {
      throw error;
    }

    return {
      profile: {
        username: normalizeText(data?.username) || fallbackProfile.username || 'user',
        plan: normalizePlan(data?.plan),
        avatarId: normalizeOptionalAvatarId(data?.avatar_id) || fallbackProfile.avatarId,
        gender: normalizeGender(data?.gender),
        email: fallbackProfile.email,
        isFrozen: false,
      },
      isNewUser: true,
    };
  } catch (error) {
    console.warn('[auth] profiles upsert skipped:', getSafeErrorMessage(error, 'unknown error'));
    return { profile: fallbackProfile, isNewUser: true };
  }
}

async function ensureProfileRecord(user: User, preferredName?: string): Promise<ProfileSeed> {
  const result = await upsertProfileRecord(user, {
    username: buildUsername(user, preferredName) || 'user',
    plan: 'free',
    avatarId: DEFAULT_PROFILE_AVATAR_ID,
    gender: defaultProfile.gender,
  });
  return result.profile;
}

function toAuthError(error: unknown, fallbackMessage: string): AuthServiceError {
  return { message: getFriendlyErrorMessage(error, fallbackMessage) };
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
      error: error ? { message: getFriendlyErrorMessage(error, 'Oturum başlatılamadı. Lütfen tekrar deneyin.') } : null,
    };
  }

  if (callbackData.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(callbackData.code);

    return {
      data: error ? null : { user: data.user, session: data.session },
      error: error ? { message: getFriendlyErrorMessage(error, 'Oturum başlatılamadı. Lütfen tekrar deneyin.') } : null,
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
): Promise<AuthServiceResult<EmailSignUpPayload>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authRedirectUri,
      data: {
        username,
      },
    },
  });

  if (error) {
    console.warn('[auth] signUp failed:', { code: error.code, message: error.message });
  }

  if (!error && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      data: null,
      error: { message: getFriendlyErrorMessage('user_already_exists', 'Bu e-posta ile kayıtlı bir hesap var. Giriş yapmayı deneyebilirsin.') },
    };
  }


  if (!error && data.user) {
    await upsertProfileRecord(data.user, {
      username: normalizeText(username) || 'user',
      plan: 'free',
      avatarId: DEFAULT_PROFILE_AVATAR_ID,
      gender: defaultProfile.gender,
    });
  }

  if (!error && data.user && !data.session) {
    const signInResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInResult.error && signInResult.data.session) {
      return {
        data: {
          user: signInResult.data.user,
          session: signInResult.data.session,
          requiresEmailConfirmation: false,
        },
        error: null,
      };
    }

    return {
      data: {
        user: data.user,
        session: null,
        requiresEmailConfirmation: true,
      },
      error: null,
    };
  }
  return {
    data: error ? null : { user: data.user, session: data.session, requiresEmailConfirmation: false },
    error: error ? { message: getFriendlyErrorMessage(error, 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.') } : null,
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

  if (error) {
    console.warn('[auth] signIn failed:', { code: error.code, message: error.message });
  }

  return {
    data: error ? null : { user: data.user, session: data.session },
    error: error ? { message: getFriendlyErrorMessage(error, 'Giriş yapılamadı. Lütfen bilgilerini kontrol edip tekrar dene.') } : null,
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
    error: error ? { message: getFriendlyErrorMessage(error, 'Çıkış yapılamadı. Lütfen tekrar deneyin.') } : null,
  };
}

export async function getCurrentUser(): Promise<AuthServiceResult<User | null>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  const { data, error } = await supabase.auth.getUser();
  return {
    data: error ? null : data.user,
    error: error ? { message: getFriendlyErrorMessage(error, 'Oturum bilgileri alınamadı. Lütfen tekrar giriş yap.') } : null,
  };
}

export async function getSession(): Promise<AuthServiceResult<Session | null>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  const { data, error } = await supabase.auth.getSession();
  return {
    data: error ? null : data.session,
    error: error ? { message: getFriendlyErrorMessage(error, 'Oturum bilgileri alınamadı. Lütfen tekrar giriş yap.') } : null,
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
      .update({
        username: baseProfile.username || 'user',
        plan,
        avatar_id: baseProfile.avatarId || null,
        status: 'active',
        is_frozen: false,
      })
      .eq('user_id', userResult.data.id)
      .select('username, plan, avatar_id')
      .single();

    if (error) {
      return { data: null, error: { message: getFriendlyErrorMessage(error, 'Plan güncellenemedi.') } };
    }

    return {
      data: {
        username: normalizeText(data?.username) || baseProfile.username || 'user',
        plan: normalizePlan(data?.plan),
        avatarId: normalizeOptionalAvatarId(data?.avatar_id),
        gender: baseProfile.gender,
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

export async function updateCurrentUserAvatarSelection(
  avatarId: string,
  gender?: Gender,
): Promise<AuthServiceResult<ProfileSeed>> {
  const userResult = await getCurrentUser();

  if (userResult.error) {
    return { data: null, error: userResult.error };
  }

  if (!userResult.data) {
    return {
      data: null,
      error: { message: 'Avatar guncellemek icin aktif oturum bulunamadi.' },
    };
  }

  const rawAvatarId = normalizeText(avatarId);

  if (!rawAvatarId) {
    return {
      data: null,
      error: { message: 'Devam etmek icin bir sembol secmelisin.' },
    };
  }

  const normalizedAvatarId = resolveAvatarId(rawAvatarId, gender);
  const normalizedGender = normalizeGender(gender);
  const baseProfile = await ensureProfileRecord(userResult.data);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        username: baseProfile.username || 'user',
        plan: baseProfile.plan,
        avatar_id: normalizedAvatarId,
        gender: normalizedGender,
        status: baseProfile.isFrozen ? 'frozen' : 'active',
        is_frozen: Boolean(baseProfile.isFrozen),
      })
      .eq('user_id', userResult.data.id)
      .select('username, plan, avatar_id, gender, is_frozen')
      .single();

    if (error) {
      return { data: null, error: { message: getFriendlyErrorMessage(error, 'Avatar kaydedilemedi.') } };
    }

    return {
      data: {
        username: normalizeText(data?.username) || baseProfile.username || 'user',
        plan: normalizePlan(data?.plan),
        avatarId: normalizeOptionalAvatarId(data?.avatar_id) || normalizedAvatarId,
        gender: normalizeGender(data?.gender),
        email: userResult.data.email ?? undefined,
        isFrozen: Boolean(data?.is_frozen),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toAuthError(error, 'Avatar kaydedilemedi.'),
    };
  }
}

export async function updateCurrentUserProfileDetails(input: {
  gender: Gender;
}): Promise<AuthServiceResult<ProfileSeed>> {
  const userResult = await getCurrentUser();

  if (userResult.error) {
    return { data: null, error: userResult.error };
  }

  if (!userResult.data) {
    return {
      data: null,
      error: { message: 'Profil bilgilerini kaydetmek icin aktif oturum bulunamadi.' },
    };
  }

  const normalizedGender = normalizeGender(input.gender);
  const baseProfile = await ensureProfileRecord(userResult.data);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        username: baseProfile.username || 'user',
        plan: baseProfile.plan,
        avatar_id: baseProfile.avatarId || null,
        gender: normalizedGender,
        status: baseProfile.isFrozen ? 'frozen' : 'active',
        is_frozen: Boolean(baseProfile.isFrozen),
      })
      .eq('user_id', userResult.data.id)
      .select('username, plan, avatar_id, gender, is_frozen')
      .single();

    if (error) {
      logSafeWarn('[auth] profile details update skipped', error, {
        functionName: 'updateCurrentUserProfileDetails',
        table: 'profiles',
      });

      return {
        data: {
          ...baseProfile,
          gender: normalizedGender,
          email: userResult.data.email ?? undefined,
        },
        error: null,
      };
    }

    return {
      data: {
        username: normalizeText(data?.username) || baseProfile.username || 'user',
        plan: normalizePlan(data?.plan),
        avatarId: normalizeOptionalAvatarId(data?.avatar_id) || baseProfile.avatarId,
        gender: normalizeGender(data?.gender),
        email: userResult.data.email ?? undefined,
        isFrozen: Boolean(data?.is_frozen),
      },
      error: null,
    };
  } catch (error) {
    logSafeWarn('[auth] profile details save skipped', error, {
      functionName: 'updateCurrentUserProfileDetails',
      table: 'profiles',
    });

    return {
      data: {
        ...baseProfile,
        gender: normalizedGender,
        email: userResult.data.email ?? undefined,
      },
      error: null,
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
      return { data: null, error: { message: getFriendlyErrorMessage(error, 'Apple ile giriş başarısız oldu.') } };
    }

    const profileResult = data.user ? await upsertProfileRecord(data.user, {
      username: buildUsername(data.user, fullName) || 'user',
      plan: 'free',
      avatarId: DEFAULT_PROFILE_AVATAR_ID,
      gender: defaultProfile.gender,
    }) : null;

    return {
      data: {
        user: data.user,
        session: data.session,
        profile: profileResult?.profile ?? null,
        isNewUser: profileResult?.isNewUser ?? false,
        requiresProfileCompletion: needsSocialProfileCompletion(data.user, profileResult?.profile ?? null, profileResult?.isNewUser ?? false),
      },
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
      return { data: null, error: { message: getFriendlyErrorMessage(error, 'Google ile giriş başarısız oldu.') } };
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

    const profileResult = await upsertProfileRecord(authResult.data.user, {
      username: buildUsername(authResult.data.user) || 'user',
      plan: 'free',
      avatarId: DEFAULT_PROFILE_AVATAR_ID,
      gender: defaultProfile.gender,
    });

    return {
      data: {
        user: authResult.data.user,
        session: authResult.data.session,
        profile: profileResult.profile,
        isNewUser: profileResult.isNewUser,
        requiresProfileCompletion: needsSocialProfileCompletion(authResult.data.user, profileResult.profile, profileResult.isNewUser),
      },
      error: null,
    };
  } catch (error) {
    logSafeError('[auth] Google sign-in failed', error);
    return { data: null, error: toAuthError(error, 'Google ile giris basarisiz oldu.') };
  }
}

export async function completeSocialProfileSetup(
  username: string,
  legalAccepted: boolean,
): Promise<AuthServiceResult<ProfileSeed>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getMissingEnvError() };
  }

  const userResult = await getCurrentUser();

  if (userResult.error) {
    return { data: null, error: userResult.error };
  }

  if (!userResult.data) {
    return {
      data: null,
      error: { message: 'Aktif oturum bulunamadı. Lütfen tekrar giriş yap.' },
    };
  }

  const normalizedUsername = normalizeText(username);

  if (!normalizedUsername) {
    return {
      data: null,
      error: { message: 'Rumuz zorunludur.' },
    };
  }

  const baseProfile = await ensureProfileRecord(userResult.data, normalizedUsername);
  const acceptedAt = legalAccepted ? new Date().toISOString() : undefined;

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      username: normalizedUsername,
      legalAcceptedAt: acceptedAt,
      legalAcceptedVersion: legalAccepted ? 'v1' : undefined,
    },
  });

  if (authError) {
    return {
      data: null,
      error: { message: getFriendlyErrorMessage(authError, 'Profil bilgileri kaydedilemedi.') },
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      username: normalizedUsername,
      plan: baseProfile.plan,
      avatar_id: baseProfile.avatarId || null,
      gender: baseProfile.gender,
      status: baseProfile.isFrozen ? 'frozen' : 'active',
      is_frozen: Boolean(baseProfile.isFrozen),
    })
    .eq('user_id', userResult.data.id)
    .select('username, plan, avatar_id, gender, is_frozen')
    .single();

  if (error) {
    return {
      data: null,
      error: { message: getFriendlyErrorMessage(error, 'Profil bilgileri kaydedilemedi.') },
    };
  }

  return {
    data: {
      username: normalizeText(data?.username) || normalizedUsername,
      plan: normalizePlan(data?.plan),
      avatarId: normalizeOptionalAvatarId(data?.avatar_id),
      gender: normalizeGender(data?.gender),
      email: userResult.data.email ?? undefined,
      isFrozen: Boolean(data?.is_frozen),
    },
    error: null,
  };
}
