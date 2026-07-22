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
  'Publisher', 'Conference name', 'PDF_Base64'
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

  createSession: async (filename, papersArray, metadataBlock = {}) => {
    try {
      const poolType = metadataBlock.pool_type || metadataBlock.poolType || metadataBlock.phase || 'CAL_Pool_A';
      const projectName = metadataBlock.project_name || 
                          metadataBlock.projectName || 
                          metadataBlock.Project_Name || 
                          metadataBlock['Project Name'] || 
                          filename.replace(/\.[^/.]+$/, "");

      // Insert session record
      const sessionId = await db.sessions.add({
        projectName,
        poolType,
        exportDate: metadataBlock.export_date || metadataBlock.exportDate || new Date().toISOString(),
        metadata: {
          filename,
          reviewerName: '',
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

      // Insert papers
      const papersToInsert = papersArray.map((paper) => {
        let cleanPaper = { ...paper };
        if (poolType === 'CAL_Pool_A') {
          // Drop all non-whitelisted keys
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
          Paper_ID: cleanPaper.Paper_ID,
          sessionId,
          standard_metadata,
          appraisal,
          rawPaper: cleanPaper
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

      // Determine poolType and projectName checking new format keys
      const poolType = newMetadata.pool_type || newMetadata.poolType || newMetadata.phase || session.poolType;
      const projectName = newMetadata.project_name || 
                          newMetadata.projectName || 
                          newMetadata.Project_Name || 
                          newMetadata['Project Name'] || 
                          session.projectName;

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
        
        let cleanPaper = { ...paper };
        if (poolType === 'CAL_Pool_A') {
          // Drop non-whitelisted keys
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
            rawPaper: cleanPaper
          });
        } else {
          // Add as new paper
          papersToAdd.push({
            Paper_ID: pid,
            sessionId: sId,
            standard_metadata,
            appraisal,
            rawPaper: cleanPaper
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

        let currentIndex = session.metadata.currentIndex || 0;
        if (currentIndex >= newPapersArray.length) {
          currentIndex = 0;
        }

        const updatedMetadata = {
          ...session.metadata,
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

        await db.sessions.update(sId, {
          projectName,
          poolType,
          exportDate: newMetadata.export_date || newMetadata.exportDate || session.exportDate,
          metadata: updatedMetadata
        });
      });
    } catch (error) {
      console.error(`Failed to update session data for ${sessionId}:`, error);
      throw error;
    }
  },

  exportSession: async (sessionId, reviewerName) => {
    try {
      const id = parseInt(sessionId, 10);
      const session = await db.sessions.get(id);
      if (!session) throw new Error('Session not found.');

      const papers = await db.papers.where({ sessionId: id }).toArray();
      // Flatten papers back to exported SLR Magic JSON structure
      const exportedPapers = papers.map((paper) => {
        const decisionVal = paper.appraisal.Human_Decision || paper.appraisal.Reviewer_Decision || '';
        const rationaleVal = paper.appraisal.Human_Rationale || paper.appraisal.Reviewer_Reasoning || '';
        const ecVal = paper.appraisal.Human_EC_Trigger || paper.appraisal.Reviewer_EC_Code || '';

        if (session.poolType === 'CAL_Pool_A') {
          // STRICT 7-KEY WHITELISTED SCHEMA
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

        // LEGACY POOLS FORMAT
        const base = paper.rawPaper ? { ...paper.rawPaper } : { Paper_ID: paper.Paper_ID, ...paper.standard_metadata };
        const flatPaper = {
          ...base
        };

        delete flatPaper.Reviewer_Decision;
        delete flatPaper.Reviewer_Reasoning;
        delete flatPaper.Reviewer_Confidence;
        delete flatPaper.Reviewer_EC_Code;
        delete flatPaper.Reviewer_Name;

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

      // Construct standard metadata block depending on poolType
      if (session.poolType === 'CAL_Pool_A') {
        // SNAKE-CASE PROJECT METADATA
        const exportPayload = {
          metadata: {
            project_name: session.projectName || session.metadata?.project_name || session.metadata?.projectName || 'Unnamed Project',
            research_manifesto: session.metadata?.research_manifesto || session.metadata?.researchManifesto || '',
            research_objective: session.metadata?.research_objective || session.metadata?.researchObjective || '',
            research_questions: session.metadata?.research_questions || session.metadata?.researchQuestions || '',
            quality_assurance_definition: session.metadata?.quality_assurance_definition || session.metadata?.qualityAssuranceDefinition || '',
            exclusion_criteria: session.metadata?.exclusion_criteria || session.metadata?.exclusionCriteria || '',
            pool_type: 'CAL_Pool_A',
            export_date: new Date().toISOString(),
            ec_rules: session.metadata?.ec_rules || session.metadata?.ecRules || [],
            reasoning_template: session.metadata?.reasoning_template || session.metadata?.reasoningTemplate || [],
            ...(reviewerName ? { reviewer_name: reviewerName } : {})
          },
          papers: exportedPapers
        };
        return exportPayload;
      }

      // LEGACY CAMEL-CASE EXPORT
      const exportPayload = {
        metadata: {
          projectName: session.projectName,
          researchManifesto: session.metadata?.researchManifesto || session.metadata?.research_manifesto || '',
          researchObjective: session.metadata?.researchObjective || session.metadata?.research_objective || '',
          researchQuestions: session.metadata?.researchQuestions || session.metadata?.research_questions || '',
          qualityAssuranceDefinition: session.metadata?.qualityAssuranceDefinition || session.metadata?.quality_assurance_definition || '',
          exclusionCriteria: session.metadata?.exclusionCriteria || session.metadata?.exclusion_criteria || '',
          poolType: session.poolType,
          exportDate: new Date().toISOString(),
          ecRules: session.metadata?.ecRules || session.metadata?.ec_rules || [],
          reasoningTemplate: session.metadata?.reasoningTemplate || session.metadata?.reasoning_template || [],
          ...(reviewerName ? { reviewer_name: reviewerName } : {})
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
