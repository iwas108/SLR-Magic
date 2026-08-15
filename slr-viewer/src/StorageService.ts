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

export const db = new SLRViewerDB();

export const StorageService = {
  async getSessions(): Promise<SessionRecord[]> {
    try {
      const sessions = await db.sessions.toArray();
      return sessions.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
    } catch (e) {
      console.error('Error fetching sessions:', e);
      return [];
    }
  },

  async getSession(id: number | string): Promise<SessionRecord | null> {
    try {
      const session = await db.sessions.get(Number(id));
      if (!session) return null;

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
    } catch (e) {
      console.error(`Error fetching session ${id}:`, e);
      return null;
    }
  },

  async createSession(filename: string, parsedData: any): Promise<SessionRecord> {
    try {
      // Enforce strict schema validation
      const validatedData = validateViewerSnapshot(parsedData);

      const projectName = validatedData.project?.name || filename.replace('.slr-viewer', '');
      const exportDate = validatedData.export_date || new Date().toISOString();
      const paperCount = validatedData.final_cohort?.total_count || validatedData.final_cohort?.papers?.length || 0;
      const schemaVersion = validatedData.schema_version || '1.1.0';

      const newSession: SessionRecord = {
        projectName,
        filename,
        exportDate,
        importedAt: new Date().toISOString(),
        lastViewed: new Date().toISOString(),
        paperCount,
        schemaVersion,
        rawData: validatedData,
        isSchemaValid: true,
        schemaError: null
      };

      const id = await db.sessions.add(newSession);
      return { id, ...newSession };
    } catch (e) {
      console.error('Error creating session:', e);
      throw e;
    }
  },

  async updateSession(id: number | string, parsedData: any): Promise<SessionRecord | undefined> {
    try {
      const validatedData = validateViewerSnapshot(parsedData);
      const numId = Number(id);
      const paperCount = validatedData.final_cohort?.total_count || validatedData.final_cohort?.papers?.length || 0;
      const exportDate = validatedData.export_date || new Date().toISOString();
      const schemaVersion = validatedData.schema_version || '1.1.0';

      await db.sessions.update(numId, {
        exportDate,
        importedAt: new Date().toISOString(),
        paperCount,
        schemaVersion,
        rawData: validatedData,
        isSchemaValid: true,
        schemaError: null
      });

      return await db.sessions.get(numId);
    } catch (e) {
      console.error(`Error updating session ${id}:`, e);
      throw e;
    }
  },

  async deleteSession(id: number | string): Promise<boolean> {
    try {
      await db.sessions.delete(Number(id));
      return true;
    } catch (e) {
      console.error(`Error deleting session ${id}:`, e);
      throw e;
    }
  },

  async updateLastViewed(id: number | string): Promise<void> {
    try {
      await db.sessions.update(Number(id), {
        lastViewed: new Date().toISOString()
      });
    } catch (e) {
      console.error(`Error updating lastViewed for session ${id}:`, e);
    }
  }
};

export default StorageService;
