import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '../lib/supabase';

// TODO: Supabase Auth baglanacak

type AuthServiceError = {
  message: string;
};

type AuthServiceResult<T> = {
  data: T | null;
  error: AuthServiceError | null;
};

type MockAuthResult = {
  success: boolean;
  mode: 'demo';
};

function getMissingEnvError(): AuthServiceError {
  return {
    message:
      'Supabase env bilgileri eksik. EXPO_PUBLIC_SUPABASE_ANON_KEY değerini gerçek public anon key ile doldurmalısın.',
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
    return { data: null, error: getMissingEnvError() };
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

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function signInWithApple(): Promise<MockAuthResult> {
  return { success: true, mode: 'demo' };
}

export async function signInWithGoogle(): Promise<MockAuthResult> {
  return { success: true, mode: 'demo' };
}
