import React, { useState } from 'react';
import { Download, Table, ExternalLink } from 'lucide-react';
import Papa from 'papaparse';

export function exportFinalCohortCsv(sessionData, filteredPapers = null) {
  const papers = filteredPapers || sessionData?.final_cohort?.papers || [];
  const project = sessionData?.project || {};
  const umbrellanizerMap = sessionData?.final_cohort?.umbrellanizer_mappings || {};

  const headers = [
    'Paper_ID',
    'Title',
    'Authors',
    'Year',
    'DOI',
    'Publisher',
    'Original_Publisher',
    'Import_Source',
    'Citation_Count',
    'Local_PDF_Status',
    'Decision_Source',
    'Active_Stage',
    'QA_Total_Score',
    'QA_1_Value',
    'QA_1_Evidence',
    'QA_2_Value',
    'QA_2_Evidence',
    'QA_3_Value',
    'QA_3_Evidence',
    'QA_4_Value',
    'QA_4_Evidence',
    'QA_5_Value',
    'QA_5_Evidence',
    'QA_6_Value',
    'QA_6_Evidence',
    'QA_7_Value',
    'QA_7_Evidence',
    'QA_8_Value',
    'QA_8_Evidence',
    'RQ_1_Raw',
    'RQ_1_Umbrella',
    'RQ_2_Raw',
    'RQ_2_Umbrella',
    'RQ_3_Raw',
    'RQ_3_Umbrella',
    'RQ_4_Raw',
    'RQ_4_Umbrella',
    'RQ_5_Raw',
    'RQ_5_Umbrella',
    'RQ_6_Raw',
    'RQ_6_Umbrella',
    'RQ_7_Raw',
    'RQ_7_Umbrella',
    'RQ_8_Raw',
    'RQ_8_Umbrella',
    'RQ_9_Raw',
    'RQ_9_Umbrella',
    'Abstract',
  ];

  const rows = papers.map((paper) => {
    const manualStage = paper.manual_stage || 0;
    const aiStage = paper.ai_stage || 0;

    let decisionSource = 'AI';
    if (manualStage > aiStage) {
      decisionSource = 'Manual';
    } else if (manualStage === aiStage && paper.manual_decision) {
      decisionSource = 'Manual (Override)';
    }

    const activeStage = Math.max(manualStage, aiStage);

    // QA scores & evidence
    const qaObj = paper.manual_quality_assessment || paper.ai_quality_assessment;
    let qaTotalScore = 0;
    const qaValues = {};
    const qaEvidences = {};

    if (qaObj) {
      for (let i = 1; i <= 8; i++) {
        const key = `qa${i}`;
        const item = qaObj[key];
        if (item) {
          const valStr = typeof item === 'object' ? item.value || '0' : String(item);
          qaValues[key] = valStr;
          qaTotalScore += parseFloat(valStr) || 0;
          qaEvidences[key] = typeof item === 'object' ? item.evidence || '' : '';
        } else {
          qaValues[key] = '0';
          qaEvidences[key] = '';
        }
      }
    }

    // Extracted data & umbrella
    const extObj = paper.manual_extracted_data || paper.ai_extracted_data;
    const rqRaws = {};
    const rqUmbrellas = {};

    for (let i = 1; i <= 9; i++) {
      const rqKey = `rq${i}`;
      let rawVal = extObj ? extObj[rqKey] || '' : '';
      if (Array.isArray(rawVal)) {
        rawVal = rawVal.join('; ');
      } else if (typeof rawVal === 'object' && rawVal !== null) {
        rawVal = JSON.stringify(rawVal);
      } else {
        rawVal = String(rawVal);
      }

      rqRaws[rqKey] = rawVal;

      let umbrellaVal = rawVal;
      const fieldMapping = umbrellanizerMap[rqKey];
      if (fieldMapping && Array.isArray(fieldMapping)) {
        const normalized = rawVal.trim().toLowerCase();
        const found = fieldMapping.find(
          (m) => m.raw_token && m.raw_token.trim().toLowerCase() === normalized
        );
        if (found) {
          umbrellaVal = found.umbrella_category;
        }
      }
      rqUmbrellas[rqKey] = umbrellaVal;
    }

    return [
      paper.Paper_ID || '',
      paper.Title || '',
      paper.Authors || '',
      paper.Year || '',
      paper.DOI || '',
      paper.Publisher || '',
      paper.Original_Publisher || '',
      paper.Import_Source || '',
      paper.citation_count || 0,
      paper.Local_PDF_Status || '',
      decisionSource,
      activeStage,
      qaTotalScore.toFixed(1),
      qaValues['qa1'] || '',
      qaEvidences['qa1'] || '',
      qaValues['qa2'] || '',
      qaEvidences['qa2'] || '',
      qaValues['qa3'] || '',
      qaEvidences['qa3'] || '',
      qaValues['qa4'] || '',
      qaEvidences['qa4'] || '',
      qaValues['qa5'] || '',
      qaEvidences['qa5'] || '',
      qaValues['qa6'] || '',
      qaEvidences['qa6'] || '',
      qaValues['qa7'] || '',
      qaEvidences['qa7'] || '',
      qaValues['qa8'] || '',
      qaEvidences['qa8'] || '',
      rqRaws['rq1'] || '',
      rqUmbrellas['rq1'] || '',
      rqRaws['rq2'] || '',
      rqUmbrellas['rq2'] || '',
      rqRaws['rq3'] || '',
      rqUmbrellas['rq3'] || '',
      rqRaws['rq4'] || '',
      rqUmbrellas['rq4'] || '',
      rqRaws['rq5'] || '',
      rqUmbrellas['rq5'] || '',
      rqRaws['rq6'] || '',
      rqUmbrellas['rq6'] || '',
      rqRaws['rq7'] || '',
      rqUmbrellas['rq7'] || '',
      rqRaws['rq8'] || '',
      rqUmbrellas['rq8'] || '',
      rqRaws['rq9'] || '',
      rqUmbrellas['rq9'] || '',
      paper.Abstract || '',
    ];
  });

  const csvString = Papa.unparse({
    fields: headers,
    data: rows,
  });

  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const sanitizedProjectName = (project.name || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${sanitizedProjectName}_cohort_${dateStr}.csv`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
