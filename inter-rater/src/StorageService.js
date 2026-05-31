// StorageService.js
import Dexie from 'dexie';

// Initialize Dexie database
export const db = new Dexie('SLRMagicInterRaterDB');
db.version(1).stores({
  sessions: '++id, projectName, poolType, exportDate',
  papers: '[Paper_ID+sessionId], sessionId, Paper_ID',
  config: 'key'
});

const STANDARD_METADATA_KEYS = [
  'Title', 'Abstract', 'Authors', 'Year', 'DOI', 'PDF_Link',
  'Import_Source', 'Source', 'Import_Date', 'DOI_Link', 'Link',
  'Publisher', 'Conference name'
];

const APPRAISAL_FIELDS = [
  'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale', 'Reviewer_Name',
  'Reviewer_Decision', 'Reviewer_EC_Code', 'Reviewer_Reasoning', 'Reviewer_Confidence'
];

export const StorageService = {
  // Config Store Actions
  getConfig: async (key, defaultValue = null) => {
    try {
      const record = await db.config.get(key);
      return record ? record.value : defaultValue;
    } catch (error) {
      console.error(`Failed to get config for key ${key}:`, error);
      return defaultValue;
    }
  },

  setConfig: async (key, value) => {
    try {
      await db.config.put({ key, value });
    } catch (error) {
      console.error(`Failed to set config for key ${key}:`, error);
    }
  },

  // Sessions Store Actions
  getSessions: async () => {
    try {
      const sessions = await db.sessions.toArray();
      const augmentedSessions = await Promise.all(
        sessions.map(async (session) => {
          const papers = await db.papers.where({ sessionId: session.id }).toArray();
          const totalPapers = papers.length;
          
          const completedPapers = papers.filter((paper) => {
            const app = paper.appraisal || {};
            const decision = app.Human_Decision || app.Reviewer_Decision;
            if (!decision) return false;
            
            // Basic validation (confidence score removed completely)
            const hasBasic = (app.Human_Rationale || app.Reviewer_Reasoning) && 
                             String(app.Human_Rationale || app.Reviewer_Reasoning).trim() !== '';
            
            if (!hasBasic) return false;

            // Exclusion check
            if (decision === 'Exclude' && session.metadata?.ecRules?.length > 0) {
              if (!app.Human_EC_Trigger && !app.Reviewer_EC_Code) return false;
            }

            // Stage 2.2/2.3 / CAL_Pool_C dynamic check validation:
            if (decision === 'Include') {
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

            return true;
          }).length;

          return {
            ...session,
            totalPapers,
            completedPapers,
            filename: session.metadata?.filename || `session_${session.id}.slr`,
            reviewerName: session.metadata?.reviewerName || 'Unknown',
            status: session.metadata?.status || 'in-progress',
            lastModified: session.metadata?.lastModified || Date.now(),
            importedAt: session.metadata?.importedAt || Date.now(),
            currentIndex: session.metadata?.currentIndex || 0
          };
        })
      );
      
      return augmentedSessions.sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  },

  getSession: async (sessionId) => {
    try {
      const id = parseInt(sessionId, 10);
      const session = await db.sessions.get(id);
      if (!session) return null;

      const papers = await db.papers.where({ sessionId: id }).toArray();

      return {
        ...session,
        papers,
        filename: session.metadata?.filename || `session_${session.id}.slr`,
        reviewerName: session.metadata?.reviewerName || 'Unknown',
        status: session.metadata?.status || 'in-progress',
        lastModified: session.metadata?.lastModified || Date.now(),
        importedAt: session.metadata?.importedAt || Date.now(),
        currentIndex: session.metadata?.currentIndex || 0
      };
    } catch (error) {
      console.error(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  },

  getPapersForSession: async (sessionId) => {
    try {
      const id = parseInt(sessionId, 10);
      return await db.papers.where({ sessionId: id }).toArray();
    } catch (error) {
      console.error(`Failed to get papers for session ${sessionId}:`, error);
      return [];
    }
  },

  createSession: async (filename, reviewerName, papersArray, metadataBlock = {}) => {
    try {
      const poolType = metadataBlock.poolType || metadataBlock.phase || 'CAL_Pool_A';
      const projectName = metadataBlock.projectName || filename.replace(/\.[^/.]+$/, "");

      // Insert session record
      const sessionId = await db.sessions.add({
        projectName,
        poolType,
        exportDate: metadataBlock.exportDate || new Date().toISOString(),
        metadata: {
          filename,
          reviewerName,
          status: 'in-progress',
          currentIndex: 0,
          lastModified: Date.now(),
          importedAt: Date.now(),
          researchManifesto: metadataBlock.researchManifesto || '',
          researchObjective: metadataBlock.researchObjective || '',
          researchQuestions: metadataBlock.researchQuestions || '',
          qualityAssuranceDefinition: metadataBlock.qualityAssuranceDefinition || '',
          exclusionCriteria: metadataBlock.exclusionCriteria || '',
          ecRules: metadataBlock.ecRules || [],
          reasoningTemplate: metadataBlock.reasoningTemplate || []
        }
      });

      // Insert papers
      const papersToInsert = papersArray.map((paper) => {
        const standard_metadata = {};
        const appraisal = {
          Human_Decision: paper.Human_Decision || paper.Reviewer_Decision || '',
          Human_Rationale: paper.Human_Rationale || paper.Reviewer_Reasoning || '',
          Human_EC_Trigger: paper.Human_EC_Trigger || paper.Reviewer_EC_Code || ''
        };

        Object.entries(paper).forEach(([key, val]) => {
          if (key === 'Paper_ID') return;

          if (STANDARD_METADATA_KEYS.includes(key) || (!APPRAISAL_FIELDS.includes(key) && typeof val !== 'object')) {
            standard_metadata[key] = val;
          } else if (APPRAISAL_FIELDS.includes(key)) {
            // Check mappings
            if (key === 'Human_Decision' || key === 'Reviewer_Decision') appraisal.Human_Decision = val || appraisal.Human_Decision;
            if (key === 'Human_Rationale' || key === 'Reviewer_Reasoning') appraisal.Human_Rationale = val || appraisal.Human_Rationale;
            if (key === 'Human_EC_Trigger' || key === 'Reviewer_EC_Code') appraisal.Human_EC_Trigger = val || appraisal.Human_EC_Trigger;
          } else {
            // Store dynamic appraisal objects
            appraisal[key] = val;
          }
        });

        return {
          Paper_ID: paper.Paper_ID,
          sessionId,
          standard_metadata,
          appraisal,
          rawPaper: paper
        };
      });

      await db.papers.bulkAdd(papersToInsert);

      return {
        id: sessionId,
        projectName,
        poolType
      };
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  },

  updateSession: async (sessionId, updates) => {
    try {
      const id = parseInt(sessionId, 10);
      const session = await db.sessions.get(id);
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

      await db.sessions.update(id, {
        ...topUpdates,
        metadata: newMetadata
      });

      return {
        ...session,
        ...topUpdates,
        metadata: newMetadata
      };
    } catch (error) {
      console.error(`Failed to update session ${sessionId}:`, error);
      return null;
    }
  },

  updatePaperAppraisal: async (sessionId, paperId, appraisalUpdates) => {
    try {
      const sId = parseInt(sessionId, 10);
      const paper = await db.papers.get([paperId, sId]);
      if (!paper) return null;

      const newAppraisal = {
        ...paper.appraisal,
        ...appraisalUpdates
      };

      await db.papers.update([paperId, sId], {
        appraisal: newAppraisal
      });

      // Update session lastModified
      await db.sessions.update(sId, {
        'metadata.lastModified': Date.now()
      });

      return newAppraisal;
    } catch (error) {
      console.error(`Failed to update paper ${paperId} in session ${sessionId}:`, error);
      return null;
    }
  },

  deleteSession: async (sessionId) => {
    try {
      const id = parseInt(sessionId, 10);
      await db.transaction('rw', [db.sessions, db.papers], async () => {
        await db.sessions.delete(id);
        await db.papers.where({ sessionId: id }).delete();
      });
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  },

  updateSessionData: async (sessionId, newMetadata, newPapersArray) => {
    try {
      const sId = parseInt(sessionId, 10);
      const session = await db.sessions.get(sId);
      if (!session) throw new Error('Session not found');

      // 1. Get existing papers in DB
      const existingPapers = await db.papers.where({ sessionId: sId }).toArray();
      const existingMap = new Map(existingPapers.map(p => [p.Paper_ID, p]));

      // 2. Identify papers to drop, add, or update
      const newPids = new Set(newPapersArray.map(p => p.Paper_ID));
      
      const pidsToDelete = existingPapers
        .filter(p => !newPids.has(p.Paper_ID))
        .map(p => p.Paper_ID);

      const papersToAdd = [];
      const papersToUpdate = [];

      newPapersArray.forEach(paper => {
        const pid = paper.Paper_ID;
        
        const standard_metadata = {};
        const appraisal = {
          Human_Decision: paper.Human_Decision || paper.Reviewer_Decision || '',
          Human_Rationale: paper.Human_Rationale || paper.Reviewer_Reasoning || '',
          Human_EC_Trigger: paper.Human_EC_Trigger || paper.Reviewer_EC_Code || ''
        };

        Object.entries(paper).forEach(([key, val]) => {
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

        if (existingMap.has(pid)) {
          // Merge: update standard_metadata and preserve existing reviews
          const oldPaper = existingMap.get(pid);
          
          // Merge old review inputs into new appraisal fields
          const mergedAppraisal = {
            ...appraisal,
            ...oldPaper.appraisal
          };

          // Also check for any new dynamic keys that might have been added to the new SLR paper, keeping old ones too
          Object.entries(appraisal).forEach(([k, v]) => {
            if (!APPRAISAL_FIELDS.includes(k) && !oldPaper.appraisal[k]) {
              mergedAppraisal[k] = v;
            }
          });

          papersToUpdate.push({
            Paper_ID: pid,
            sessionId: sId,
            standard_metadata,
            appraisal: mergedAppraisal,
            rawPaper: paper
          });
        } else {
          // Add as new paper
          papersToAdd.push({
            Paper_ID: pid,
            sessionId: sId,
            standard_metadata,
            appraisal,
            rawPaper: paper
          });
        }
      });

      // Run Transaction
      await db.transaction('rw', [db.sessions, db.papers], async () => {
        // Drop non-existent papers
        for (const pid of pidsToDelete) {
          await db.papers.delete([pid, sId]);
        }

        // Add new papers
        if (papersToAdd.length > 0) {
          await db.papers.bulkAdd(papersToAdd);
        }

        // Update standard metadata & merged appraisal
        for (const paper of papersToUpdate) {
          await db.papers.put(paper);
        }

        // Update session meta block
        const poolType = newMetadata.poolType || newMetadata.phase || session.poolType;
        const projectName = newMetadata.projectName || session.projectName;

        let currentIndex = session.metadata.currentIndex || 0;
        if (currentIndex >= newPapersArray.length) {
          currentIndex = 0;
        }

        const updatedMetadata = {
          ...session.metadata,
          projectName,
          poolType,
          currentIndex,
          lastModified: Date.now(),
          researchManifesto: newMetadata.researchManifesto || '',
          researchObjective: newMetadata.researchObjective || '',
          researchQuestions: newMetadata.researchQuestions || '',
          qualityAssuranceDefinition: newMetadata.qualityAssuranceDefinition || '',
          exclusionCriteria: newMetadata.exclusionCriteria || '',
          ecRules: newMetadata.ecRules || [],
          reasoningTemplate: newMetadata.reasoningTemplate || []
        };

        await db.sessions.update(sId, {
          projectName,
          poolType,
          exportDate: newMetadata.exportDate || session.exportDate,
          metadata: updatedMetadata
        });
      });
    } catch (error) {
      console.error(`Failed to update session data for ${sessionId}:`, error);
      throw error;
    }
  },

  exportSession: async (sessionId) => {
    try {
      const id = parseInt(sessionId, 10);
      const session = await db.sessions.get(id);
      if (!session) throw new Error('Session not found.');

      const papers = await db.papers.where({ sessionId: id }).toArray();
      // Flatten papers back to exported SLR Magic JSON structure
      const exportedPapers = papers.map((paper) => {
        const base = paper.rawPaper ? { ...paper.rawPaper } : { Paper_ID: paper.Paper_ID, ...paper.standard_metadata };
        const flatPaper = {
          ...base
        };

        // Remove completely any legacy Reviewer_* keys and Reviewer_Name
        delete flatPaper.Reviewer_Decision;
        delete flatPaper.Reviewer_Reasoning;
        delete flatPaper.Reviewer_Confidence;
        delete flatPaper.Reviewer_EC_Code;
        delete flatPaper.Reviewer_Name;

        const decisionVal = paper.appraisal.Human_Decision || paper.appraisal.Reviewer_Decision || '';
        const rationaleVal = paper.appraisal.Human_Rationale || paper.appraisal.Reviewer_Reasoning || '';
        const ecVal = paper.appraisal.Human_EC_Trigger || paper.appraisal.Reviewer_EC_Code || '';

        // Write exclusively to the new Human_* fields
        flatPaper.Human_Decision = decisionVal;
        flatPaper.Human_Rationale = rationaleVal;
        flatPaper.Human_EC_Trigger = ecVal;

        // Re-inject dynamic appraisal keys
        Object.entries(paper.appraisal).forEach(([key, val]) => {
          if (!APPRAISAL_FIELDS.includes(key)) {
            flatPaper[key] = val;
          }
        });

        return flatPaper;
      });

      const exportPayload = {
        metadata: {
          projectName: session.projectName,
          researchManifesto: session.metadata?.researchManifesto || '',
          researchObjective: session.metadata?.researchObjective || '',
          researchQuestions: session.metadata?.researchQuestions || '',
          qualityAssuranceDefinition: session.metadata?.qualityAssuranceDefinition || '',
          exclusionCriteria: session.metadata?.exclusionCriteria || '',
          poolType: session.poolType,
          exportDate: new Date().toISOString(),
          ecRules: session.metadata?.ecRules || [],
          reasoningTemplate: session.metadata?.reasoningTemplate || []
        },
        papers: exportedPapers
      };

      return exportPayload;
    } catch (error) {
      console.error(`Failed to export session ${sessionId}:`, error);
      throw error;
    }
  }
};
