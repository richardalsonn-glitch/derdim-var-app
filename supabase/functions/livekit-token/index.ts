// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { AccessToken } from 'npm:livekit-server-sdk@2.15.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for',
};

const LIVEKIT_TOKEN_TTL_MINUTES = 8;

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') ?? '';

  if (!authorization.startsWith('Bearer ')) {
    return '';
  }

  return authorization.slice('Bearer '.length).trim();
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  return forwardedFor.split(',')[0]?.trim() || 'unknown';
}

function normalizePeerUserId(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();

  if (!normalized || normalized.length > 128) {
    return '';
  }

  return normalized.replace(/[^a-zA-Z0-9:_-]/g, '');
}

async function buildPrivateRoomName(currentUserId: string, peerUserId: string, salt: string) {
  const pairSeed = [currentUserId.trim(), peerUserId.trim()].sort().join(':');
  const encoded = new TextEncoder().encode(`${pairSeed}:${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const hash = Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');

  return `voice-${hash.slice(0, 32)}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!['POST', 'DELETE'].includes(request.method)) {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const apiKey = Deno.env.get('LIVEKIT_API_KEY') ?? '';
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET') ?? '';
  const wsUrl = Deno.env.get('LIVEKIT_URL') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!apiKey || !apiSecret || !wsUrl || !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Server env ayarlari eksik.' });
  }

  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return jsonResponse(401, { error: 'Authenticated session gerekli.' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user?.id) {
    return jsonResponse(401, { error: 'Session dogrulanamadi.' });
  }

  if (request.method === 'DELETE') {
    const { error: releaseError } = await adminSupabase.rpc('release_livekit_room_sessions', {
      p_user_id: user.id,
    });

    if (releaseError) {
      return jsonResponse(500, { error: 'Aktif oda oturumu kapatilamadi.' });
    }

    return jsonResponse(200, { released: true });
  }

  try {
    const { peerUserId } = await request.json();
    const normalizedPeerUserId = normalizePeerUserId(peerUserId);

    if (!normalizedPeerUserId) {
      return jsonResponse(400, { error: 'peerUserId gerekli.' });
    }

    if (normalizedPeerUserId === user.id) {
      return jsonResponse(400, { error: 'Kullanici kendi odasi icin token isteyemez.' });
    }

    const roomName = await buildPrivateRoomName(user.id, normalizedPeerUserId, apiSecret);
    const expiresAt = new Date(Date.now() + LIVEKIT_TOKEN_TTL_MINUTES * 60_000).toISOString();
    const requesterIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent') ?? '';
    const { data: issueResult, error: issueError } = await adminSupabase.rpc('issue_livekit_room_session', {
      p_user_id: user.id,
      p_peer_user_id: normalizedPeerUserId,
      p_room_name: roomName,
      p_requester_ip: requesterIp,
      p_user_agent: userAgent,
      p_expires_at: expiresAt,
    });

    if (issueError) {
      return jsonResponse(500, { error: 'LiveKit oda oturumu kaydedilemedi.' });
    }

    const decision = Array.isArray(issueResult) ? issueResult[0] : issueResult;

    if (!decision?.allowed) {
      const statusCode =
        typeof decision?.status_code === 'number' && decision.status_code >= 400
          ? decision.status_code
          : 429;

      if (decision?.reason === 'active_room_exists') {
        return jsonResponse(statusCode, { error: 'Ayni anda yalnizca tek aktif sesli oda kullanilabilir.' });
      }

      if (decision?.reason === 'abuse_window_exceeded' || decision?.reason === 'rate_limit_exceeded') {
        return jsonResponse(statusCode, { error: 'Cok fazla token istegi gonderildi. Lutfen daha sonra tekrar deneyin.' });
      }

      return jsonResponse(statusCode, { error: 'LiveKit token istegi reddedildi.' });
    }

    const livekitToken = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      ttl: `${LIVEKIT_TOKEN_TTL_MINUTES}m`,
      name: user.email?.trim() || user.id,
    });

    livekitToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await livekitToken.toJwt();

    return jsonResponse(200, { token, wsUrl });
  } catch {
    return jsonResponse(500, { error: 'LiveKit token olusturulamadi.' });
  }
});
