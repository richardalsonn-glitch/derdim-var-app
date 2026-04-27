// TODO: Supabase Auth baglanacak

type MockAuthResult = {
  success: boolean;
  mode: 'demo';
};

export async function signInWithApple(): Promise<MockAuthResult> {
  return { success: true, mode: 'demo' };
}

export async function signInWithGoogle(): Promise<MockAuthResult> {
  return { success: true, mode: 'demo' };
}

export async function signInWithEmail(): Promise<MockAuthResult> {
  return { success: true, mode: 'demo' };
}

export async function signOut(): Promise<MockAuthResult> {
  return { success: true, mode: 'demo' };
}
