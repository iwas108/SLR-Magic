// StorageService.js - Hybrid Storage Engine (IndexedDB with InMemorySessionStore fallback)
import Dexie from 'dexie';

const STANDARD_METADATA_KEYS = [
  'Title', 'Abstract', 'Authors', 'Year', 'DOI', 'PDF_Link',
  'Import_Source', 'Source', 'Import_Date', 'DOI_Link', 'Link',
  'Publisher', 'Conference name', 'PDF_Base64'
];

const APPRAISAL_FIELDS = [
  'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale', 'Reviewer_Name',
  'Reviewer_Decision', 'Reviewer_EC_Code', 'Reviewer_Reasoning', 'Reviewer_Confidence'
];

// In-Memory Storage Fallback when IndexedDB is inaccessible (e.g. file:/// SecurityError in Firefox/Safari)
export class InMemorySessionStore {
  constructor() {
    this.config = new Map();
    this.sessions = new Map();
    this.papers = new Map(); // key: `${paperId}___${sessionId}`
    this.nextSessionId = 1;
  }

  async getConfig(key, defaultValue = null) {
    return this.config.has(key) ? this.config.get(key) : defaultValue;
  }

  async setConfig(key, value) {
    this.config.set(key, value);
  }

  async getSessions() {
    const sessionList = Array.from(this.sessions.values());
    const augmentedSessions = sessionList.map((session) => {
      const papers = Array.from(this.papers.values()).filter(p => p.sessionId === session.id);
      const totalPapers = papers.length;
      const poolType = session.poolType || session.metadata?.pool_type || session.metadata?.poolType || 'CAL_Pool_A';

      const completedPapers = papers.filter((paper) => {
        const app = paper.appraisal || {};
        const decision = app.Human_Decision || app.Reviewer_Decision;
        if (!decision) return false;

        const hasBasic = decision && (poolType === 'CAL_Pool_C' || poolType === 'pool_c' || poolType === 'QC_Batch' ||
                         ((app.Human_Rationale || app.Reviewer_Reasoning) &&
                          String(app.Human_Rationale || app.Reviewer_Reasoning).trim() !== ''));

        if (!hasBasic) return false;

        const ecRules = session.metadata?.ec_rules || session.metadata?.ecRules || [];
        if (decision === 'Exclude' && ecRules.length > 0) {
          if (!app.Human_EC_Trigger && !app.Reviewer_EC_Code) return false;
        }

        if (decision === 'Include') {
          if (poolType === 'CAL_Pool_C' || poolType === 'pool_c' || poolType === 'QC_Batch') {
            const qaRules = session.metadata?.qa_rules || session.metadata?.qaRules || [];
            const qaScores = app.Human_QA_Scores || {};
            for (const rule of qaRules) {
              const item = qaScores[rule.code];
              if (item === undefined || item.value === undefined || item.value === null || item.value === '' ||
                  !item.evidence || String(item.evidence).trim() === '') {
                return false;
              }
            }
            const extRules = session.metadata?.extraction_rules || session.metadata?.extractionRules || [];
            const extData = app.Human_Extracted_Data || {};
            for (const rule of extRules) {
              const item = extData[rule.json_key];
              if (item === undefined || item.value === undefined || item.value === null || String(item.value).trim() === '' ||
                  !item.evidence || String(item.evidence).trim() === '') {
                return false;
              }
            }
          } else {
            const dynamicKeys = Object.keys(app).filter(
              (k) => !APPRAISAL_FIELDS.includes(k)
            );
            for (const key of dynamicKeys) {
              const item = app[key];
              if (key.toLowerCase().startsWith('qa')) {
                if (item === undefined || item.value === undefined || item.value === '' ||
                    !item.evidence || String(item.evidence).trim() === '') {
                  return false;
                }
              } else if (key.toLowerCase().startsWith('rq')) {
                if (item === undefined || item.value === undefined || String(item.value).trim() === '' ||
                    !item.evidence || String(item.evidence).trim() === '') {
                  return false;
                }
              }
            }
          }
        }

        return true;
      }).length;

      return {
        ...session,
        projectName: session.projectName || session.metadata?.project_name || session.metadata?.projectName || 'Unnamed Project',
        poolType: session.poolType || session.metadata?.pool_type || session.metadata?.poolType || 'CAL_Pool_A',
        totalPapers,
        completedPapers,
        filename: session.metadata?.filename || `session_${session.id}.slr`,
        reviewerName: '',
        status: session.metadata?.status || 'in-progress',
        lastModified: session.metadata?.lastModified || Date.now(),
        importedAt: session.metadata?.importedAt || Date.now(),
        currentIndex: session.metadata?.currentIndex || 0
      };
    });

    return augmentedSessions.sort((a, b) => b.lastModified - a.lastModified);
  }

