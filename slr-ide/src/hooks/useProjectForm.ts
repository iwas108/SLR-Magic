import { useState, useEffect, useRef } from 'react';
import { Project } from '@/types';

export function useProjectForm(initialData?: any) {
  const [name, setName] = useState(initialData?.name || '');
  const [folderName, setFolderName] = useState('');
  const [manifesto, setManifesto] = useState(initialData?.manifesto || '');
  const [objective, setObjective] = useState(initialData?.objective || '');
  const [questions, setQuestions] = useState(initialData?.questions || '');
  const [qaDefinition, setQaDefinition] = useState(initialData?.qa_definition || '');
  const [exclusionCriteria, setExclusionCriteria] = useState(initialData?.exclusion_criteria || '');
  const [poolA, setPoolA] = useState(initialData?.pool_a_size !== undefined ? String(initialData?.pool_a_size) : '50');
  const [poolB, setPoolB] = useState(initialData?.pool_b_size !== undefined ? String(initialData?.pool_b_size) : '30');
  const [poolC, setPoolC] = useState(initialData?.pool_c_size !== undefined ? String(initialData?.pool_c_size) : '20');
  const [gdriveDest, setGdriveDest] = useState(initialData?.gdrive_dest_path || 'SLR_Magic/PDFs');
  const [cloudProvider, setCloudProvider] = useState(initialData?.cloud_provider || 'gdrive');
  const [remoteName, setRemoteName] = useState(initialData?.rclone_remote_name || '');
  const [poolTags, setPoolTags] = useState<{
    pool_a: { code: string; label: string }[];
    pool_b: { code: string; label: string }[];
    pool_c: { code: string; label: string }[];
  }>({ pool_a: [], pool_b: [], pool_c: [] });
  const [ecRules, setEcRules] = useState<{ code: string; description: string }[]>([]);
  const [reasoningTemplate, setReasoningTemplate] = useState<string[]>([]);
  
  // Pool B & Pool C rule states
  const [poolBEcRules, setPoolBEcRules] = useState<{ code: string; description: string }[]>([]);
  const [poolBReasoningTemplate, setPoolBReasoningTemplate] = useState<string[]>([]);
  const [poolCQaRules, setPoolCQaRules] = useState<{ code: string; question: string; is_fatal_flaw?: boolean }[]>([]);
  const [poolCExtractionRules, setPoolCExtractionRules] = useState<{ json_key: string; question: string }[]>([]);
  const [projectBudgetLimit, setProjectBudgetLimit] = useState(initialData?.project_budget_limit !== undefined ? String(initialData?.project_budget_limit) : '5.0');
  const [projectTax, setProjectTax] = useState(initialData?.project_tax !== undefined ? String(initialData?.project_tax) : '0.0');

  const lastLoadedProjectRef = useRef<any | null>(null);

  useEffect(() => {
    if (initialData) {
      const isNewProject = !lastLoadedProjectRef.current || String(lastLoadedProjectRef.current.id) !== String(initialData.id);
      
      const dbValuesChanged = lastLoadedProjectRef.current && (
        lastLoadedProjectRef.current.name !== initialData.name ||
        lastLoadedProjectRef.current.manifesto !== initialData.manifesto ||
        lastLoadedProjectRef.current.objective !== initialData.objective ||
        lastLoadedProjectRef.current.questions !== initialData.questions ||
        lastLoadedProjectRef.current.qa_definition !== initialData.qa_definition ||
        lastLoadedProjectRef.current.exclusion_criteria !== initialData.exclusion_criteria ||
        String(lastLoadedProjectRef.current.pool_a_size) !== String(initialData.pool_a_size) ||
        String(lastLoadedProjectRef.current.pool_b_size) !== String(initialData.pool_b_size) ||
        String(lastLoadedProjectRef.current.pool_c_size) !== String(initialData.pool_c_size) ||
        lastLoadedProjectRef.current.gdrive_dest_path !== initialData.gdrive_dest_path ||
        lastLoadedProjectRef.current.cloud_provider !== initialData.cloud_provider ||
        lastLoadedProjectRef.current.rclone_remote_name !== initialData.rclone_remote_name ||
        String(lastLoadedProjectRef.current.project_budget_limit) !== String(initialData.project_budget_limit) ||
        String(lastLoadedProjectRef.current.project_tax) !== String(initialData.project_tax) ||
        JSON.stringify(lastLoadedProjectRef.current.pool_tags) !== JSON.stringify(initialData.pool_tags) ||
        JSON.stringify(lastLoadedProjectRef.current.ec_rules) !== JSON.stringify(initialData.ec_rules) ||
        JSON.stringify(lastLoadedProjectRef.current.reasoning_template) !== JSON.stringify(initialData.reasoning_template) ||
        JSON.stringify(lastLoadedProjectRef.current.pool_b_ec_rules) !== JSON.stringify(initialData.pool_b_ec_rules) ||
        JSON.stringify(lastLoadedProjectRef.current.pool_b_reasoning_template) !== JSON.stringify(initialData.pool_b_reasoning_template) ||
        JSON.stringify(lastLoadedProjectRef.current.pool_c_qa_rules) !== JSON.stringify(initialData.pool_c_qa_rules) ||
        JSON.stringify(lastLoadedProjectRef.current.pool_c_extraction_rules) !== JSON.stringify(initialData.pool_c_extraction_rules)
      );

      lastLoadedProjectRef.current = initialData;

      if (isNewProject || dbValuesChanged) {
        setName(initialData.name || '');
        setManifesto(initialData.manifesto || '');
        setObjective(initialData.objective || '');
        setQuestions(initialData.questions || '');
        setQaDefinition(initialData.qa_definition || '');
        setExclusionCriteria(initialData.exclusion_criteria || '');
        setPoolA(initialData.pool_a_size !== undefined ? String(initialData.pool_a_size) : '50');
        setPoolB(initialData.pool_b_size !== undefined ? String(initialData.pool_b_size) : '30');
        setPoolC(initialData.pool_c_size !== undefined ? String(initialData.pool_c_size) : '20');
        setGdriveDest(initialData.gdrive_dest_path || 'SLR_Magic/PDFs');
        setCloudProvider(initialData.cloud_provider || 'gdrive');
        setRemoteName(initialData.rclone_remote_name || '');
        setProjectBudgetLimit(initialData.project_budget_limit !== undefined ? String(initialData.project_budget_limit) : '5.0');
        setProjectTax(initialData.project_tax !== undefined ? String(initialData.project_tax) : '0.0');

        let parsedTags = { pool_a: [] as any[], pool_b: [] as any[], pool_c: [] as any[] };
        if (initialData.pool_tags) {
          try {
            parsedTags = typeof initialData.pool_tags === 'string' ? JSON.parse(initialData.pool_tags) : initialData.pool_tags;
          } catch (e) {
            console.error("Error parsing pool tags", e);
          }
        }
        parsedTags.pool_a = parsedTags.pool_a || [];
        parsedTags.pool_b = parsedTags.pool_b || [];
        parsedTags.pool_c = parsedTags.pool_c || [];
        setPoolTags(parsedTags);

        let parsedRules = [];
        if (initialData.ec_rules) {
          try {
            parsedRules = typeof initialData.ec_rules === 'string' ? JSON.parse(initialData.ec_rules) : initialData.ec_rules;
          } catch (e) {
            console.error("Error parsing ec rules", e);
          }
        }
        setEcRules(parsedRules || []);

        let parsedReasoning = [];
        if (initialData.reasoning_template) {
          try {
            parsedReasoning = typeof initialData.reasoning_template === 'string' ? JSON.parse(initialData.reasoning_template) : initialData.reasoning_template;
          } catch (e) {
            console.error("Error parsing reasoning template", e);
          }
        }
        setReasoningTemplate(parsedReasoning || []);

        let parsedPoolBEc = [];
        if (initialData.pool_b_ec_rules) {
          try {
            parsedPoolBEc = typeof initialData.pool_b_ec_rules === 'string' ? JSON.parse(initialData.pool_b_ec_rules) : initialData.pool_b_ec_rules;
          } catch (e) {
            console.error("Error parsing pool_b_ec_rules", e);
          }
        }
        setPoolBEcRules(parsedPoolBEc || []);

        let parsedPoolBReasoning = [];
        if (initialData.pool_b_reasoning_template) {
          try {
            parsedPoolBReasoning = typeof initialData.pool_b_reasoning_template === 'string' ? JSON.parse(initialData.pool_b_reasoning_template) : initialData.pool_b_reasoning_template;
          } catch (e) {
            console.error("Error parsing pool_b_reasoning_template", e);
          }
        }
        setPoolBReasoningTemplate(parsedPoolBReasoning || []);

        let parsedPoolCQa = [];
        if (initialData.pool_c_qa_rules) {
          try {
            parsedPoolCQa = typeof initialData.pool_c_qa_rules === 'string' ? JSON.parse(initialData.pool_c_qa_rules) : initialData.pool_c_qa_rules;
          } catch (e) {
            console.error("Error parsing pool_c_qa_rules", e);
          }
        }
        setPoolCQaRules(parsedPoolCQa || []);

        let parsedPoolCExtraction = [];
        if (initialData.pool_c_extraction_rules) {
          try {
            parsedPoolCExtraction = typeof initialData.pool_c_extraction_rules === 'string' ? JSON.parse(initialData.pool_c_extraction_rules) : initialData.pool_c_extraction_rules;
          } catch (e) {
            console.error("Error parsing pool_c_extraction_rules", e);
          }
        }
        setPoolCExtractionRules(parsedPoolCExtraction || []);
      }
    } else {
      lastLoadedProjectRef.current = null;
    }
  }, [initialData]);

  const handleAddPoolTag = (pool: 'pool_a' | 'pool_b' | 'pool_c') => {
    setPoolTags(prev => ({
      ...prev,
      [pool]: [...(prev[pool] || []), { code: '', label: '' }]
    }));
  };

  const handleUpdatePoolTag = (pool: 'pool_a' | 'pool_b' | 'pool_c', index: number, field: 'code' | 'label', value: string) => {
    setPoolTags(prev => {
      const updated = [...(prev[pool] || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, [pool]: updated };
    });
  };

  const handleRemovePoolTag = (pool: 'pool_a' | 'pool_b' | 'pool_c', index: number) => {
    setPoolTags(prev => {
      const updated = (prev[pool] || []).filter((_, i) => i !== index);
      return { ...prev, [pool]: updated };
    });
  };

  const handleAddEcRule = () => {
    setEcRules(prev => [...prev, { code: '', description: '' }]);
  };

  const handleUpdateEcRule = (index: number, field: 'code' | 'description', value: string) => {
    setEcRules(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveEcRule = (index: number) => {
    setEcRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddReasoningTemplate = () => {
    setReasoningTemplate(prev => [...prev, '']);
  };

  const handleUpdateReasoningTemplate = (index: number, value: string) => {
    setReasoningTemplate(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleRemoveReasoningTemplate = (index: number) => {
    setReasoningTemplate(prev => prev.filter((_, i) => i !== index));
  };

  // Pool B and Pool C configuration helpers
  const handleAddPoolBEcRule = () => {
    setPoolBEcRules(prev => [...prev, { code: '', description: '' }]);
  };

  const handleUpdatePoolBEcRule = (index: number, field: 'code' | 'description', value: string) => {
    setPoolBEcRules(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemovePoolBEcRule = (index: number) => {
    setPoolBEcRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPoolBReasoningTemplate = () => {
    setPoolBReasoningTemplate(prev => [...prev, '']);
  };

  const handleUpdatePoolBReasoningTemplate = (index: number, value: string) => {
    setPoolBReasoningTemplate(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleRemovePoolBReasoningTemplate = (index: number) => {
    setPoolBReasoningTemplate(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPoolCQaRule = () => {
    setPoolCQaRules(prev => [...prev, { code: '', question: '', is_fatal_flaw: false, score_0_logic: '', score_05_logic: '', score_1_logic: '' }]);
  };

  const handleUpdatePoolCQaRule = (
    index: number,
    field: 'code' | 'question' | 'is_fatal_flaw' | 'score_0_logic' | 'score_05_logic' | 'score_1_logic',
    value: string | boolean
  ) => {
    setPoolCQaRules(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value } as any;
      return updated;
    });
  };

  const handleRemovePoolCQaRule = (index: number) => {
    setPoolCQaRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPoolCExtractionRule = () => {
    setPoolCExtractionRules(prev => [...prev, { json_key: '', question: '' }]);
  };

  const handleUpdatePoolCExtractionRule = (index: number, field: 'json_key' | 'question', value: string) => {
    setPoolCExtractionRules(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemovePoolCExtractionRule = (index: number) => {
    setPoolCExtractionRules(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setName('');
    setFolderName('');
    setManifesto('');
    setObjective('');
    setQuestions('');
    setQaDefinition('');
    setExclusionCriteria('');
    setPoolA('50');
    setPoolB('30');
    setPoolC('20');
    setGdriveDest('SLR_Magic/PDFs');
    setCloudProvider('gdrive');
    setRemoteName('');
    setPoolTags({ pool_a: [], pool_b: [], pool_c: [] });
    setEcRules([]);
    setReasoningTemplate([]);
    setPoolBEcRules([]);
    setPoolBReasoningTemplate([]);
    setPoolCQaRules([]);
    setPoolCExtractionRules([]);
  };

  const populateForm = (proj: any) => {
    setName(proj.name || '');
    setFolderName(proj.folder_name || '');
    setManifesto(proj.manifesto || '');
    setObjective(proj.objective || '');
    setQuestions(proj.questions || '');
    setQaDefinition(proj.qa_definition || '');
    setExclusionCriteria(proj.exclusion_criteria || '');
    setPoolA(proj.pool_a_size !== undefined ? String(proj.pool_a_size) : '50');
    setPoolB(proj.pool_b_size !== undefined ? String(proj.pool_b_size) : '30');
    setPoolC(proj.pool_c_size !== undefined ? String(proj.pool_c_size) : '20');
    setGdriveDest(proj.gdrive_dest_path || 'SLR_Magic/PDFs');
    setCloudProvider(proj.cloud_provider || 'gdrive');
    setRemoteName(proj.rclone_remote_name || '');
    
    let parsedTags = { pool_a: [] as any[], pool_b: [] as any[], pool_c: [] as any[] };
    if (proj.pool_tags) {
      try {
        parsedTags = typeof proj.pool_tags === 'string' ? JSON.parse(proj.pool_tags) : proj.pool_tags;
      } catch (e) {
        console.error("Error parsing pool tags", e);
      }
    }
    parsedTags.pool_a = parsedTags.pool_a || [];
    parsedTags.pool_b = parsedTags.pool_b || [];
    parsedTags.pool_c = parsedTags.pool_c || [];
    setPoolTags(parsedTags);

    let parsedBEcRules = [];
    if (proj.pool_b_ec_rules) {
      try {
        parsedBEcRules = typeof proj.pool_b_ec_rules === 'string' ? JSON.parse(proj.pool_b_ec_rules) : proj.pool_b_ec_rules;
      } catch (e) {
        console.error("Error parsing pool B ec rules", e);
      }
    }
    setPoolBEcRules(parsedBEcRules || []);

    let parsedEcRules = [];
    if (proj.ec_rules) {
      try {
        parsedEcRules = typeof proj.ec_rules === 'string' ? JSON.parse(proj.ec_rules) : proj.ec_rules;
      } catch (e) {
        console.error("Error parsing ec rules", e);
      }
    }
    setEcRules(parsedEcRules || []);

    let parsedBReasoning = [];
    if (proj.pool_b_reasoning_template) {
      try {
        parsedBReasoning = typeof proj.pool_b_reasoning_template === 'string' ? JSON.parse(proj.pool_b_reasoning_template) : proj.pool_b_reasoning_template;
      } catch (e) {
        console.error("Error parsing pool B reasoning templates", e);
      }
    }
    setPoolBReasoningTemplate(parsedBReasoning || []);

    let parsedReasoning = [];
    if (proj.reasoning_template) {
      try {
        parsedReasoning = typeof proj.reasoning_template === 'string' ? JSON.parse(proj.reasoning_template) : proj.reasoning_template;
      } catch (e) {
        console.error("Error parsing reasoning templates", e);
      }
    }
    setReasoningTemplate(parsedReasoning || []);

    let parsedCQaRules = [];
    if (proj.pool_c_qa_rules) {
      try {
        parsedCQaRules = typeof proj.pool_c_qa_rules === 'string' ? JSON.parse(proj.pool_c_qa_rules) : proj.pool_c_qa_rules;
      } catch (e) {
        console.error("Error parsing pool C QA rules", e);
      }
    }
    setPoolCQaRules(parsedCQaRules || []);

    let parsedCExtractionRules = [];
    if (proj.pool_c_extraction_rules) {
      try {
        parsedCExtractionRules = typeof proj.pool_c_extraction_rules === 'string' ? JSON.parse(proj.pool_c_extraction_rules) : proj.pool_c_extraction_rules;
      } catch (e) {
        console.error("Error parsing pool C extraction rules", e);
      }
    }
    setPoolCExtractionRules(parsedCExtractionRules || []);
  };

  return {
    populateForm,
    name, setName,
    folderName, setFolderName,
    manifesto, setManifesto,
    objective, setObjective,
    questions, setQuestions,
    qaDefinition, setQaDefinition,
    exclusionCriteria, setExclusionCriteria,
    poolA, setPoolA,
    poolB, setPoolB,
    poolC, setPoolC,
    gdriveDest, setGdriveDest,
    cloudProvider, setCloudProvider,
    remoteName, setRemoteName,
    poolTags, setPoolTags,
    ecRules, setEcRules,
    reasoningTemplate, setReasoningTemplate,
    poolBEcRules, setPoolBEcRules,
    poolBReasoningTemplate, setPoolBReasoningTemplate,
    poolCQaRules, setPoolCQaRules,
    poolCExtractionRules, setPoolCExtractionRules,
    projectBudgetLimit, setProjectBudgetLimit,
    projectTax, setProjectTax,
    resetForm,
    handleAddPoolTag, handleUpdatePoolTag, handleRemovePoolTag,
    handleAddEcRule, handleUpdateEcRule, handleRemoveEcRule,
    handleAddReasoningTemplate, handleUpdateReasoningTemplate, handleRemoveReasoningTemplate,
    handleAddPoolBEcRule, handleUpdatePoolBEcRule, handleRemovePoolBEcRule,
    handleAddPoolBReasoningTemplate, handleUpdatePoolBReasoningTemplate, handleRemovePoolBReasoningTemplate,
    handleAddPoolCQaRule, handleUpdatePoolCQaRule, handleRemovePoolCQaRule,
    handleAddPoolCExtractionRule, handleUpdatePoolCExtractionRule, handleRemovePoolCExtractionRule
  };
}
