// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { AccessToken } from 'npm:livekit-server-sdk@2.15.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for',
};

const LIVEKIT_TOKEN_TTL_MINUTES = 8;

type SupabaseErrorShape = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  name?: string;
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function writeRequestLog(
  adminSupabase: ReturnType<typeof createClient>,
  payload: {
    userId?: string | null;
    peerUserId?: string | null;
    roomId?: string | null;
    requesterIp?: string | null;
    status: 'success' | 'error';
    statusCode: number;
    rejectionReason?: string | null;
    requestPath: string;
    requestMethod: string;
  },
) {
  const { error } = await adminSupabase.from('livekit_request_logs').insert({
    user_id: payload.userId ?? null,
    peer_user_id: payload.peerUserId ?? null,
    room_id: payload.roomId ?? null,
    requester_ip: payload.requesterIp ?? null,
    status: payload.status,
    status_code: payload.statusCode,
    rejection_reason: payload.rejectionReason ?? null,
    request_path: payload.requestPath,
    request_method: payload.requestMethod,
  });

  if (error) {
    console.error(`[livekit-token] request log write failed: ${error.message}`);
  }
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

function normalizeRoomId(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();

  if (!normalized || normalized.length > 160) {
    return '';
  }

  const safeRoomId = normalized.replace(/[^a-zA-Z0-9:_-]/g, '-').replace(/-+/g, '-');
  return safeRoomId ? `voice-${safeRoomId}` : '';
}

function formatLiveKitValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim() || 'empty';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return 'null';
  }

  return String(value);
}

