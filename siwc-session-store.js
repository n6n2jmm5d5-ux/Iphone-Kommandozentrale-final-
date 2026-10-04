import fs from 'node:fs';
import path from 'node:path';

export class SiwcSessionStore {
  constructor({ filePath = path.join(process.cwd(), '.runtime', 'siwc-session.json') } = {}) {
    this.filePath = filePath;
  }

  exists() {
    return fs.existsSync(this.filePath);
  }

  clear() {
    try { fs.unlinkSync(this.filePath); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
}
