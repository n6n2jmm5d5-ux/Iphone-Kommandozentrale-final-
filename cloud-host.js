import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const HOST_ID_PATTERN = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function atomicWrite(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${value}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  try { fs.chmodSync(filePath, 0o600); } catch {}
}

export function loadOrCreateCloudHostId({
  env = process.env,
  filePath = env.KZ_HOST_ID_FILE || path.join(process.cwd(), '.runtime', 'cloud-host-id'),
} = {}) {
  const configured = String(env.KZ_EXT_AGENT_HOST_ID || '').trim();
  if (configured) {
    if (!HOST_ID_PATTERN.test(configured)) throw new Error('KZ_EXT_AGENT_HOST_ID must be a stable urn:uuid: UUIDv4 value.');
    return configured;
  }

  if (fs.existsSync(filePath)) {
    const stored = fs.readFileSync(filePath, 'utf8').trim();
    if (!HOST_ID_PATTERN.test(stored)) throw new Error(`Invalid persisted cloud host ID at ${filePath}.`);
    return stored;
  }

  const created = `urn:uuid:${crypto.randomUUID()}`;
  atomicWrite(filePath, created);
  return created;
}

export function isValidCloudHostId(value) {
  return HOST_ID_PATTERN.test(String(value || '').trim());
}
