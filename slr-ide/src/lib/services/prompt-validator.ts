export type PromptType = 'fast_filter' | 'gatekeeper' | 'scientist' | 'miner' | 'umbrellanizer' | 'duplicate_review' | 'consolidation_audit' | 'prompt_optimizer';

export interface PromptTypeOption {
  id: PromptType;
  label: string;
  stageName: string;
}

export const PROMPT_TYPE_OPTIONS: PromptTypeOption[] = [
  { id: 'fast_filter', label: 'The Fast Filter', stageName: 'Stage 1: Fast Filter' },
  { id: 'gatekeeper', label: 'The Gatekeeper', stageName: 'Stage 2: Gatekeeper' },
  { id: 'scientist', label: 'The Scientist', stageName: 'Stage 3: Scientist' },
  { id: 'miner', label: 'The Miner', stageName: 'Stage 4: Miner' },
  { id: 'umbrellanizer', label: 'The Umbrellanizer', stageName: 'Stage 5: Umbrellanizer' },
  { id: 'duplicate_review', label: 'The Duplicate Specialist', stageName: 'Ingestion: Duplicate Review' },
  { id: 'consolidation_audit', label: 'The Consolidation Auditor', stageName: 'Pre-Calibration: Prompt Consolidation' },
  { id: 'prompt_optimizer', label: 'The Prompt Optimization Specialist', stageName: 'Pre-Calibration: Prompt Optimization Magic' },
];

