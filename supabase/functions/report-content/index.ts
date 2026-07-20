import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SecurityEvent = {
  event: string;
  request_id: string;
  status: number;
  outcome: string;
  user_hash?: string;
  target_type?: string;
};

const securityLog = (event: SecurityEvent, level: 'info' | 'warn' | 'error' = 'info') => {
  const entry = JSON.stringify({ ...event, timestamp: new Date().toISOString() });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.info(entry);
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const hashIp = async (ip: string, secret: string) => {
  const bytes = new TextEncoder().encode(`${secret}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const MAX_BODY_BYTES = 2048;

const readJsonBody = async (request: Request): Promise<unknown> => {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new Error('BODY_TOO_LARGE');
  }
  if (!request.body) throw new Error('INVALID_BODY');

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('BODY_TOO_LARGE');
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return JSON.parse(body);
};

Deno.serve(async (request) => {
  const requestId = request.headers.get('x-request-id')?.slice(0, 128) ?? crypto.randomUUID();
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    securityLog({ event: 'content_report_rejected', request_id: requestId, status: 405, outcome: 'method_not_allowed' }, 'warn');
    return json({ error: 'Method not allowed', requestId }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ipSalt = Deno.env.get('IP_HASH_SALT');
  const trustedIpHeader = Deno.env.get('TRUSTED_CLIENT_IP_HEADER');
  if (!url || !anonKey || !serviceKey || !ipSalt || !trustedIpHeader) {
    securityLog({ event: 'content_report_configuration_error', request_id: requestId, status: 500, outcome: 'missing_secret_or_header_config' }, 'error');
    return json({ error: 'Server configuration is incomplete', requestId }, 500);
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    securityLog({ event: 'content_report_auth_failure', request_id: requestId, status: 401, outcome: authError?.code ?? 'missing_user' }, 'warn');
    return json({ error: 'Authentication required', requestId }, 401);
  }

  const userHash = (await hashIp(`user:${user.id}`, ipSalt)).slice(0, 24);

  // This header must be stripped and overwritten by the deployment gateway.
  // Do not fall back to client-controlled forwarding headers.
  const trustedIp = request.headers.get(trustedIpHeader)?.trim().slice(0, 128);
  if (!trustedIp) {
    securityLog({ event: 'content_report_proxy_header_missing', request_id: requestId, status: 400, outcome: 'trusted_ip_missing', user_hash: userHash }, 'warn');
    return json({ error: 'Client network information is unavailable', requestId }, 400);
  }
  const ip = trustedIp;
  const ipHash = await hashIp(ip, ipSalt);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let payload: { targetType?: string; targetId?: string; reason?: string };
  try {
    payload = await readJsonBody(request) as typeof payload;
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === 'BODY_TOO_LARGE';
    securityLog({ event: 'content_report_rejected', request_id: requestId, status: tooLarge ? 413 : 400, outcome: tooLarge ? 'body_too_large' : 'invalid_body', user_hash: userHash }, 'warn');
    return json({ error: tooLarge ? 'Request body too large' : 'Invalid request body', requestId }, tooLarge ? 413 : 400);
  }
  if (!payload || typeof payload !== 'object') return json({ error: 'Invalid request body' }, 400);
  const { targetType, targetId } = payload;
  const reason = payload.reason?.trim() ?? '';
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!['review', 'photo'].includes(targetType ?? '') || !targetId || !uuidPattern.test(targetId) || reason.length < 3 || reason.length > 500) {
    securityLog({ event: 'content_report_rejected', request_id: requestId, status: 400, outcome: 'invalid_report', user_hash: userHash, target_type: targetType }, 'warn');
    return json({ error: 'Invalid report', requestId }, 400);
  }

  const { data: result, error } = await admin.rpc('submit_content_report', {
    p_reporter_id: user.id,
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_ip_hash: ipHash,
  });
  if (error) {
    securityLog({ event: 'content_report_error', request_id: requestId, status: 500, outcome: error.code ?? 'rpc_error', user_hash: userHash, target_type: targetType }, 'error');
    return json({ error: 'Could not submit report', requestId }, 500);
  }
  const statuses: Record<string, number> = { rate_limited: 429, not_found: 404, self_report: 403, duplicate: 409, created: 200 };
  const status = statuses[String(result)] ?? 400;
  securityLog({ event: result === 'created' ? 'content_report_created' : 'content_report_rejected', request_id: requestId, status, outcome: String(result), user_hash: userHash, target_type: targetType }, result === 'created' ? 'info' : 'warn');
  if (result === 'rate_limited') return json({ error: 'Too many reports. Please try again later.', requestId }, 429);
  if (result === 'not_found') return json({ error: 'Content not found', requestId }, 404);
  if (result === 'self_report') return json({ error: 'You cannot report your own content.', requestId }, 403);
  if (result === 'duplicate') return json({ error: 'You already reported this content.', requestId }, 409);
  if (result !== 'created') return json({ error: 'Invalid report', requestId }, 400);
  return json({ ok: true, requestId });
});
