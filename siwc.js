import crypto from 'node:crypto';

const AUTHORIZE_ENDPOINT = 'https://auth.openai.com/api/accounts/authorize';
const TOKEN_ENDPOINT = 'https://auth.openai.com/api/accounts/oauth/token';
const RESOURCE = 'https://api.openai.com/v1';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const FIRST_CLIENT_ID = 'dynamic_agent_client';

const base64url = (buffer) => Buffer.from(buffer).toString('base64url');
const randomValue = (bytes = 32) => base64url(crypto.randomBytes(bytes));

export function createSiwcTransaction({
  extAgentHostId,
  redirectUri,
  agentName = 'Kommandozentrale',
  clientId = FIRST_CLIENT_ID,
  idTokenHint,
  loginHint,
} = {}) {
  if (!extAgentHostId) throw new Error('extAgentHostId is required.');
  if (!redirectUri) throw new Error('redirectUri is required.');

  const state = randomValue();
  const nonce = randomValue();
  const codeVerifier = randomValue(64);
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  if (clientId === FIRST_CLIENT_ID) url.searchParams.set('agent_name_hint', agentName);
  url.searchParams.set('ext_agent_host_id', extAgentHostId);
  if (clientId !== FIRST_CLIENT_ID && idTokenHint) url.searchParams.set('id_token_hint', idTokenHint);
  if (clientId !== FIRST_CLIENT_ID && loginHint) url.searchParams.set('login_hint', loginHint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('resource', RESOURCE);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', codeChallenge);

  return {
    authorizeUrl: url.toString(),
    transaction: { state, nonce, codeVerifier, redirectUri, requestedClientId: clientId, createdAt: Date.now() },
  };
}

export function validateSiwcCallback(params, transaction) {
  if (!transaction || !transaction.state) throw new Error('No pending SIWC transaction.');
  const state = String(params.get('state') || '');
  if (!state || state !== transaction.state) throw new Error('SIWC state mismatch.');
  const error = params.get('error');
  if (error) return { ok: false, error, description: params.get('error_description') || '' };
  const code = String(params.get('code') || '');
  if (!code) throw new Error('SIWC callback did not contain a code.');
  const returnedClientId = params.get('client_id');
  let clientId = transaction.requestedClientId;
  if (clientId === FIRST_CLIENT_ID) {
    if (!returnedClientId || returnedClientId === FIRST_CLIENT_ID) throw new Error('Dynamic registration did not return an issued client_id.');
    clientId = returnedClientId;
  } else if (returnedClientId && returnedClientId !== clientId) {
    throw new Error('SIWC callback returned a different client_id.');
  }
  return { ok: true, code, clientId };
}

export async function exchangeSiwcCode({ code, clientId, transaction, fetchImpl = fetch }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    code_verifier: transaction.codeVerifier,
    redirect_uri: transaction.redirectUri,
    resource: RESOURCE,
  });
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { detail: text }; }
  if (!response.ok) {
    const error = new Error(`SIWC token exchange failed (${response.status}).`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const SIWC = Object.freeze({ AUTHORIZE_ENDPOINT, TOKEN_ENDPOINT, RESOURCE, SCOPES, FIRST_CLIENT_ID });