export const DEFAULT_STAGE_SCHEMAS: Record<PromptType, object> = {
  fast_filter: {
    type: "object",
    properties: {
      logic_trace: {
        type: "object",
        properties: {
          gate_1_ec1_metadata: {
            type: "object",
            properties: {
              inner_gate_reasoning: { type: "string" },
              meets_gate_compliance: { type: "string", enum: ["YES", "NO", "SKIPPED"] },
              gate_status: { type: "string", enum: ["CLEAR", "TRIGGERED", "SKIPPED"] }
            },
            required: ["inner_gate_reasoning", "meets_gate_compliance", "gate_status"]
          },
          gate_1_ec2_domain: {
            type: "object",
            properties: {
              inner_gate_reasoning: { type: "string" },
              meets_gate_compliance: { type: "string", enum: ["YES", "NO", "SKIPPED"] },
              gate_status: { type: "string", enum: ["CLEAR", "TRIGGERED", "SKIPPED"] }
            },
            required: ["inner_gate_reasoning", "meets_gate_compliance", "gate_status"]
          },
          gate_1_ec3_non_predictive: {
            type: "object",
            properties: {
              inner_gate_reasoning: { type: "string" },
              meets_gate_compliance: { type: "string", enum: ["YES", "NO", "SKIPPED"] },
              gate_status: { type: "string", enum: ["CLEAR", "TRIGGERED", "SKIPPED"] }
            },
            required: ["inner_gate_reasoning", "meets_gate_compliance", "gate_status"]
          }
        },
        required: ["gate_1_ec1_metadata", "gate_1_ec2_domain", "gate_1_ec3_non_predictive"]
      },
      final_evaluation: {
        type: "object",
        properties: {
          decision: { type: "string", enum: ["INCLUDE", "EXCLUDE"] },
          exclusion_code: { type: "string", enum: ["EC-1", "EC-2", "EC-3", "NONE"] },
          reasoning: { type: "string" }
        },
        required: ["decision", "exclusion_code", "reasoning"]
      }
    },
    required: ["logic_trace", "final_evaluation"]
  },

  gatekeeper: {
    type: "object",
    properties: {
      logic_trace: {
        type: "object",
        properties: {
          gate_4_ec4_passive_system: {
            type: "object",
            properties: {
              inner_gate_reasoning: { type: "string" },
              meets_gate_compliance: { type: "string", enum: ["YES", "NO", "SKIPPED"] },
              gate_status: { type: "string", enum: ["CLEAR", "TRIGGERED", "SKIPPED"] }
            },
            required: ["inner_gate_reasoning", "meets_gate_compliance", "gate_status"]
          },
          gate_5_ec5_pure_simulation: {
            type: "object",
            properties: {
              inner_gate_reasoning: { type: "string" },
              meets_gate_compliance: { type: "string", enum: ["YES", "NO", "SKIPPED"] },
              gate_status: { type: "string", enum: ["CLEAR", "TRIGGERED", "SKIPPED"] }
            },
            required: ["inner_gate_reasoning", "meets_gate_compliance", "gate_status"]
          },
          gate_6_ec6_footprint_failure: {
            type: "object",
            properties: {
              inner_gate_reasoning: { type: "string" },
              meets_gate_compliance: { type: "string", enum: ["YES", "NO", "SKIPPED"] },
              gate_status: { type: "string", enum: ["CLEAR", "TRIGGERED", "SKIPPED"] }
            },
            required: ["inner_gate_reasoning", "meets_gate_compliance", "gate_status"]
          },
          gate_7_ec7_hardware_obfuscation: {
            type: "object",
            properties: {
              inner_gate_reasoning: { type: "string" },
              meets_gate_compliance: { type: "string", enum: ["YES", "NO", "SKIPPED"] },
              gate_status: { type: "string", enum: ["CLEAR", "TRIGGERED", "SKIPPED"] }
            },
            required: ["inner_gate_reasoning", "meets_gate_compliance", "gate_status"]
          },
          gate_8_ec8_fake_edge: {
            type: "object",
            properties: {
              inner_gate_reasoning: { type: "string" },
              meets_gate_compliance: { type: "string", enum: ["YES", "NO", "SKIPPED"] },
              gate_status: { type: "string", enum: ["CLEAR", "TRIGGERED", "SKIPPED"] }
            },
            required: ["inner_gate_reasoning", "meets_gate_compliance", "gate_status"]
          },
          gate_9_ec9_non_reproducible: {
            type: "object",
            properties: {
              inner_gate_reasoning: { type: "string" },
              meets_gate_compliance: { type: "string", enum: ["YES", "NO", "SKIPPED"] },
              gate_status: { type: "string", enum: ["CLEAR", "TRIGGERED", "SKIPPED"] }
            },
            required: ["inner_gate_reasoning", "meets_gate_compliance", "gate_status"]
          }
        },
        required: [
          "gate_4_ec4_passive_system",
          "gate_5_ec5_pure_simulation",
          "gate_6_ec6_footprint_failure",
          "gate_7_ec7_hardware_obfuscation",
          "gate_8_ec8_fake_edge",
          "gate_9_ec9_non_reproducible"
        ]
      },
      final_evaluation: {
        type: "object",
        properties: {
          decision: { type: "string", enum: ["INCLUDE", "EXCLUDE"] },
          exclusion_code: { type: "string", enum: ["EC-4", "EC-5", "EC-6", "EC-7", "EC-8", "EC-9", "NONE"] },
          reasoning: { type: "string" }
        },
        required: ["decision", "exclusion_code", "reasoning"]
      }
    },
    required: ["logic_trace", "final_evaluation"]
  },

  scientist: {
    type: "object",
    properties: {
      logic_trace: {
        type: "object",
        properties: {
          appraisal_reasoning: {
            type: "object",
            properties: {
              qa1_aims_analysis: { type: "string" },
              qa2_hardware_analysis: { type: "string" },
              qa3_validation_analysis: { type: "string" },
              qa4_footprint_analysis: { type: "string" },
              qa5_communication_analysis: { type: "string" },
              qa6_actuation_analysis: { type: "string" },
              qa7_barrier_analysis: { type: "string" },
              qa8_reusability_analysis: { type: "string" }
            },
            required: [
              "qa1_aims_analysis", "qa2_hardware_analysis", "qa3_validation_analysis", "qa4_footprint_analysis",
              "qa5_communication_analysis", "qa6_actuation_analysis", "qa7_barrier_analysis", "qa8_reusability_analysis"
            ]
          },
          gate_mathematics: {
            type: "object",
            properties: {
              summation_trace: { type: "string" },
              fatal_flaw_check: { type: "string" }
            },
            required: ["summation_trace", "fatal_flaw_check"]
          }
        },
        required: ["appraisal_reasoning", "gate_mathematics"]
      },
      qa_scores: {
        type: "object",
        properties: {
          qa1_aims: { type: "object", properties: { score: { type: "string" }, exact_quote: { type: "string" } }, required: ["score", "exact_quote"] },
          qa2_hardware: { type: "object", properties: { score: { type: "string" }, exact_quote: { type: "string" } }, required: ["score", "exact_quote"] },
          qa3_validation: { type: "object", properties: { score: { type: "string" }, exact_quote: { type: "string" } }, required: ["score", "exact_quote"] },
          qa4_footprint: { type: "object", properties: { score: { type: "string" }, exact_quote: { type: "string" } }, required: ["score", "exact_quote"] },
          qa5_communication: { type: "object", properties: { score: { type: "string" }, exact_quote: { type: "string" } }, required: ["score", "exact_quote"] },
          qa6_actuation: { type: "object", properties: { score: { type: "string" }, exact_quote: { type: "string" } }, required: ["score", "exact_quote"] },
          qa7_barriers: { type: "object", properties: { score: { type: "string" }, exact_quote: { type: "string" } }, required: ["score", "exact_quote"] },
          qa8_reusability: { type: "object", properties: { score: { type: "string" }, exact_quote: { type: "string" } }, required: ["score", "exact_quote"] }
        },
        required: [
          "qa1_aims", "qa2_hardware", "qa3_validation", "qa4_footprint",
          "qa5_communication", "qa6_actuation", "qa7_barriers", "qa8_reusability"
        ]
      },
      final_evaluation: {
        type: "object",
        properties: {
          decision: { type: "string", enum: ["INCLUDE", "EXCLUDE"] },
          exclusion_code: { type: "string" },
          reasoning: { type: "string" }
        },
        required: ["decision", "exclusion_code", "reasoning"]
      }
    },
    required: ["logic_trace", "qa_scores", "final_evaluation"]
  },

  miner: {
    type: "object",
    properties: {
      logic_trace: {
        type: "object",
        properties: {
          extraction_mapping: { type: "object" }
        },
        required: ["extraction_mapping"]
      },
      extracted_data: {
        type: "object",
        properties: {
          rq1a_resource_constraint_def: { type: "object", properties: { value: { type: "string" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq1b_boundary_envelope: { type: "object", properties: { value: { type: "array" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq2_operational_domains: { type: "object", properties: { value: { type: "string" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq3a_edge_hardware: { type: "object", properties: { value: { type: "array" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq3b_execution_footprint: { type: "object", properties: { value: { type: "array" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq4_computational_topologies: { type: "object", properties: { value: { type: "string" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq5_network_protocols: { type: "object", properties: { value: { type: "array" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq6_semantic_frameworks: { type: "object", properties: { value: { type: "string" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq7a_predictive_algorithms: { type: "object", properties: { value: { type: "array" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq7b_optimization_techniques: { type: "object", properties: { value: { type: "array" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq8a_autonomy_level: { type: "object", properties: { value: { type: "string" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq8b_control_paradigm: { type: "object", properties: { value: { type: "string" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq9_evaluation_metrics: { type: "object", properties: { value: { type: "array" }, evidence: { type: "string" } }, required: ["value", "evidence"] },
          rq10_lifecycle_barriers: { type: "object", properties: { value: { type: "array" }, evidence: { type: "string" } }, required: ["value", "evidence"] }
        },
        required: [
          "rq1a_resource_constraint_def", "rq1b_boundary_envelope", "rq2_operational_domains",
          "rq3a_edge_hardware", "rq3b_execution_footprint", "rq4_computational_topologies",
          "rq5_network_protocols", "rq6_semantic_frameworks", "rq7a_predictive_algorithms",
          "rq7b_optimization_techniques", "rq8a_autonomy_level", "rq8b_control_paradigm",
          "rq9_evaluation_metrics", "rq10_lifecycle_barriers"
        ]
      }
    },
    required: ["logic_trace", "extracted_data"]
  },

  umbrellanizer: {
    type: "object",
    properties: {
      taxonomy_mapping: {
        type: "array",
        items: {
          type: "object",
          properties: {
            raw_token: { type: "string" },
            umbrella_category: { type: "string" },
            justification: { type: "string" }
          },
          required: ["raw_token", "umbrella_category", "justification"]
        }
      }
    },
    required: ["taxonomy_mapping"]
  },

  duplicate_review: {
    type: "object",
    properties: {
      verdict: {
        type: "string",
        enum: [
          "CONFIRMED DUPLICATE",
          "STRUCTURAL OVERLAP",
          "COMPANION PAPERS",
          "FALSE FLAG"
        ]
      },
      primary_action: {
        type: "string"
      },
      technical_breakdown: {
        type: "object",
        properties: {
          mathematical_algorithmic_shift: { type: "string" },
          topology_scope_change: { type: "string" },
          data_implementation_footprint: { type: "string" }
        },
        required: [
          "mathematical_algorithmic_shift",
          "topology_scope_change",
          "data_implementation_footprint"
        ]
      },
      database_execution: {
        type: "object",
        properties: {
          recommended_primary_paper_id: { type: "string" },
          paper1_status: {
            type: "string",
            enum: ["PENDING", "EXCLUDED_DUPLICATE", "EXCLUDED_CONTAINER", "RETAINED_PRIMARY", "RETAINED_COMPANION", "RETAINED_DISTINCT"]
          },
          paper2_status: {
            type: "string",
            enum: ["PENDING", "EXCLUDED_DUPLICATE", "EXCLUDED_CONTAINER", "RETAINED_PRIMARY", "RETAINED_COMPANION", "RETAINED_DISTINCT"]
          },
          lineage_actions: { type: "string" }
        },
        required: [
          "recommended_primary_paper_id",
          "paper1_status",
          "paper2_status",
          "lineage_actions"
        ]
      }
    },
    required: [
      "verdict",
      "primary_action",
      "technical_breakdown",
      "database_execution"
    ]
  },

  consolidation_audit: {
    type: "object",
    properties: {
      availability_evaluation: {
        type: "object",
        properties: {
          fast_filter_ready: { type: "boolean" },
          gatekeeper_ready: { type: "boolean" },
          scientist_ready: { type: "boolean" },
          miner_ready: { type: "boolean" },
          available_count: { type: "integer" },
          notes: { type: "string" }
        },
        required: ["fast_filter_ready", "gatekeeper_ready", "scientist_ready", "miner_ready", "available_count", "notes"]
      },
      semantic_alignment_evaluation: {
        type: "object",
        properties: {
          fast_filter_alignment: { type: "object", properties: { score: { type: "number" }, pass: { type: "boolean" }, analysis: { type: "string" }, gaps: { type: "array", items: { type: "string" } } }, required: ["score", "pass", "analysis", "gaps"] },
          gatekeeper_alignment: { type: "object", properties: { score: { type: "number" }, pass: { type: "boolean" }, analysis: { type: "string" }, gaps: { type: "array", items: { type: "string" } } }, required: ["score", "pass", "analysis", "gaps"] },
          scientist_alignment: { type: "object", properties: { score: { type: "number" }, pass: { type: "boolean" }, analysis: { type: "string" }, gaps: { type: "array", items: { type: "string" } } }, required: ["score", "pass", "analysis", "gaps"] },
          miner_alignment: { type: "object", properties: { score: { type: "number" }, pass: { type: "boolean" }, analysis: { type: "string" }, gaps: { type: "array", items: { type: "string" } } }, required: ["score", "pass", "analysis", "gaps"] },
          overall_semantic_pass: { type: "boolean" },
          semantic_passed_count: { type: "integer" }
        },
        required: ["fast_filter_alignment", "gatekeeper_alignment", "scientist_alignment", "miner_alignment", "overall_semantic_pass", "semantic_passed_count"]
      },
      chainability_and_consistency: {
        type: "object",
        properties: {
          s1_to_s2_chainable: { type: "boolean" },
          s2_to_s3_chainable: { type: "boolean" },
          s3_to_s4_chainable: { type: "boolean" },
          exclusion_code_orthogonality: { type: "boolean" },
          schema_data_flow_integrity: { type: "boolean" },
          chainability_passed_count: { type: "integer" },
          contradictions_or_overlaps: { type: "array", items: { type: "string" } },
          overall_chainability_pass: { type: "boolean" }
        },
        required: ["s1_to_s2_chainable", "s2_to_s3_chainable", "s3_to_s4_chainable", "exclusion_code_orthogonality", "schema_data_flow_integrity", "chainability_passed_count", "contradictions_or_overlaps", "overall_chainability_pass"]
      },
      actionable_recommendations: {
        type: "array",
        items: { type: "string" }
      },
      overall_status: {
        type: "string",
        enum: ["PASSED", "WARNING", "FAILED"]
      }
    },
    required: [
      "availability_evaluation",
      "semantic_alignment_evaluation",
      "chainability_and_consistency",
      "actionable_recommendations",
      "overall_status"
    ]
  },

  prompt_optimizer: {
    type: "object",
    properties: {
      failure_diagnosis: {
        type: "object",
        properties: {
          root_causes: { type: "array", items: { type: "string" } },
          false_negative_analysis: { type: "string" },
          false_positive_analysis: { type: "string" },
          edge_case_traps_identified: { type: "array", items: { type: "string" } },
          cross_stage_boundary_check: { type: "string" }
        },
        required: ["root_causes", "false_negative_analysis", "false_positive_analysis", "edge_case_traps_identified", "cross_stage_boundary_check"]
      },
      needs_full_text: {
        type: "array",
        items: {
          type: "object",
          properties: {
            paper_id: { type: "string" },
            paper_title: { type: "string" },
            technical_rationale: { type: "string" },
            target_sections: { type: "string" }
          },
          required: ["paper_id", "paper_title", "technical_rationale", "target_sections"]
        }
      },
      optimization_strategy: {
        type: "string"
      },
      proposed_system_instruction: {
        type: "string"
      },
      proposed_user_template: {
        type: "string"
      },
      diff_explanation: {
        type: "string"
      },
      key_modifications: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: [
      "failure_diagnosis",
      "needs_full_text",
      "optimization_strategy",
      "proposed_system_instruction",
      "proposed_user_template",
      "diff_explanation",
      "key_modifications"
    ]
  }
};

export interface SchemaValidationResult {
  isValid: boolean;
  error: string | null;
}

export function validatePromptSchema(promptType: PromptType | string | null | undefined, schemaStr: string | null | undefined): SchemaValidationResult {
  if (!schemaStr || !schemaStr.trim()) {
    return { isValid: false, error: "JSON Schema is required." };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(schemaStr);
  } catch (e: any) {
    return { isValid: false, error: `Invalid JSON syntax: ${e.message}` };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { isValid: false, error: "JSON Schema must be a JSON object." };
  }

  const topType = (parsed.type || parsed.TYPE || '').toString().toUpperCase();
  if (topType !== 'OBJECT' && topType !== 'ARRAY') {
    return { isValid: false, error: "JSON Schema top-level type must be 'object' (or 'OBJECT')." };
  }

  if (!promptType) {
    // Basic structural check if no type specified
    return { isValid: true, error: null };
  }

  const typeKey = promptType as PromptType;
  const props = parsed.properties || {};

  switch (typeKey as string) {
    case 'fast_filter':
    case 'gatekeeper':
    case 'screening':
    case 'fulltext': {
      if (!props.logic_trace) {
        return { isValid: false, error: `[${typeKey}] JSON Schema missing required top-level property 'logic_trace'.` };
      }
      if (!props.final_evaluation) {
        return { isValid: false, error: `[${typeKey}] JSON Schema missing required top-level property 'final_evaluation'.` };
      }
      const finalEvalProps = props.final_evaluation.properties || {};
      const requiredFinal = ['decision', 'exclusion_code', 'reasoning'];
      for (const key of requiredFinal) {
        if (!finalEvalProps[key]) {
          return { isValid: false, error: `[${typeKey}] 'final_evaluation' missing required field '${key}'.` };
        }
      }
      break;
    }

    case 'scientist': {
      if (!props.logic_trace) {
        return { isValid: false, error: "[scientist] JSON Schema missing required top-level property 'logic_trace'." };
      }
      if (!props.qa_scores) {
        return { isValid: false, error: "[scientist] JSON Schema missing required top-level property 'qa_scores'." };
      }
      if (!props.final_evaluation) {
        return { isValid: false, error: "[scientist] JSON Schema missing required top-level property 'final_evaluation'." };
      }
      const finalEvalProps = props.final_evaluation.properties || {};
      for (const key of ['decision', 'exclusion_code', 'reasoning']) {
        if (!finalEvalProps[key]) {
          return { isValid: false, error: `[scientist] 'final_evaluation' missing required field '${key}'.` };
        }
      }
      const qaProps = props.qa_scores.properties || {};
      const requiredQAs = ['qa1_aims', 'qa2_hardware', 'qa3_validation', 'qa4_footprint', 'qa5_communication', 'qa6_actuation', 'qa7_barriers', 'qa8_reusability'];
      for (const qaKey of requiredQAs) {
        if (!qaProps[qaKey]) {
          return { isValid: false, error: `[scientist] 'qa_scores' missing required appraisal score key '${qaKey}'.` };
        }
      }
      break;
    }

    case 'miner':
    case 'extraction': {
      if (!props.logic_trace) {
        return { isValid: false, error: "[miner] JSON Schema missing required top-level property 'logic_trace'." };
      }
      if (!props.extracted_data) {
        return { isValid: false, error: "[miner] JSON Schema missing required top-level property 'extracted_data'." };
      }
      break;
    }

    case 'umbrellanizer': {
      if (!props.taxonomy_mapping) {
        return { isValid: false, error: "[umbrellanizer] JSON Schema missing required top-level property 'taxonomy_mapping'." };
      }
      break;
    }

    case 'duplicate_review': {
      if (!props.verdict) {
        return { isValid: false, error: "[duplicate_review] JSON Schema missing required top-level property 'verdict'." };
      }
      if (!props.primary_action) {
        return { isValid: false, error: "[duplicate_review] JSON Schema missing required top-level property 'primary_action'." };
      }
      if (!props.technical_breakdown) {
        return { isValid: false, error: "[duplicate_review] JSON Schema missing required top-level property 'technical_breakdown'." };
      }
      if (!props.database_execution) {
        return { isValid: false, error: "[duplicate_review] JSON Schema missing required top-level property 'database_execution'." };
      }
      const techProps = props.technical_breakdown.properties || {};
      for (const k of ['mathematical_algorithmic_shift', 'topology_scope_change', 'data_implementation_footprint']) {
        if (!techProps[k]) {
          return { isValid: false, error: `[duplicate_review] 'technical_breakdown' missing required field '${k}'.` };
        }
      }
      const dbProps = props.database_execution.properties || {};
      for (const k of ['recommended_primary_paper_id', 'paper1_status', 'paper2_status', 'lineage_actions']) {
        if (!dbProps[k]) {
          return { isValid: false, error: `[duplicate_review] 'database_execution' missing required field '${k}'.` };
        }
      }
      break;
    }

    case 'consolidation_audit': {
      if (!props.availability_evaluation) {
        return { isValid: false, error: "[consolidation_audit] JSON Schema missing required top-level property 'availability_evaluation'." };
      }
      if (!props.semantic_alignment_evaluation) {
        return { isValid: false, error: "[consolidation_audit] JSON Schema missing required top-level property 'semantic_alignment_evaluation'." };
      }
      if (!props.chainability_and_consistency) {
        return { isValid: false, error: "[consolidation_audit] JSON Schema missing required top-level property 'chainability_and_consistency'." };
      }
      if (!props.actionable_recommendations) {
        return { isValid: false, error: "[consolidation_audit] JSON Schema missing required top-level property 'actionable_recommendations'." };
      }
      if (!props.overall_status) {
        return { isValid: false, error: "[consolidation_audit] JSON Schema missing required top-level property 'overall_status'." };
      }
      break;
    }

    case 'prompt_optimizer': {
      if (!props.failure_diagnosis) {
        return { isValid: false, error: "[prompt_optimizer] JSON Schema missing required top-level property 'failure_diagnosis'." };
      }
      if (!props.needs_full_text) {
        return { isValid: false, error: "[prompt_optimizer] JSON Schema missing required top-level property 'needs_full_text'." };
      }
      if (!props.proposed_system_instruction) {
        return { isValid: false, error: "[prompt_optimizer] JSON Schema missing required top-level property 'proposed_system_instruction'." };
      }
      if (!props.proposed_user_template) {
        return { isValid: false, error: "[prompt_optimizer] JSON Schema missing required top-level property 'proposed_user_template'." };
      }
      if (!props.diff_explanation) {
        return { isValid: false, error: "[prompt_optimizer] JSON Schema missing required top-level property 'diff_explanation'." };
      }
      break;
    }

    default:
      break;
  }

  return { isValid: true, error: null };
}
