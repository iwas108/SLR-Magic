import Dexie, { type Table } from 'dexie';
import { validateViewerSnapshot, validateViewerSnapshotSafe } from './utils/schemaValidator';

export interface SessionRecord {
  id?: number;
  projectName: string;
  filename: string;
  exportDate: string;
  importedAt: string;
  lastViewed: string;
  paperCount: number;
  totalCorpusCount?: number;
  schemaVersion: string;
  rawData?: any;
  isSchemaValid?: boolean;
  schemaError?: any;
}


export class SLRViewerDB extends Dexie {
  sessions!: Table<SessionRecord, number>;

  constructor() {
    super('SLRMagicViewerDB');
    this.version(1).stores({
      sessions: '++id, projectName, exportDate, importedAt, lastViewed, paperCount, schemaVersion'
    });
  }
}

// In-Memory Storage Fallback when IndexedDB is inaccessible (e.g. file:/// SecurityError)
export class InMemorySessionStore {
  private sessions: Map<number, SessionRecord> = new Map();
  private nextId: number = 1;

  async getSessions(): Promise<SessionRecord[]> {
    const list = Array.from(this.sessions.values());
    return list.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
  }

  async getSession(id: number | string): Promise<SessionRecord | null> {
    const numId = Number(id);
    const session = this.sessions.get(numId);
    if (!session) return null;

    const cloned = { ...session };
    if (cloned.rawData) {
      const validation = validateViewerSnapshotSafe(cloned.rawData);
      if (validation.isValid) {
        cloned.rawData = validation.data;
        cloned.isSchemaValid = true;
        cloned.schemaError = null;
      } else {
        cloned.isSchemaValid = false;
        cloned.schemaError = validation;
      }
    }
    return cloned;
  }

  async createSession(filename: string, parsedData: any): Promise<SessionRecord> {
    const validatedData = validateViewerSnapshot(parsedData);
    const projectName = validatedData.project?.name || filename.replace('.slr-viewer', '');
    const exportDate = validatedData.export_date || new Date().toISOString();
    const paperCount = validatedData.final_cohort?.total_count || validatedData.final_cohort?.papers?.length || 0;
    const totalCorpusCount = validatedData.screened_corpus?.total_count || validatedData.screened_corpus?.papers?.length || paperCount;
    const schemaVersion = validatedData.schema_version || '1.1.0';

    const id = this.nextId++;
    const newSession: SessionRecord = {
      id,
      projectName,
      filename,
      exportDate,
      importedAt: new Date().toISOString(),
      lastViewed: new Date().toISOString(),
      paperCount,
      totalCorpusCount,
      schemaVersion,
      rawData: validatedData,
      isSchemaValid: true,
      schemaError: null
    };

    this.sessions.set(id, newSession);
    return { ...newSession };
  }

  async updateSession(id: number | string, parsedData: any): Promise<SessionRecord | undefined> {
    const numId = Number(id);
    const existing = this.sessions.get(numId);
    if (!existing) return undefined;

    const validatedData = validateViewerSnapshot(parsedData);
    const paperCount = validatedData.final_cohort?.total_count || validatedData.final_cohort?.papers?.length || 0;
    const totalCorpusCount = validatedData.screened_corpus?.total_count || validatedData.screened_corpus?.papers?.length || paperCount;
    const exportDate = validatedData.export_date || new Date().toISOString();
    const schemaVersion = validatedData.schema_version || '1.1.0';

    const updated: SessionRecord = {
      ...existing,
      exportDate,
      importedAt: new Date().toISOString(),
      paperCount,
      totalCorpusCount,
      schemaVersion,
      rawData: validatedData,
      isSchemaValid: true,
      schemaError: null
    };

    this.sessions.set(numId, updated);
    return { ...updated };
  }

  async deleteSession(id: number | string): Promise<boolean> {
    return this.sessions.delete(Number(id));
  }

  async updateLastViewed(id: number | string): Promise<void> {
    const numId = Number(id);
    const existing = this.sessions.get(numId);
    if (existing) {
      existing.lastViewed = new Date().toISOString();
      this.sessions.set(numId, existing);
    }
  }
}

export const memoryStore = new InMemorySessionStore();

let _idbAvailable: boolean | null = null;
let _dbInstance: SLRViewerDB | null = null;

function disableIndexedDB(e: any): void {
  if (_idbAvailable !== false) {
    console.warn('[StorageService] IndexedDB failure, switching permanently to InMemorySessionStore:', e);
  }
  _idbAvailable = false;
  if (_dbInstance) {
    try {
      _dbInstance.close();
    } catch {}
    _dbInstance = null;
  }
}

