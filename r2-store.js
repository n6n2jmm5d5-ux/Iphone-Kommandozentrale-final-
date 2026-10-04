import crypto from 'node:crypto';

const enc = encodeURIComponent;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (key, value, encoding) => crypto.createHmac('sha256', key).update(value).digest(encoding);
const safeKey = key => String(key || '').split('/').filter(Boolean).map(enc).join('/');

function required(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`Missing server-side secret/config: ${name}`);
  return value;
}

export class R2Store {
  constructor({ env = process.env, fetchImpl = fetch } = {}) {
    this.accountId = required(env, 'R2_ACCOUNT_ID');
    this.bucket = required(env, 'R2_BUCKET');
    this.accessKeyId = required(env, 'R2_ACCESS_KEY_ID');
    this.secretAccessKey = required(env, 'R2_SECRET_ACCESS_KEY');
    this.fetch = fetchImpl;
    this.endpoint = `https://${this.accountId}.r2.cloudflarestorage.com`;
  }

  sign(method, objectKey, body = Buffer.alloc(0), extraHeaders = {}) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const host = `${this.accountId}.r2.cloudflarestorage.com`;
    const payloadHash = sha256(body);
    const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...extraHeaders };
    const names = Object.keys(headers).map(k => k.toLowerCase()).sort();
    const canonicalHeaders = names.map(name => `${name}:${String(headers[name]).trim()}\n`).join('');
    const signedHeaders = names.join(';');
    const canonicalUri = `/${enc(this.bucket)}/${safeKey(objectKey)}`;
    const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${date}/auto/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
    const kDate = hmac(`AWS4${this.secretAccessKey}`, date);
    const kRegion = hmac(kDate, 'auto');
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');
    const signature = hmac(kSigning, stringToSign, 'hex');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return { url: `${this.endpoint}${canonicalUri}`, headers };
  }

  async request(method, objectKey, body = Buffer.alloc(0), contentType) {
    if (!objectKey || objectKey.includes('..')) throw new Error('Invalid R2 object key.');
    const extra = contentType ? { 'content-type': contentType } : {};
    const signed = this.sign(method, objectKey, body, extra);
    const response = await this.fetch(signed.url, { method, headers: signed.headers, body: method === 'GET' || method === 'HEAD' ? undefined : body });
    if (!response.ok) throw new Error(`R2 ${method} failed (${response.status}).`);
    return response;
  }

  async put(objectKey, data, contentType = 'application/octet-stream') {
    const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const response = await this.request('PUT', objectKey, body, contentType);
    return { key: objectKey, etag: response.headers.get('etag') || null, bytes: body.length, contentType };
  }

  async get(objectKey) {
    const response = await this.request('GET', objectKey);
    return { key: objectKey, contentType: response.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await response.arrayBuffer()) };
  }

  async head(objectKey) {
    const response = await this.request('HEAD', objectKey);
    return { key: objectKey, etag: response.headers.get('etag') || null, bytes: Number(response.headers.get('content-length') || 0), contentType: response.headers.get('content-type') || null };
  }

  async delete(objectKey) {
    await this.request('DELETE', objectKey);
    return { key: objectKey, deleted: true };
  }
}

export function r2Configured(env = process.env) {
  return ['R2_ACCOUNT_ID','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'].every(name => String(env[name] || '').trim());
}
