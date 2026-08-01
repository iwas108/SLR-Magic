import Dexie from 'dexie';
import { normalizeViewerSnapshot } from './utils/schemaMigration';

export class SLRViewerDB extends Dexie {
  constructor() {
    super('SLRMagicViewerDB');
    this.version(1).stores({
      sessions: '++id, projectName, exportDate, importedAt, lastViewed, paperCount'
    });
  }
}

export const db = new SLRViewerDB();

export const StorageService = {
  async getSessions() {
    try {
      const sessions = await db.sessions.toArray();
      return sessions.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
    } catch (e) {
      console.error('Error fetching sessions:', e);
      return [];
    }
  },

  async getSession(id) {
    try {
      const session = await db.sessions.get(Number(id));
      if (session && session.rawData) {
        session.rawData = normalizeViewerSnapshot(session.rawData);
      }
      return session;
    } catch (e) {
      console.error(`Error fetching session ${id}:`, e);
      return null;
    }
  },

  async createSession(filename, parsedData) {
    try {
      const projectName = parsedData.project?.name || filename.replace('.slr-viewer', '');
      const exportDate = parsedData.export_date || new Date().toISOString();
      const paperCount = parsedData.final_cohort?.total_count || parsedData.final_cohort?.papers?.length || 0;

      const newSession = {
        projectName,
        filename,
        exportDate,
        importedAt: new Date().toISOString(),
        lastViewed: new Date().toISOString(),
        paperCount,
        rawData: parsedData
      };

      const id = await db.sessions.add(newSession);
      return { id, ...newSession };
    } catch (e) {
      console.error('Error creating session:', e);
      throw e;
    }
  },

  async updateSession(id, parsedData) {
    try {
      const numId = Number(id);
      const paperCount = parsedData.final_cohort?.total_count || parsedData.final_cohort?.papers?.length || 0;
      const exportDate = parsedData.export_date || new Date().toISOString();

      await db.sessions.update(numId, {
        exportDate,
        importedAt: new Date().toISOString(),
        paperCount,
        rawData: parsedData
      });

      return await db.sessions.get(numId);
    } catch (e) {
      console.error(`Error updating session ${id}:`, e);
      throw e;
    }
  },

  async deleteSession(id) {
    try {
      await db.sessions.delete(Number(id));
      return true;
    } catch (e) {
      console.error(`Error deleting session ${id}:`, e);
      throw e;
    }
  },

  async updateLastViewed(id) {
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