export function isIndexedDBAvailable(): boolean {
  if (_idbAvailable !== null) return _idbAvailable;
  try {
    if (typeof window === 'undefined' || !window.indexedDB) {
      _idbAvailable = false;
      return false;
    }
    const idb = window.indexedDB;
    if (!idb) {
      _idbAvailable = false;
      return false;
    }
    _idbAvailable = true;
    return true;
  } catch (e) {
    console.warn('[StorageService] IndexedDB unavailable (file:/// or SecurityError). Using in-memory fallback.', e);
    _idbAvailable = false;
    return false;
  }
}

export function getDb(): SLRViewerDB | null {
  if (!isIndexedDBAvailable()) return null;
  if (!_dbInstance) {
    try {
      _dbInstance = new SLRViewerDB();
    } catch (e) {
      disableIndexedDB(e);
    }
  }
  return _dbInstance;
}

// Proxy exported db for backward compatibility without throwing at module load time
export const db = new Proxy({} as SLRViewerDB, {
  get(_target, prop) {
    const realDb = getDb();
    if (!realDb) {
      throw new Error('IndexedDB is not accessible in this environment.');
    }
    return (realDb as any)[prop];
  }
});

export const StorageService = {
  async getSessions(): Promise<SessionRecord[]> {
    const database = getDb();
    if (database) {
      try {
        const sessions = await database.sessions.toArray();
        return sessions.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
      } catch (e) {
        disableIndexedDB(e);
      }
    }
    return memoryStore.getSessions();
  },

  async getSession(id: number | string): Promise<SessionRecord | null> {
    const database = getDb();
    if (database) {
      try {
        const session = await database.sessions.get(Number(id));
        if (session) {
          if (session.rawData) {
            const validation = validateViewerSnapshotSafe(session.rawData);
            if (validation.isValid) {
              session.rawData = validation.data;
              session.isSchemaValid = true;
              session.schemaError = null;
            } else {
              session.isSchemaValid = false;
              session.schemaError = validation;
            }
          }
          return session;
        }
      } catch (e) {
        disableIndexedDB(e);
      }
    }
    return memoryStore.getSession(id);
  },

  async createSession(filename: string, parsedData: any): Promise<SessionRecord> {
    const database = getDb();
    if (database) {
      try {
        // Enforce strict schema validation
        const validatedData = validateViewerSnapshot(parsedData);

        const projectName = validatedData.project?.name || filename.replace('.slr-viewer', '');
        const exportDate = validatedData.export_date || new Date().toISOString();
        const paperCount = validatedData.final_cohort?.total_count || validatedData.final_cohort?.papers?.length || 0;
        const totalCorpusCount = validatedData.screened_corpus?.total_count || validatedData.screened_corpus?.papers?.length || paperCount;
        const schemaVersion = validatedData.schema_version || '1.1.0';

        const newSession: SessionRecord = {
          projectName,
          filename,
          exportDate,
          importedAt: new Date().toISOString(),
          lastViewed: new Date().toISOString(),
          paperCount,
          totalCorpusCount,
          schemaVersion,
          rawData: validatedData,
          isSchemaValid: true,
          schemaError: null
        };

        const id = await database.sessions.add(newSession);
        return { id, ...newSession };
      } catch (e) {
        disableIndexedDB(e);
      }
    }
    return memoryStore.createSession(filename, parsedData);
  },

  async updateSession(id: number | string, parsedData: any): Promise<SessionRecord | undefined> {
    const database = getDb();
    if (database) {
      try {
        const validatedData = validateViewerSnapshot(parsedData);
        const numId = Number(id);
        const paperCount = validatedData.final_cohort?.total_count || validatedData.final_cohort?.papers?.length || 0;
        const totalCorpusCount = validatedData.screened_corpus?.total_count || validatedData.screened_corpus?.papers?.length || paperCount;
        const exportDate = validatedData.export_date || new Date().toISOString();
        const schemaVersion = validatedData.schema_version || '1.1.0';

        await database.sessions.update(numId, {
          exportDate,
          importedAt: new Date().toISOString(),
          paperCount,
          totalCorpusCount,
          schemaVersion,
          rawData: validatedData,
          isSchemaValid: true,
          schemaError: null
        });

        const updated = await database.sessions.get(numId);
        if (updated) return updated;
      } catch (e) {
        disableIndexedDB(e);
      }
    }
    return memoryStore.updateSession(id, parsedData);
  },

  async deleteSession(id: number | string): Promise<boolean> {
    const database = getDb();
    if (database) {
      try {
        await database.sessions.delete(Number(id));
        return true;
      } catch (e) {
        disableIndexedDB(e);
      }
    }
    return memoryStore.deleteSession(id);
  },

  async updateLastViewed(id: number | string): Promise<void> {
    const database = getDb();
    if (database) {
      try {
        await database.sessions.update(Number(id), {
          lastViewed: new Date().toISOString()
        });
        return;
      } catch (e) {
        disableIndexedDB(e);
      }
    }
    return memoryStore.updateLastViewed(id);
  }
};

export default StorageService;