  async getSession(sessionId) {
    const id = parseInt(sessionId, 10);
    const session = this.sessions.get(id);
    if (!session) return null;

    const papers = Array.from(this.papers.values()).filter(p => p.sessionId === id);

    return {
      ...session,
      projectName: session.projectName || session.metadata?.project_name || session.metadata?.projectName || 'Unnamed Project',
      poolType: session.poolType || session.metadata?.pool_type || session.metadata?.poolType || 'CAL_Pool_A',
      papers,
      filename: session.metadata?.filename || `session_${session.id}.slr`,
      reviewerName: '',
      status: session.metadata?.status || 'in-progress',
      lastModified: session.metadata?.lastModified || Date.now(),
      importedAt: session.metadata?.importedAt || Date.now(),
      currentIndex: session.metadata?.currentIndex || 0
    };
  }

  async getPapersForSession(sessionId) {
    const id = parseInt(sessionId, 10);
    return Array.from(this.papers.values()).filter(p => p.sessionId === id);
  }

  async createSession(filename, papersArray, metadataBlock = {}) {
    const poolType = metadataBlock.pool_type || metadataBlock.poolType || metadataBlock.phase || 'CAL_Pool_A';
    const projectName = metadataBlock.project_name ||
                        metadataBlock.projectName ||
                        metadataBlock.Project_Name ||
                        metadataBlock['Project Name'] ||
                        filename.replace(/\.[^/.]+$/, "");

    const sessionId = this.nextSessionId++;
    const sessionRecord = {
      id: sessionId,
      projectName,
      poolType,
      exportDate: metadataBlock.export_date || metadataBlock.exportDate || new Date().toISOString(),
      metadata: {
        filename,
        reviewerName: '',
        project_id: metadataBlock.project_id || metadataBlock.projectId || '',
        project_name: projectName,
        pool_type: poolType,
        status: 'in-progress',
        currentIndex: 0,
        lastModified: Date.now(),
        importedAt: Date.now(),
        research_manifesto: metadataBlock.research_manifesto || metadataBlock.researchManifesto || '',
        research_objective: metadataBlock.research_objective || metadataBlock.researchObjective || '',
        research_questions: metadataBlock.research_questions || metadataBlock.researchQuestions || '',
        quality_assurance_definition: metadataBlock.quality_assurance_definition || metadataBlock.qualityAssuranceDefinition || '',
        exclusion_criteria: metadataBlock.exclusion_criteria || metadataBlock.exclusionCriteria || '',
        ec_rules: metadataBlock.ec_rules || metadataBlock.ecRules || [],
        reasoning_template: metadataBlock.reasoning_template || metadataBlock.reasoningTemplate || [],
        qa_rules: metadataBlock.qa_rules || metadataBlock.qaRules || [],
        extraction_rules: metadataBlock.extraction_rules || metadataBlock.extractionRules || []
      }
    };
    this.sessions.set(sessionId, sessionRecord);

    papersArray.forEach((paper) => {
      let cleanPaper = { ...paper };
      if (poolType === 'CAL_Pool_A') {
        const allowedKeys = ['Paper_ID', 'Title', 'Year', 'Abstract', 'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale'];
        Object.keys(cleanPaper).forEach((k) => {
          if (!allowedKeys.includes(k)) {
            delete cleanPaper[k];
          }
        });
      }

      const standard_metadata = {};
      const appraisal = {
        Human_Decision: cleanPaper.Human_Decision || cleanPaper.Reviewer_Decision || '',
        Human_Rationale: cleanPaper.Human_Rationale || cleanPaper.Reviewer_Reasoning || '',
        Human_EC_Trigger: cleanPaper.Human_EC_Trigger || cleanPaper.Reviewer_EC_Code || ''
      };

      Object.entries(cleanPaper).forEach(([key, val]) => {
        if (key === 'Paper_ID') return;

        if (STANDARD_METADATA_KEYS.includes(key) || (!APPRAISAL_FIELDS.includes(key) && typeof val !== 'object')) {
          standard_metadata[key] = val;
        } else if (APPRAISAL_FIELDS.includes(key)) {
          if (key === 'Human_Decision' || key === 'Reviewer_Decision') appraisal.Human_Decision = val || appraisal.Human_Decision;
          if (key === 'Human_Rationale' || key === 'Reviewer_Reasoning') appraisal.Human_Rationale = val || appraisal.Human_Rationale;
          if (key === 'Human_EC_Trigger' || key === 'Reviewer_EC_Code') appraisal.Human_EC_Trigger = val || appraisal.Human_EC_Trigger;
        } else {
          appraisal[key] = val;
        }
      });

      const paperRecord = {
        Paper_ID: cleanPaper.Paper_ID,
        sessionId,
        standard_metadata,
        appraisal,
        rawPaper: cleanPaper
      };
      this.papers.set(`${cleanPaper.Paper_ID}___${sessionId}`, paperRecord);
    });

    return {
      id: sessionId,
      projectName,
      poolType
    };
  }

