// Cloud persistence adapters. Credentials are read only from the server process environment.
// Nothing in this module exposes credentials to browser code or repository files.

function required(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`Sichere Server-Konfiguration fehlt: ${name}`);
  return value;
}

function assertServerOnly(env) {
  // Deliberately require deployment-time server secrets. No browser/local-storage fallback.
  return {
    supabaseUrl: required(env, 'KZ_SUPABASE_URL').replace(/\/$/, ''),
    supabaseServiceKey: required(env, 'KZ_SUPABASE_SERVICE_ROLE_KEY'),
    r2Endpoint: required(env, 'KZ_R2_ENDPOINT').replace(/\/$/, ''),
    r2Bucket: required(env, 'KZ_R2_BUCKET'),
    r2AccessKeyId: required(env, 'KZ_R2_ACCESS_KEY_ID'),
    r2SecretAccessKey: required(env, 'KZ_R2_SECRET_ACCESS_KEY'),
  };
}

export function cloudStorageConfigured(env = process.env) {
  try { assertServerOnly(env); return true; } catch { return false; }
}

export function cloudStorageStatus(env = process.env) {
  return {
    configured: cloudStorageConfigured(env),
    metadata: 'supabase',
    objects: 'cloudflare-r2',
    failClosed: true,
    credentialsExposedToClient: false,
  };
}

export class SupabaseTaskMetadataStore {
  constructor({ env = process.env, fetchImpl = fetch } = {}) {
    const config = assertServerOnly(env);
    this.base = `${config.supabaseUrl}/rest/v1/kz_tasks`;
    this.key = config.supabaseServiceKey;
    this.fetch = fetchImpl;
  }

  headers(extra = {}) {
    return {
      apikey: this.key,
      authorization: `Bearer ${this.key}`,
      'content-type': 'application/json',
      ...extra,
    };
  }

  async upsert(task) {
    const response = await this.fetch(this.base, {
      method: 'POST',
      headers: this.headers({ prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(task),
    });
    if (!response.ok) throw new Error(`Cloud-Metadatenspeicher fehlgeschlagen (${response.status}).`);
  }

  async get(id) {
    const url = `${this.base}?id=eq.${encodeURIComponent(id)}&select=*`;
    const response = await this.fetch(url, { headers: this.headers() });
    if (!response.ok) throw new Error(`Cloud-Metadatenabruf fehlgeschlagen (${response.status}).`);
    const rows = await response.json();
    return rows[0] || null;
  }
}

// R2 signing/upload is intentionally not implemented with hand-written crypto here.
// The production adapter must use an audited S3-compatible signer/SDK server-side.
// Until that dependency is installed and configured, object writes fail closed.
export class R2ObjectStore {
  constructor({ env = process.env } = {}) {
    const config = assertServerOnly(env);
    this.endpoint = config.r2Endpoint;
    this.bucket = config.r2Bucket;
  }

  async put() {
    throw new Error('R2-Objektspeicher ist noch nicht sicher aktiviert; Upload wurde blockiert.');
  }
}
