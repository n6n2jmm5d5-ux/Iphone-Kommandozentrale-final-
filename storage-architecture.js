export const CLOUD_STORAGE = Object.freeze({
  metadata: Object.freeze({
    provider: 'supabase',
    purpose: Object.freeze(['tasks', 'status', 'result-metadata', 'artifact-references']),
    browserSecretsAllowed: false,
  }),
  artifacts: Object.freeze({
    provider: 'cloudflare-r2',
    purpose: Object.freeze(['images', 'videos', 'documents', 'generated-files']),
    browserSecretsAllowed: false,
  }),
});

export function cloudStorageRequirements() {
  return {
    metadata: ['SUPABASE_URL', 'SUPABASE_SERVER_CREDENTIAL'],
    artifacts: ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_SERVER_CREDENTIAL'],
  };
}
