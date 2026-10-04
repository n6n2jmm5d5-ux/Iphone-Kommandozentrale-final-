import { SupabaseTaskMetadataStore } from './cloud-storage.js';
import { R2Store } from './r2-store.js';
import { redactSecrets, validId } from './task-store.js';

const INLINE_LIMIT = 32 * 1024;

function safeTask(task) {
  if (!task || !validId(task.id)) throw new Error('Ungültige Auftrags-ID für Cloud-Speicherung.');
  const clean = {
    id: task.id,
    state: task.state,
    worker: task.worker || null,
    mode: task.mode || null,
    created_at: task.createdAt || null,
    started_at: task.startedAt || null,
    finished_at: task.finishedAt || null,
    approved_at: task.approvedAt || null,
    requires_approval: !!task.requiresApproval,
    error: redactSecrets(task.error || ''),
    result_text: '',
    result_object_key: null,
    result_content_type: null,
    result_bytes: 0,
    execution: task.execution || null,
  };
  return clean;
}

export class CloudTaskPersistence {
  constructor({ metadata, objects } = {}) {
    this.metadata = metadata || new SupabaseTaskMetadataStore();
    this.objects = objects || new R2Store();
  }

  async persist(task) {
    const row = safeTask(task);
    const result = redactSecrets(task.result || '');
    const body = Buffer.from(result, 'utf8');

    if (task.state === 'done' && body.length > INLINE_LIMIT) {
      const key = `tasks/${task.id}/result.txt`;
      const object = await this.objects.put(key, body, 'text/plain; charset=utf-8');
      row.result_object_key = object.key;
      row.result_content_type = object.contentType;
      row.result_bytes = object.bytes;
    } else {
      row.result_text = result;
      row.result_bytes = body.length;
    }

    await this.metadata.upsert(row);
    return row;
  }

  async get(id) {
    if (!validId(id)) throw new Error('Ungültige Auftrags-ID.');
    const row = await this.metadata.get(id);
    if (!row) return null;
    if (row.result_object_key) {
      const object = await this.objects.get(row.result_object_key);
      return { ...row, result_text: object.body.toString('utf8') };
    }
    return row;
  }
}

export function attachCloudPersistence(service, persistence) {
  if (!service || !persistence) throw new Error('Cloud-Persistenz kann nicht aktiviert werden.');
  const originalTransition = service.transition.bind(service);
  service.transition = function transitionWithCloud(job, state) {
    originalTransition(job, state);
    // Do not claim cloud durability before the remote write succeeds.
    job.cloudPersisted = false;
    Promise.resolve(persistence.persist(job)).then(() => {
      job.cloudPersisted = true;
    }).catch(error => {
      job.cloudPersisted = false;
      job.cloudPersistenceError = redactSecrets(error.message || 'Cloud-Speicherung fehlgeschlagen');
    });
  };
  return service;
}
