/**
 * Official Google Gemini Model Thinking Specifications Reference Table
 * Source: Google DeepMind / Google Gemini API Documentation
 */

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high' | 'none' | 'off';

export interface ModelThinkingSpec {
  modelId: string;
  defaultThinking: 'minimal' | 'medium' | 'high' | 'off' | 'on';
  levelsSupported: ('minimal' | 'low' | 'medium' | 'high')[];
}

export const GEMINI_MODEL_THINKING_SPECS: Record<string, ModelThinkingSpec> = {
  'gemini-3.7-flash': {
    modelId: 'gemini-3.7-flash',
    defaultThinking: 'medium',
    levelsSupported: ['low', 'medium', 'high']
  },
  'gemini-3.6-flash': {
    modelId: 'gemini-3.6-flash',
    defaultThinking: 'medium',
    levelsSupported: ['minimal', 'low', 'medium', 'high']
  },
  'gemini-3.5-flash-lite': {
    modelId: 'gemini-3.5-flash-lite',
    defaultThinking: 'minimal',
    levelsSupported: ['minimal', 'low', 'medium', 'high']
  },
  'gemini-3.1-pro-preview': {
    modelId: 'gemini-3.1-pro-preview',
    defaultThinking: 'high',
    levelsSupported: ['low', 'medium', 'high']
  },
  'gemini-3.1-flash-lite-image': {
    modelId: 'gemini-3.1-flash-lite-image',
    defaultThinking: 'minimal',
    levelsSupported: ['minimal', 'high']
  },
  'gemini-3-flash-preview': {
    modelId: 'gemini-3-flash-preview',
    defaultThinking: 'high',
    levelsSupported: ['minimal', 'low', 'medium', 'high']
  },
  'gemini-3-pro-preview': {
    modelId: 'gemini-3-pro-preview',
    defaultThinking: 'high',
    levelsSupported: ['low', 'high']
  },
  'gemini-3.5-flash': {
    modelId: 'gemini-3.5-flash',
    defaultThinking: 'medium',
    levelsSupported: ['minimal', 'low', 'medium', 'high']
  },
  'gemini-2.5-pro': {
    modelId: 'gemini-2.5-pro',
    defaultThinking: 'on',
    levelsSupported: ['low', 'medium', 'high']
  },
  'gemini-2.5-flash': {
    modelId: 'gemini-2.5-flash',
    defaultThinking: 'on',
    levelsSupported: ['low', 'medium', 'high']
  },
  'gemini-2.5-flash-lite': {
    modelId: 'gemini-2.5-flash-lite',
    defaultThinking: 'off',
    levelsSupported: ['low', 'medium', 'high']
  }
};

/**
 * Resolves the valid thinkingConfig payload for Gemini API generationConfig.
 * Strictly adheres to supported thinking levels per model to avoid invalid token budget errors.
 */
export function resolveGeminiThinkingConfig(modelId: string, thinkingLevel?: string): Record<string, any> {
  const cleanModel = (modelId || '').toLowerCase().replace(/^models\//, '');
  const level = (thinkingLevel || 'none').toLowerCase().trim();

  // If thinking is explicitly disabled or off
  if (level === 'none' || level === 'off') {
    return { thinkingBudget: 0 };
  }

  // Check against model spec
  const spec = GEMINI_MODEL_THINKING_SPECS[cleanModel];
  let targetLevel = level as 'minimal' | 'low' | 'medium' | 'high';

  if (spec) {
    if (!spec.levelsSupported.includes(targetLevel)) {
      // Fallback to model's default or closest supported level
      if (spec.defaultThinking !== 'off' && spec.defaultThinking !== 'on') {
        targetLevel = spec.defaultThinking as any;
      } else {
        targetLevel = spec.levelsSupported.includes('medium') 
          ? 'medium' 
          : spec.levelsSupported[0];
      }
    }
  }

  // For Gemini API (v1beta), thinkingConfig uses thinkingLevel for models that support it
  return {
    thinkingLevel: targetLevel
  };
}