  async updateSession(sessionId, updates) {
    const id = parseInt(sessionId, 10);
    const session = this.sessions.get(id);
    if (!session) return null;

    const sessionKeys = ['projectName', 'poolType', 'exportDate'];
    const topUpdates = {};
    const metaUpdates = {};

    Object.entries(updates).forEach(([key, val]) => {
      if (sessionKeys.includes(key)) {
        topUpdates[key] = val;
      } else {
        metaUpdates[key] = val;
      }
    });

    const newMetadata = {
      ...session.metadata,
      ...metaUpdates,
      lastModified: Date.now()
    };

    const updatedSession = {
      ...session,
      ...topUpdates,
      metadata: newMetadata
    };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async updatePaperAppraisal(sessionId, paperId, appraisalUpdates) {
    const sId = parseInt(sessionId, 10);
    const key = `${paperId}___${sId}`;
    const paper = this.papers.get(key);
    if (!paper) return null;

    const newAppraisal = {
      ...paper.appraisal,
      ...appraisalUpdates
    };

    paper.appraisal = newAppraisal;
    this.papers.set(key, paper);

    const session = this.sessions.get(sId);
    if (session) {
      session.metadata = {
        ...session.metadata,
        lastModified: Date.now()
      };
      this.sessions.set(sId, session);
    }

    return newAppraisal;
  }

  async deleteSession(sessionId) {
    const id = parseInt(sessionId, 10);
    this.sessions.delete(id);
    for (const [key, paper] of this.papers.entries()) {
      if (paper.sessionId === id) {
        this.papers.delete(key);
      }
    }
  }

  async updateSessionData(sessionId, newMetadata, newPapersArray) {
    const sId = parseInt(sessionId, 10);
    const session = this.sessions.get(sId);
    if (!session) throw new Error('Session not found');

    const poolType = newMetadata.pool_type || newMetadata.poolType || newMetadata.phase || session.poolType;
    const projectName = newMetadata.project_name ||
                        newMetadata.projectName ||
                        newMetadata.Project_Name ||
                        newMetadata['Project Name'] ||
                        session.projectName;

    const existingPapers = Array.from(this.papers.values()).filter(p => p.sessionId === sId);
    const existingMap = new Map(existingPapers.map(p => [p.Paper_ID, p]));
    const newPids = new Set(newPapersArray.map(p => p.Paper_ID));

    // Delete removed papers
    existingPapers.forEach(p => {
      if (!newPids.has(p.Paper_ID)) {
        this.papers.delete(`${p.Paper_ID}___${sId}`);
      }
    });

    newPapersArray.forEach(paper => {
      const pid = paper.Paper_ID;
      let cleanPaper = { ...paper };
      if (poolType === 'CAL_Pool_A') {
        const allowedKeys = ['Paper_ID', 'Title', 'Year', 'Abstract', 'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale'];
        Object.keys(cleanPaper).forEach((k) => {
          if (!allowedKeys.includes(k)) {
            delete cleanPaper[k];
          }
        });
      }

      const standard_metadata = {};
      const appraisal = {
        Human_Decision: cleanPaper.Human_Decision || cleanPaper.Reviewer_Decision || '',
        Human_Rationale: cleanPaper.Human_Rationale || cleanPaper.Reviewer_Reasoning || '',
        Human_EC_Trigger: cleanPaper.Human_EC_Trigger || cleanPaper.Reviewer_EC_Code || ''
      };

      Object.entries(cleanPaper).forEach(([k, val]) => {
        if (k === 'Paper_ID') return;
        if (STANDARD_METADATA_KEYS.includes(k) || (!APPRAISAL_FIELDS.includes(k) && typeof val !== 'object')) {
          standard_metadata[k] = val;
        } else if (APPRAISAL_FIELDS.includes(k)) {
          if (k === 'Human_Decision' || k === 'Reviewer_Decision') appraisal.Human_Decision = val || appraisal.Human_Decision;
          if (k === 'Human_Rationale' || k === 'Reviewer_Reasoning') appraisal.Human_Rationale = val || appraisal.Human_Rationale;
          if (k === 'Human_EC_Trigger' || k === 'Reviewer_EC_Code') appraisal.Human_EC_Trigger = val || appraisal.Human_EC_Trigger;
        } else {
          appraisal[k] = val;
        }
      });

      if (existingMap.has(pid)) {
        const oldPaper = existingMap.get(pid);
        const mergedAppraisal = {
          ...appraisal,
          ...oldPaper.appraisal
        };
        Object.entries(appraisal).forEach(([k, v]) => {
          if (!APPRAISAL_FIELDS.includes(k) && !oldPaper.appraisal[k]) {
            mergedAppraisal[k] = v;
          }
        });
        this.papers.set(`${pid}___${sId}`, {
          Paper_ID: pid,
          sessionId: sId,
          standard_metadata,
          appraisal: mergedAppraisal,
          rawPaper: cleanPaper
        });
      } else {
        this.papers.set(`${pid}___${sId}`, {
          Paper_ID: pid,
          sessionId: sId,
          standard_metadata,
          appraisal,
          rawPaper: cleanPaper
        });
      }
    });

    let currentIndex = session.metadata.currentIndex || 0;
    if (currentIndex >= newPapersArray.length) {
      currentIndex = 0;
    }

    const updatedMetadata = {
      ...session.metadata,
      project_id: newMetadata.project_id || newMetadata.projectId || session.metadata?.project_id || '',
      project_name: projectName,
      pool_type: poolType,
      currentIndex,
      lastModified: Date.now(),
      research_manifesto: newMetadata.research_manifesto || newMetadata.researchManifesto || '',
      research_objective: newMetadata.research_objective || newMetadata.researchObjective || '',
      research_questions: newMetadata.research_questions || newMetadata.researchQuestions || '',
      quality_assurance_definition: newMetadata.quality_assurance_definition || newMetadata.qualityAssuranceDefinition || '',
      exclusion_criteria: newMetadata.exclusion_criteria || newMetadata.exclusionCriteria || '',
      ec_rules: newMetadata.ec_rules || newMetadata.ecRules || [],
      reasoning_template: newMetadata.reasoning_template || newMetadata.reasoningTemplate || [],
      qa_rules: newMetadata.qa_rules || newMetadata.qaRules || [],
      extraction_rules: newMetadata.extraction_rules || newMetadata.extractionRules || []
    };

    const updatedSession = {
      ...session,
      projectName,
      poolType,
      exportDate: newMetadata.export_date || newMetadata.exportDate || session.exportDate,
      metadata: updatedMetadata
    };
    this.sessions.set(sId, updatedSession);
  }

  async exportSession(sessionId, reviewerName) {
    const id = parseInt(sessionId, 10);
    const session = this.sessions.get(id);
    if (!session) throw new Error('Session not found.');

    const papers = Array.from(this.papers.values()).filter(p => p.sessionId === id);
    const exportedPapers = papers.map((paper) => {
      const decisionVal = paper.appraisal.Human_Decision || paper.appraisal.Reviewer_Decision || '';
      const rationaleVal = paper.appraisal.Human_Rationale || paper.appraisal.Reviewer_Reasoning || '';
      const ecVal = paper.appraisal.Human_EC_Trigger || paper.appraisal.Reviewer_EC_Code || '';

      if (session.poolType === 'CAL_Pool_A') {
        return {
          Paper_ID: paper.Paper_ID,
          Title: paper.standard_metadata.Title || '',
          Year: paper.standard_metadata.Year || '',
          Abstract: paper.standard_metadata.Abstract || '',
          Human_Decision: decisionVal,
          Human_EC_Trigger: ecVal,
          Human_Rationale: rationaleVal
        };
      }

      const base = paper.rawPaper ? { ...paper.rawPaper } : { Paper_ID: paper.Paper_ID, ...paper.standard_metadata };
      const flatPaper = { ...base };
      delete flatPaper.Reviewer_Decision;
      delete flatPaper.Reviewer_Reasoning;
      delete flatPaper.Reviewer_Confidence;
      delete flatPaper.Reviewer_EC_Code;
      delete flatPaper.Reviewer_Name;

      flatPaper.Human_Decision = decisionVal;
      flatPaper.Human_Rationale = rationaleVal;
      flatPaper.Human_EC_Trigger = ecVal;

      Object.entries(paper.appraisal).forEach(([key, val]) => {
        if (!APPRAISAL_FIELDS.includes(key)) {
          flatPaper[key] = val;
        }
      });

      return flatPaper;
    });

    const resolvedProjectId = session.metadata?.project_id || session.metadata?.projectId || '';
    const poolType = session.poolType || session.metadata?.pool_type || session.metadata?.poolType || 'CAL_Pool_A';

    const metadata = {
      project_id: resolvedProjectId,
      project_name: session.projectName || session.metadata?.project_name || session.metadata?.projectName || 'Unnamed Project',
      research_manifesto: session.metadata?.research_manifesto || session.metadata?.researchManifesto || '',
      research_objective: session.metadata?.research_objective || session.metadata?.researchObjective || '',
      research_questions: session.metadata?.research_questions || session.metadata?.researchQuestions || '',
      quality_assurance_definition: session.metadata?.quality_assurance_definition || session.metadata?.qualityAssuranceDefinition || '',
      exclusion_criteria: session.metadata?.exclusion_criteria || session.metadata?.exclusionCriteria || '',
      pool_type: poolType,
      export_date: new Date().toISOString(),
      ec_rules: session.metadata?.ec_rules || session.metadata?.ecRules || [],
      reasoning_template: session.metadata?.reasoning_template || session.metadata?.reasoningTemplate || [],
      ...(session.metadata?.qa_rules || session.metadata?.qaRules ? { qa_rules: session.metadata?.qa_rules || session.metadata?.qaRules } : {}),
      ...(session.metadata?.extraction_rules || session.metadata?.extractionRules ? { extraction_rules: session.metadata?.extraction_rules || session.metadata?.extractionRules } : {}),
      ...(reviewerName ? { reviewer_name: reviewerName } : {})
    };

    return {
      metadata,
      papers: exportedPapers
    };
  }
}

export const memoryStore = new InMemorySessionStore();

let _idbAvailable = null;
let _dbInstance = null;

function disableIndexedDB(e) {
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

export function isIndexedDBAvailable() {
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

export function getDb() {
  if (!isIndexedDBAvailable()) return null;
  if (!_dbInstance) {
    try {
      _dbInstance = new Dexie('SLRMagicInterRaterDB');
      _dbInstance.version(1).stores({
        sessions: '++id, projectName, poolType, exportDate',
        papers: '[Paper_ID+sessionId], sessionId, Paper_ID',
        config: 'key'
      });
    } catch (e) {
      disableIndexedDB(e);
    }
  }
  return _dbInstance;
}

// Proxy exported db for backward compatibility without throwing at module load time
export const db = new Proxy({}, {
  get(_target, prop) {
    const realDb = getDb();
    if (!realDb) {
      throw new Error('IndexedDB is not accessible in this environment.');
    }
    return realDb[prop];
  }
});

export const StorageService = {
  // Config Store Actions
  getConfig: async (key, defaultValue = null) => {
    const database = getDb();
    if (database) {
      try {
        const record = await database.config.get(key);
        return record ? record.value : defaultValue;
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.getConfig(key, defaultValue);
  },

  setConfig: async (key, value) => {
    const database = getDb();
    if (database) {
      try {
        await database.config.put({ key, value });
        return;
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.setConfig(key, value);
  },

  // Sessions Store Actions
  getSessions: async () => {
    const database = getDb();
    if (database) {
      try {
        const sessions = await database.sessions.toArray();
        const augmentedSessions = await Promise.all(
          sessions.map(async (session) => {
            const papers = await database.papers.where({ sessionId: session.id }).toArray();
            const totalPapers = papers.length;

            const poolType = session.poolType || session.metadata?.pool_type || session.metadata?.poolType || 'CAL_Pool_A';
            const completedPapers = papers.filter((paper) => {
              const app = paper.appraisal || {};
              const decision = app.Human_Decision || app.Reviewer_Decision;
              if (!decision) return false;

              // Basic validation
              const hasBasic = decision && (poolType === 'CAL_Pool_C' || poolType === 'pool_c' || poolType === 'QC_Batch' ||
                               ((app.Human_Rationale || app.Reviewer_Reasoning) &&
                                String(app.Human_Rationale || app.Reviewer_Reasoning).trim() !== ''));

              if (!hasBasic) return false;

              // Exclusion check
              const ecRules = session.metadata?.ec_rules || session.metadata?.ecRules || [];
              if (decision === 'Exclude' && ecRules.length > 0) {
                if (!app.Human_EC_Trigger && !app.Reviewer_EC_Code) return false;
              }

              // Stage 2.2/2.3 / CAL_Pool_C dynamic check validation:
              if (decision === 'Include') {
                if (poolType === 'CAL_Pool_C' || poolType === 'pool_c' || poolType === 'QC_Batch') {
                  const qaRules = session.metadata?.qa_rules || session.metadata?.qaRules || [];
                  const qaScores = app.Human_QA_Scores || {};
                  for (const rule of qaRules) {
                    const item = qaScores[rule.code];
                    if (item === undefined || item.value === undefined || item.value === null || item.value === '' ||
                        !item.evidence || String(item.evidence).trim() === '') {
                      return false;
                    }
                  }
                  const extRules = session.metadata?.extraction_rules || session.metadata?.extractionRules || [];
                  const extData = app.Human_Extracted_Data || {};
                  for (const rule of extRules) {
                    const item = extData[rule.json_key];
                    if (item === undefined || item.value === undefined || item.value === null || String(item.value).trim() === '' ||
                        !item.evidence || String(item.evidence).trim() === '') {
                      return false;
                    }
                  }
                } else {
                  const dynamicKeys = Object.keys(app).filter(
                    (k) => !APPRAISAL_FIELDS.includes(k)
                  );
                  for (const key of dynamicKeys) {
                    const item = app[key];
                    if (key.toLowerCase().startsWith('qa')) {
                      if (item === undefined || item.value === undefined || item.value === '' ||
                          !item.evidence || String(item.evidence).trim() === '') {
                        return false;
                      }
                    } else if (key.toLowerCase().startsWith('rq')) {
                      if (item === undefined || item.value === undefined || String(item.value).trim() === '' ||
                          !item.evidence || String(item.evidence).trim() === '') {
                        return false;
                      }
                    }
                  }
                }
              }

              return true;
            }).length;

            return {
              ...session,
              projectName: session.projectName || session.metadata?.project_name || session.metadata?.projectName || 'Unnamed Project',
              poolType: session.poolType || session.metadata?.pool_type || session.metadata?.poolType || 'CAL_Pool_A',
              totalPapers,
              completedPapers,
              filename: session.metadata?.filename || `session_${session.id}.slr`,
              reviewerName: '',
              status: session.metadata?.status || 'in-progress',
              lastModified: session.metadata?.lastModified || Date.now(),
              importedAt: session.metadata?.importedAt || Date.now(),
              currentIndex: session.metadata?.currentIndex || 0
            };
          })
        );

        return augmentedSessions.sort((a, b) => b.lastModified - a.lastModified);
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.getSessions();
  },

  getSession: async (sessionId) => {
    const database = getDb();
    if (database) {
      try {
        const id = parseInt(sessionId, 10);
        const session = await database.sessions.get(id);
        if (session) {
          const papers = await database.papers.where({ sessionId: id }).toArray();
          return {
            ...session,
            projectName: session.projectName || session.metadata?.project_name || session.metadata?.projectName || 'Unnamed Project',
            poolType: session.poolType || session.metadata?.pool_type || session.metadata?.poolType || 'CAL_Pool_A',
            papers,
            filename: session.metadata?.filename || `session_${session.id}.slr`,
            reviewerName: '',
            status: session.metadata?.status || 'in-progress',
            lastModified: session.metadata?.lastModified || Date.now(),
            importedAt: session.metadata?.importedAt || Date.now(),
            currentIndex: session.metadata?.currentIndex || 0
          };
        }
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.getSession(sessionId);
  },

  getPapersForSession: async (sessionId) => {
    const database = getDb();
    if (database) {
      try {
        const id = parseInt(sessionId, 10);
        return await database.papers.where({ sessionId: id }).toArray();
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.getPapersForSession(sessionId);
  },

  createSession: async (filename, papersArray, metadataBlock = {}) => {
    const database = getDb();
    if (database) {
      try {
        const poolType = metadataBlock.pool_type || metadataBlock.poolType || metadataBlock.phase || 'CAL_Pool_A';
        const projectName = metadataBlock.project_name ||
                            metadataBlock.projectName ||
                            metadataBlock.Project_Name ||
                            metadataBlock['Project Name'] ||
                            filename.replace(/\.[^/.]+$/, "");

        let sessionId;
        await database.transaction('rw', [database.sessions, database.papers], async () => {
          sessionId = await database.sessions.add({
            projectName,
            poolType,
            exportDate: metadataBlock.export_date || metadataBlock.exportDate || new Date().toISOString(),
            metadata: {
              filename,
              reviewerName: '',
              project_id: metadataBlock.project_id || metadataBlock.projectId || '',
              project_name: projectName,
              pool_type: poolType,
              status: 'in-progress',
              currentIndex: 0,
              lastModified: Date.now(),
              importedAt: Date.now(),
              research_manifesto: metadataBlock.research_manifesto || metadataBlock.researchManifesto || '',
              research_objective: metadataBlock.research_objective || metadataBlock.researchObjective || '',
              research_questions: metadataBlock.research_questions || metadataBlock.researchQuestions || '',
              quality_assurance_definition: metadataBlock.quality_assurance_definition || metadataBlock.qualityAssuranceDefinition || '',
              exclusion_criteria: metadataBlock.exclusion_criteria || metadataBlock.exclusionCriteria || '',
              ec_rules: metadataBlock.ec_rules || metadataBlock.ecRules || [],
              reasoning_template: metadataBlock.reasoning_template || metadataBlock.reasoningTemplate || [],
              qa_rules: metadataBlock.qa_rules || metadataBlock.qaRules || [],
              extraction_rules: metadataBlock.extraction_rules || metadataBlock.extractionRules || []
            }
          });

          const papersToInsert = papersArray.map((paper) => {
            let cleanPaper = { ...paper };
            if (poolType === 'CAL_Pool_A') {
              const allowedKeys = ['Paper_ID', 'Title', 'Year', 'Abstract', 'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale'];
              Object.keys(cleanPaper).forEach((k) => {
                if (!allowedKeys.includes(k)) {
                  delete cleanPaper[k];
                }
              });
            }

            const standard_metadata = {};
            const appraisal = {
              Human_Decision: cleanPaper.Human_Decision || cleanPaper.Reviewer_Decision || '',
              Human_Rationale: cleanPaper.Human_Rationale || cleanPaper.Reviewer_Reasoning || '',
              Human_EC_Trigger: cleanPaper.Human_EC_Trigger || cleanPaper.Reviewer_EC_Code || ''
            };

            Object.entries(cleanPaper).forEach(([key, val]) => {
              if (key === 'Paper_ID') return;

              if (STANDARD_METADATA_KEYS.includes(key) || (!APPRAISAL_FIELDS.includes(key) && typeof val !== 'object')) {
                standard_metadata[key] = val;
              } else if (APPRAISAL_FIELDS.includes(key)) {
                if (key === 'Human_Decision' || key === 'Reviewer_Decision') appraisal.Human_Decision = val || appraisal.Human_Decision;
                if (key === 'Human_Rationale' || key === 'Reviewer_Reasoning') appraisal.Human_Rationale = val || appraisal.Human_Rationale;
                if (key === 'Human_EC_Trigger' || key === 'Reviewer_EC_Code') appraisal.Human_EC_Trigger = val || appraisal.Human_EC_Trigger;
              } else {
                appraisal[key] = val;
              }
            });

            return {
              Paper_ID: cleanPaper.Paper_ID,
              sessionId,
              standard_metadata,
              appraisal,
              rawPaper: cleanPaper
            };
          });

          await database.papers.bulkAdd(papersToInsert);
        });

        return {
          id: sessionId,
          projectName,
          poolType
        };
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.createSession(filename, papersArray, metadataBlock);
  },

  updateSession: async (sessionId, updates) => {
    const database = getDb();
    if (database) {
      try {
        const id = parseInt(sessionId, 10);
        const session = await database.sessions.get(id);
        if (session) {
          const sessionKeys = ['projectName', 'poolType', 'exportDate'];
          const topUpdates = {};
          const metaUpdates = {};

          Object.entries(updates).forEach(([key, val]) => {
            if (sessionKeys.includes(key)) {
              topUpdates[key] = val;
            } else {
              metaUpdates[key] = val;
            }
          });

          const newMetadata = {
            ...session.metadata,
            ...metaUpdates,
            lastModified: Date.now()
          };

          await database.sessions.update(id, {
            ...topUpdates,
            metadata: newMetadata
          });

          return {
            ...session,
            ...topUpdates,
            metadata: newMetadata
          };
        }
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.updateSession(sessionId, updates);
  },

  updatePaperAppraisal: async (sessionId, paperId, appraisalUpdates) => {
    const database = getDb();
    if (database) {
      try {
        const sId = parseInt(sessionId, 10);
        const paper = await database.papers.get([paperId, sId]);
        if (paper) {
          const newAppraisal = {
            ...paper.appraisal,
            ...appraisalUpdates
          };

          await database.papers.update([paperId, sId], {
            appraisal: newAppraisal
          });

          await database.sessions.update(sId, {
            'metadata.lastModified': Date.now()
          });

          return newAppraisal;
        }
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.updatePaperAppraisal(sessionId, paperId, appraisalUpdates);
  },

  deleteSession: async (sessionId) => {
    const database = getDb();
    if (database) {
      try {
        const id = parseInt(sessionId, 10);
        await database.transaction('rw', [database.sessions, database.papers], async () => {
          await database.sessions.delete(id);
          await database.papers.where({ sessionId: id }).delete();
        });
        return;
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.deleteSession(sessionId);
  },

  updateSessionData: async (sessionId, newMetadata, newPapersArray) => {
    const database = getDb();
    if (database) {
      try {
        const sId = parseInt(sessionId, 10);
        const session = await database.sessions.get(sId);
        if (!session) throw new Error('Session not found');

        const poolType = newMetadata.pool_type || newMetadata.poolType || newMetadata.phase || session.poolType;
        const projectName = newMetadata.project_name ||
                            newMetadata.projectName ||
                            newMetadata.Project_Name ||
                            newMetadata['Project Name'] ||
                            session.projectName;

        const existingPapers = await database.papers.where({ sessionId: sId }).toArray();
        const existingMap = new Map(existingPapers.map(p => [p.Paper_ID, p]));
        const newPids = new Set(newPapersArray.map(p => p.Paper_ID));

        const pidsToDelete = existingPapers
          .filter(p => !newPids.has(p.Paper_ID))
          .map(p => p.Paper_ID);

        const papersToAdd = [];
        const papersToUpdate = [];

        newPapersArray.forEach(paper => {
          const pid = paper.Paper_ID;
          let cleanPaper = { ...paper };
          if (poolType === 'CAL_Pool_A') {
            const allowedKeys = ['Paper_ID', 'Title', 'Year', 'Abstract', 'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale'];
            Object.keys(cleanPaper).forEach((k) => {
              if (!allowedKeys.includes(k)) {
                delete cleanPaper[k];
              }
            });
          }

          const standard_metadata = {};
          const appraisal = {
            Human_Decision: cleanPaper.Human_Decision || cleanPaper.Reviewer_Decision || '',
            Human_Rationale: cleanPaper.Human_Rationale || cleanPaper.Reviewer_Reasoning || '',
            Human_EC_Trigger: cleanPaper.Human_EC_Trigger || cleanPaper.Reviewer_EC_Code || ''
          };

          Object.entries(cleanPaper).forEach(([key, val]) => {
            if (key === 'Paper_ID') return;
            if (STANDARD_METADATA_KEYS.includes(key) || (!APPRAISAL_FIELDS.includes(key) && typeof val !== 'object')) {
              standard_metadata[key] = val;
            } else if (APPRAISAL_FIELDS.includes(key)) {
              if (key === 'Human_Decision' || key === 'Reviewer_Decision') appraisal.Human_Decision = val || appraisal.Human_Decision;
              if (key === 'Human_Rationale' || key === 'Reviewer_Reasoning') appraisal.Human_Rationale = val || appraisal.Human_Rationale;
              if (key === 'Human_EC_Trigger' || key === 'Reviewer_EC_Code') appraisal.Human_EC_Trigger = val || appraisal.Human_EC_Trigger;
            } else {
              appraisal[key] = val;
            }
          });

          const existing = existingMap.get(pid);
          if (existing) {
            papersToUpdate.push({
              key: [pid, sId],
              changes: {
                standard_metadata,
                appraisal: {
                  ...existing.appraisal,
                  ...appraisal
                },
                rawPaper: cleanPaper
              }
            });
          } else {
            papersToAdd.push({
              Paper_ID: pid,
              sessionId: sId,
              standard_metadata,
              appraisal,
              rawPaper: cleanPaper
            });
          }
        });

        let currentIndex = session.metadata?.currentIndex || 0;
        if (currentIndex >= newPapersArray.length) {
          currentIndex = 0;
        }

        const updatedMetadata = {
          ...session.metadata,
          project_id: newMetadata.project_id || newMetadata.projectId || session.metadata?.project_id || '',
          project_name: projectName,
          pool_type: poolType,
          currentIndex,
          lastModified: Date.now(),
          research_manifesto: newMetadata.research_manifesto || newMetadata.researchManifesto || '',
          research_objective: newMetadata.research_objective || newMetadata.researchObjective || '',
          research_questions: newMetadata.research_questions || newMetadata.researchQuestions || '',
          quality_assurance_definition: newMetadata.quality_assurance_definition || newMetadata.qualityAssuranceDefinition || '',
          exclusion_criteria: newMetadata.exclusion_criteria || newMetadata.exclusionCriteria || '',
          ec_rules: newMetadata.ec_rules || newMetadata.ecRules || [],
          reasoning_template: newMetadata.reasoning_template || newMetadata.reasoningTemplate || [],
          qa_rules: newMetadata.qa_rules || newMetadata.qaRules || [],
          extraction_rules: newMetadata.extraction_rules || newMetadata.extractionRules || []
        };

        await database.transaction('rw', [database.sessions, database.papers], async () => {
          for (const pid of pidsToDelete) {
            await database.papers.delete([pid, sId]);
          }
          if (papersToAdd.length > 0) {
            await database.papers.bulkAdd(papersToAdd);
          }
          for (const item of papersToUpdate) {
            await database.papers.update(item.key, item.changes);
          }
          await database.sessions.update(sId, {
            projectName,
            poolType,
            exportDate: newMetadata.export_date || newMetadata.exportDate || session.exportDate,
            metadata: updatedMetadata
          });
        });
        return;
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.updateSessionData(sessionId, newMetadata, newPapersArray);
  },

  exportSession: async (sessionId, reviewerName) => {
    const database = getDb();
    if (database) {
      try {
        const id = parseInt(sessionId, 10);
        const session = await database.sessions.get(id);
        if (session) {
          const papers = await database.papers.where({ sessionId: id }).toArray();
          const exportedPapers = papers.map((paper) => {
            const decisionVal = paper.appraisal.Human_Decision || paper.appraisal.Reviewer_Decision || '';
            const rationaleVal = paper.appraisal.Human_Rationale || paper.appraisal.Reviewer_Reasoning || '';
            const ecVal = paper.appraisal.Human_EC_Trigger || paper.appraisal.Reviewer_EC_Code || '';

            if (session.poolType === 'CAL_Pool_A') {
              return {
                Paper_ID: paper.Paper_ID,
                Title: paper.standard_metadata.Title || '',
                Year: paper.standard_metadata.Year || '',
                Abstract: paper.standard_metadata.Abstract || '',
                Human_Decision: decisionVal,
                Human_EC_Trigger: ecVal,
                Human_Rationale: rationaleVal
              };
            }

            const base = paper.rawPaper ? { ...paper.rawPaper } : { Paper_ID: paper.Paper_ID, ...paper.standard_metadata };
            const flatPaper = { ...base };

            delete flatPaper.Reviewer_Decision;
            delete flatPaper.Reviewer_Reasoning;
            delete flatPaper.Reviewer_Confidence;
            delete flatPaper.Reviewer_EC_Code;
            delete flatPaper.Reviewer_Name;

            flatPaper.Human_Decision = decisionVal;
            flatPaper.Human_Rationale = rationaleVal;
            flatPaper.Human_EC_Trigger = ecVal;

            Object.entries(paper.appraisal).forEach(([key, val]) => {
              if (!APPRAISAL_FIELDS.includes(key)) {
                flatPaper[key] = val;
              }
            });

            return flatPaper;
          });

          const resolvedProjectId = session.metadata?.project_id || session.metadata?.projectId || '';
          const poolType = session.poolType || session.metadata?.pool_type || session.metadata?.poolType || 'CAL_Pool_A';

          const metadata = {
            project_id: resolvedProjectId,
            project_name: session.projectName || session.metadata?.project_name || session.metadata?.projectName || 'Unnamed Project',
            research_manifesto: session.metadata?.research_manifesto || session.metadata?.researchManifesto || '',
            research_objective: session.metadata?.research_objective || session.metadata?.researchObjective || '',
            research_questions: session.metadata?.research_questions || session.metadata?.researchQuestions || '',
            quality_assurance_definition: session.metadata?.quality_assurance_definition || session.metadata?.qualityAssuranceDefinition || '',
            exclusion_criteria: session.metadata?.exclusion_criteria || session.metadata?.exclusionCriteria || '',
            pool_type: poolType,
            export_date: new Date().toISOString(),
            ec_rules: session.metadata?.ec_rules || session.metadata?.ecRules || [],
            reasoning_template: session.metadata?.reasoning_template || session.metadata?.reasoningTemplate || [],
            ...(session.metadata?.qa_rules || session.metadata?.qaRules ? { qa_rules: session.metadata?.qa_rules || session.metadata?.qaRules } : {}),
            ...(session.metadata?.extraction_rules || session.metadata?.extractionRules ? { extraction_rules: session.metadata?.extraction_rules || session.metadata?.extractionRules } : {}),
            ...(reviewerName ? { reviewer_name: reviewerName } : {})
          };

          return {
            metadata,
            papers: exportedPapers
          };
        }
      } catch (error) {
        disableIndexedDB(error);
      }
    }
    return memoryStore.exportSession(sessionId, reviewerName);
  }
};

export default StorageService;
