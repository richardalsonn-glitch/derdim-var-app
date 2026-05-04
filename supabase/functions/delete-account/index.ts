// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
}

async function safeQuery(label: string, operation: PromiseLike<{ error?: { message?: string } | null }>) {
  const result = await operation;

  if (result.error) {
    console.warn(`[delete-account] ${label} skipped: ${result.error.message ?? 'unknown error'}`);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Server env ayarlari eksik.' });
  }

  const sessionToken = getBearerToken(request);

  if (!sessionToken) {
    return jsonResponse(401, { error: 'Oturum gerekli.' });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(sessionToken);

  if (authError || !user?.id) {
    return jsonResponse(401, { error: 'Oturum dogrulanamadi.' });
  }

  const userId = user.id;

  try {
    await safeQuery('matchmaking_queue cleanup', admin.from('matchmaking_queue').delete().eq('user_id', userId));
    await safeQuery('livekit_room_sessions cleanup', admin.from('livekit_room_sessions').delete().eq('user_id', userId));
    await safeQuery('livekit_request_logs anonymize', admin.from('livekit_request_logs').update({ user_id: null, peer_user_id: null }).or(`user_id.eq.${userId},peer_user_id.eq.${userId}`));
    await safeQuery('gift_transactions cleanup', admin.from('gift_transactions').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`));
    await safeQuery('chat_messages cleanup', admin.from('chat_messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`));
    await safeQuery('chat_threads cleanup', admin.from('chat_threads').delete().or(`user1_id.eq.${userId},user2_id.eq.${userId}`));
    await safeQuery('friendships cleanup', admin.from('friendships').delete().or(`requester_id.eq.${userId},receiver_id.eq.${userId}`));
    await safeQuery('profiles cleanup', admin.from('profiles').delete().eq('user_id', userId));

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false);

    if (deleteError) {
      return jsonResponse(500, { error: 'Auth kullanicisi silinemedi.' });
    }

    return jsonResponse(200, { deleted: true });
  } catch {
    return jsonResponse(500, { error: 'Hesap silme islemi tamamlanamadi.' });
  }
});