function getErrorShape(error: unknown): SupabaseErrorShape {
  if (!error) {
    return {};
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (typeof error === 'object') {
    const maybeError = error as Record<string, unknown>;

    return {
      code: typeof maybeError.code === 'string' ? maybeError.code : undefined,
      message: typeof maybeError.message === 'string' ? maybeError.message : undefined,
      details: typeof maybeError.details === 'string' ? maybeError.details : undefined,
      hint: typeof maybeError.hint === 'string' ? maybeError.hint : undefined,
      name: typeof maybeError.name === 'string' ? maybeError.name : undefined,
    };
  }

  return { message: String(error) };
}

function logLiveKit(event: Record<string, unknown>) {
  const message = Object.entries(event)
    .map(([key, value]) => `${key}:${formatLiveKitValue(value)}`)
    .join(' ');

  console.log(`scope=[livekit-token] fn=livekit-token message=${message}`);
}

function logLiveKitError(
  step: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const safeError = getErrorShape(error);

  logLiveKit({
    step,
    errorName: safeError.name ?? 'unknown',
    errorMessage: safeError.message ?? 'unknown',
    dbErrorCode: safeError.code ?? 'none',
    dbErrorMessage: safeError.message ?? 'none',
    dbErrorDetails: safeError.details ?? 'none',
    dbErrorHint: safeError.hint ?? 'none',
    ...context,
  });
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
  const requesterIp = getClientIp(request);
  const requestPath = new URL(request.url).pathname;

  logLiveKit({
    edgeRequestStart: true,
    method: request.method,
    livekitEnvExists: Boolean(apiKey && apiSecret && wsUrl),
    livekitUrlExists: Boolean(wsUrl),
    livekitApiKeyExists: Boolean(apiKey),
    livekitApiSecretExists: Boolean(apiSecret),
    supabaseUrlExists: Boolean(supabaseUrl),
    supabaseAnonKeyExists: Boolean(supabaseAnonKey),
    supabaseServiceRoleKeyExists: Boolean(supabaseServiceRoleKey),
    authHeaderExists: Boolean(request.headers.get('Authorization')),
  });

  if (!apiKey || !apiSecret || !wsUrl || !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    logLiveKit({ step: 'env-check', errorCode: 'missing_env', statusCode: 500, tokenIssued: false, livekitEnvExists: Boolean(apiKey && apiSecret && wsUrl), authHeaderExists: Boolean(request.headers.get('Authorization')) });
    return jsonResponse(500, { error: 'Server env ayarlari eksik.' });
  }

  const accessToken = getBearerToken(request);

  if (!accessToken) {
    logLiveKit({ step: 'auth-check', errorCode: 'missing_auth', statusCode: 401, tokenIssued: false, authHeaderExists: Boolean(request.headers.get('Authorization')), livekitEnvExists: true });
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
    if (request.method === 'POST') {
      await writeRequestLog(adminSupabase, {
        userId: null,
        peerUserId: null,
        roomId: null,
        requesterIp,
        status: 'error',
        statusCode: 401,
        rejectionReason: accessToken ? 'invalid_auth' : 'missing_auth',
        requestPath,
        requestMethod: request.method,
      });
    }

    logLiveKitError('auth-check', authError, {
      errorCode: 'invalid_auth',
      statusCode: 401,
      tokenIssued: false,
      authHeaderExists: true,
      userId: null,
      livekitEnvExists: true,
    });
    return jsonResponse(401, { error: 'Session dogrulanamadi.' });
  }

  if (request.method === 'DELETE') {
    const { error: releaseError } = await adminSupabase.rpc('release_livekit_room_sessions', {
      p_user_id: user.id,
    });

    if (releaseError) {
      logLiveKitError('room-session-release', releaseError, {
        errorCode: 'release_failed',
        statusCode: 500,
        userId: user.id,
        tokenIssued: false,
        livekitEnvExists: true,
      });
      return jsonResponse(500, { error: 'Aktif oda oturumu kapatilamadi.' });
    }

    logLiveKit({ disconnect: true, released: true, statusCode: 200, userId: user.id, livekitEnvExists: true });
    return jsonResponse(200, { released: true });
  }

  try {
    const { peerUserId, roomId } = await request.json();
    const normalizedPeerUserId = normalizePeerUserId(peerUserId);
    const normalizedRoomId = normalizeRoomId(roomId);

    logLiveKit({
      tokenRequestValidated: true,
      userId: user.id,
      peerUserId: normalizedPeerUserId || 'invalid',
      roomId: typeof roomId === 'string' ? roomId : null,
      normalizedRoomName: normalizedRoomId || 'server-private-room',
      livekitEnvExists: true,
      authHeaderExists: true,
    });

    if (!normalizedPeerUserId) {
      await writeRequestLog(adminSupabase, {
        userId: user.id,
        peerUserId: null,
        roomId: null,
        requesterIp,
        status: 'error',
        statusCode: 400,
        rejectionReason: 'invalid_peer_user_id',
        requestPath,
        requestMethod: request.method,
      });

      logLiveKit({
        step: 'request-validate',
        errorCode: 'invalid_peer_user_id',
        statusCode: 400,
        tokenIssued: false,
        userId: user.id,
        roomId: typeof roomId === 'string' ? roomId : null,
        normalizedRoomName: normalizedRoomId || 'server-private-room',
        livekitEnvExists: true,
      });
      return jsonResponse(400, { error: 'peerUserId gerekli.' });
    }

    if (normalizedPeerUserId === user.id) {
      await writeRequestLog(adminSupabase, {
        userId: user.id,
        peerUserId: normalizedPeerUserId,
        roomId: null,
        requesterIp,
        status: 'error',
        statusCode: 400,
        rejectionReason: 'self_room_request',
        requestPath,
        requestMethod: request.method,
      });

      logLiveKit({
        step: 'request-validate',
        errorCode: 'self_room_request',
        statusCode: 400,
        tokenIssued: false,
        userId: user.id,
        roomId: null,
        normalizedRoomName: normalizedRoomId || 'server-private-room',
        livekitEnvExists: true,
      });
      return jsonResponse(400, { error: 'Kullanici kendi odasi icin token isteyemez.' });
    }

    const roomName = normalizedRoomId || await buildPrivateRoomName(user.id, normalizedPeerUserId, apiSecret);
    logLiveKit({
      roomName,
      roomId: typeof roomId === 'string' ? roomId : null,
      normalizedRoomName: roomName,
      userId: user.id,
      tokenGrantRoomJoin: true,
      tokenGrantCanPublish: true,
      tokenGrantCanSubscribe: true,
      tokenGrantCanPublishData: true,
      livekitEnvExists: true,
    });
    const expiresAt = new Date(Date.now() + LIVEKIT_TOKEN_TTL_MINUTES * 60_000).toISOString();
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
      await writeRequestLog(adminSupabase, {
        userId: user.id,
        peerUserId: normalizedPeerUserId,
        roomId: roomName,
        requesterIp,
        status: 'error',
        statusCode: 500,
        rejectionReason: 'session_persistence_error',
        requestPath,
        requestMethod: request.method,
      });

      logLiveKitError('room-session-upsert', issueError, {
        errorCode: 'session_persistence_error',
        statusCode: 500,
        tokenIssued: false,
        userId: user.id,
        roomId: roomName,
        normalizedRoomName: roomName,
        livekitEnvExists: true,
      });
      logLiveKit({
        step: 'room-session-upsert',
        dbSessionPersisted: false,
        dbSessionFallback: true,
        tokenIssued: 'pending',
        userId: user.id,
        peerUserId: normalizedPeerUserId,
        roomId: roomName,
        normalizedRoomName: roomName,
      });
    }

    const decision = Array.isArray(issueResult) ? issueResult[0] : issueResult;

    if (!issueError && !decision?.allowed) {
      const statusCode =
        typeof decision?.status_code === 'number' && decision.status_code >= 400
          ? decision.status_code
          : 429;

      if (decision?.reason === 'active_room_exists') {
        await writeRequestLog(adminSupabase, {
          userId: user.id,
          peerUserId: normalizedPeerUserId,
          roomId: roomName,
          requesterIp,
          status: 'error',
          statusCode,
          rejectionReason: 'duplicate_session',
          requestPath,
          requestMethod: request.method,
        });

        logLiveKit({
          step: 'room-session-upsert',
          errorCode: 'duplicate_session',
          statusCode,
          tokenIssued: false,
          userId: user.id,
          roomId: roomName,
          normalizedRoomName: roomName,
          livekitEnvExists: true,
        });
        return jsonResponse(statusCode, { error: 'Ayni anda yalnizca tek aktif sesli oda kullanilabilir.' });
      }

      if (decision?.reason === 'abuse_window_exceeded' || decision?.reason === 'rate_limit_exceeded') {
        await writeRequestLog(adminSupabase, {
          userId: user.id,
          peerUserId: normalizedPeerUserId,
          roomId: roomName,
          requesterIp,
          status: 'error',
          statusCode,
          rejectionReason: 'rate_limit',
          requestPath,
          requestMethod: request.method,
        });

        logLiveKit({
          step: 'room-session-upsert',
          errorCode: 'rate_limit',
          statusCode,
          tokenIssued: false,
          userId: user.id,
          roomId: roomName,
          normalizedRoomName: roomName,
          livekitEnvExists: true,
        });
        return jsonResponse(statusCode, { error: 'Cok fazla token istegi gonderildi. Lutfen daha sonra tekrar deneyin.' });
      }

      await writeRequestLog(adminSupabase, {
        userId: user.id,
        peerUserId: normalizedPeerUserId,
        roomId: roomName,
        requesterIp,
        status: 'error',
        statusCode,
        rejectionReason: typeof decision?.reason === 'string' ? decision.reason : 'request_rejected',
        requestPath,
        requestMethod: request.method,
      });

      logLiveKit({
        step: 'room-session-upsert',
        errorCode: typeof decision?.reason === 'string' ? decision.reason : 'request_rejected',
        statusCode,
        tokenIssued: false,
        userId: user.id,
        roomId: roomName,
        normalizedRoomName: roomName,
        livekitEnvExists: true,
      });
      return jsonResponse(statusCode, { error: 'LiveKit token istegi reddedildi.' });
    }

    let token = '';

    try {
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

      token = await livekitToken.toJwt();
    } catch (tokenError) {
      await writeRequestLog(adminSupabase, {
        userId: user.id,
        peerUserId: normalizedPeerUserId,
        roomId: roomName,
        requesterIp,
        status: 'error',
        statusCode: 500,
        rejectionReason: 'token_create_error',
        requestPath,
        requestMethod: request.method,
      });

      logLiveKitError('token-create', tokenError, {
        errorCode: 'token_create_error',
        statusCode: 500,
        tokenIssued: false,
        userId: user.id,
        peerUserId: normalizedPeerUserId,
        roomId: roomName,
        normalizedRoomName: roomName,
        livekitEnvExists: true,
      });
      return jsonResponse(500, { error: 'LiveKit token olusturulamadi.' });
    }

    await writeRequestLog(adminSupabase, {
      userId: user.id,
      peerUserId: normalizedPeerUserId,
      roomId: roomName,
      requesterIp,
      status: 'success',
      statusCode: 200,
      rejectionReason: null,
      requestPath,
      requestMethod: request.method,
    });

    logLiveKit({
      step: 'response',
      tokenIssued: true,
      dbSessionPersisted: !issueError,
      userId: user.id,
      peerUserId: normalizedPeerUserId,
      roomId: roomName,
      normalizedRoomName: roomName,
      roomName,
      statusCode: 200,
      livekitEnvExists: true,
    });

    return jsonResponse(200, { token, wsUrl, livekitUrl: wsUrl, roomName });
  } catch (error) {
    await writeRequestLog(adminSupabase, {
      userId: user.id,
      peerUserId: null,
      roomId: null,
      requesterIp,
      status: 'error',
      statusCode: 500,
      rejectionReason: 'unexpected_error',
      requestPath,
      requestMethod: request.method,
    });

    logLiveKitError('response', error, {
      errorCode: 'unexpected_error',
      statusCode: 500,
      tokenIssued: false,
      userId: user.id,
      roomId: null,
      normalizedRoomName: null,
      livekitEnvExists: true,
    });
    return jsonResponse(500, { error: 'LiveKit token olusturulamadi.' });
  }
});
