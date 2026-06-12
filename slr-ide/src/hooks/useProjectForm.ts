import { useState, useEffect } from 'react';
import { Project } from '@/types';

export function useProjectForm(initialData?: Partial<Project>) {
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

  useEffect(() => {
    if (initialData) {
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
    }
  }, [initialData]);

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
  };

  return {
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
    resetForm
  };
}
