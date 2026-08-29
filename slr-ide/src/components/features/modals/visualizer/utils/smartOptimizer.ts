import type { SlotConfig, ChartType } from '../types';
import { getMappedFieldValue } from './dataExtractor';

export interface SmartOptimizationOptions {
  aspectRatio?: string;
  isSingleMode?: boolean;
  activeSlotIndex?: number;
  umbrellanizerMap?: Record<string, Record<string, string>>;
}

/**
 * Intelligently analyzes dataset characteristics and returns an optimized SlotConfig
 * tuned for publication-grade rendering (IEEE / ACM / Elsevier standard).
 */
export function optimizeSlotConfig(
  currentConfig: SlotConfig,
  papers: any[],
  options: SmartOptimizationOptions = {}
): SlotConfig {
  const { umbrellanizerMap = {} } = options;
  const config: SlotConfig = { ...currentConfig };
  const { chartType, primaryField, secondaryField, sankeyFields } = config;

  if (!papers || papers.length === 0) {
    return config;
  }

  const mappedOpts = {
    useUmbrellanizer: config.useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues: config.splitMultiValues,
    excludeEmpty: config.excludeEmpty,
    customCategoryMap: config.customCategoryMap,
    levelCustomGroupLinks: config.levelCustomGroupLinks,
    sankeyFields,
    primaryField
  };

  // 1. Extract and analyze primary field categories
  const categoryCounts = new Map<string, number>();
  let totalExtractedTags = 0;
  let maxLabelLength = 0;

  papers.forEach(p => {
    const vals = getMappedFieldValue(p, primaryField, mappedOpts);
    vals.forEach(v => {
      totalExtractedTags++;
      categoryCounts.set(v, (categoryCounts.get(v) || 0) + 1);
      if (v.length > maxLabelLength) {
        maxLabelLength = v.length;
      }
    });
  });

  const uniqueCategoryCount = categoryCounts.size;
  const sortedEntries = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
  const highestCount = sortedEntries[0]?.[1] || 0;
  const dominanceRatio = totalExtractedTags > 0 ? highestCount / totalExtractedTags : 0;

  // 2. Chart-Specific Intelligent Tuning
  switch (chartType) {
    case 'pie_donut': {
      config.donutRatio = 48;
      config.showLegend = true;
      config.pieLeaderLineLength = 12;
      config.pieLeaderLineLength2 = 14;
      config.pieLabelDistance = 6;
      config.pieLineHeight = 15;

      // Intelligent Legend Typography & Width
      if (maxLabelLength > 25) {
        config.legendWidth = 220;
        config.legendLineHeight = 15;
        config.legendItemGap = 12;
        config.legendOverflow = 'break';
      } else if (maxLabelLength > 15) {
        config.legendWidth = 180;
        config.legendLineHeight = 14;
        config.legendItemGap = 10;
        config.legendOverflow = 'break';
      } else {
        config.legendWidth = 150;
        config.legendLineHeight = 14;
        config.legendItemGap = 10;
        config.legendOverflow = 'break';
      }

      if (uniqueCategoryCount <= 5) {
        config.legendPosition = 'right';
        config.legendFormat = 'name_count_percent';
        // If one slice heavily dominates (>65%), use inside labels or clean edge aligned
        if (dominanceRatio > 0.65) {
          config.pieLabelPlacement = 'inside';
          config.pieRadiusRatio = 70;
        } else if (maxLabelLength > 20) {
          config.pieLabelPlacement = 'inside';
          config.pieRadiusRatio = 68;
        } else {
          config.pieLabelPlacement = 'outside';
          config.pieRadiusRatio = 64;
          config.pieLabelWidth = 140;
        }
      } else if (uniqueCategoryCount > 8) {
        config.limitCategories = true;
        config.maxCategoriesCount = 7;
        config.legendPosition = 'right';
        config.legendFormat = 'name_count_percent';
        config.pieLabelPlacement = 'inside';
        config.pieRadiusRatio = 68;
      } else {
        config.legendPosition = 'right';
        config.legendFormat = 'name_count_percent';
        config.pieLabelPlacement = 'inside';
        config.pieRadiusRatio = 66;
      }
      break;
    }

    case 'bar_horizontal': {
      config.barSorting = 'desc';
      config.showDataLabels = true;
      config.barLabelFormat = 'value_pct';
      config.barBorderRadius = 4;

      // Adjust Y-axis width & overflow according to max category text length
      if (maxLabelLength > 30) {
        config.barYAxisWidth = 180;
        config.barYAxisOverflow = 'break';
        config.barLineHeight = 13;
        config.barYAxisFontSize = 10;
      } else if (maxLabelLength > 18) {
        config.barYAxisWidth = 150;
        config.barYAxisOverflow = 'break';
        config.barLineHeight = 14;
        config.barYAxisFontSize = 11;
      } else {
        config.barYAxisWidth = 120;
        config.barYAxisOverflow = 'none';
        config.barYAxisFontSize = 11;
      }

      // Bar thickness scaling based on count of items
      if (uniqueCategoryCount <= 5) {
        config.barThickness = 28;
        config.barGap = 20;
      } else if (uniqueCategoryCount <= 10) {
        config.barThickness = 22;
        config.barGap = 16;
      } else {
        config.barThickness = 16;
        config.barGap = 12;
      }

      if (uniqueCategoryCount > 15 && !config.limitCategories) {
        config.limitCategories = true;
        config.maxCategoriesCount = 12;
      }
      break;
    }

    case 'bar_vertical': {
      config.barSorting = 'desc';
      config.showDataLabels = true;
      config.barBorderRadius = 4;

      // Rotate X-axis labels if text is long or many categories
      if (maxLabelLength > 14 || uniqueCategoryCount > 7) {
        config.labelRotation = 30;
      } else if (maxLabelLength > 20 || uniqueCategoryCount > 12) {
        config.labelRotation = 45;
      } else {
        config.labelRotation = 0;
      }

      if (uniqueCategoryCount > 15 && !config.limitCategories) {
        config.limitCategories = true;
        config.maxCategoriesCount = 12;
      }
      break;
    }

    case 'clustered_bar': {
      config.barSorting = 'desc';
      config.showDataLabels = true;
      config.barLabelFormat = 'value_pct';
      config.barClusterGap = 20;
      config.barInnerGap = 15;
      config.showLegend = true;
      config.barLegendPosition = 'bottom-center';
      config.barLegendFormat = 'name_count';

      if (config.barOrientation === 'horizontal') {
        config.barYAxisWidth = maxLabelLength > 20 ? 160 : 130;
        config.barYAxisOverflow = 'break';
      } else {
        config.labelRotation = maxLabelLength > 12 ? 30 : 0;
      }
      break;
    }

    case 'stacked_bar': {
      config.showDataLabels = uniqueCategoryCount <= 8;
      config.showLegend = true;
      config.labelRotation = maxLabelLength > 12 ? 30 : 0;
      break;
    }

    case 'line': {
      config.smoothLine = true;
      config.showDataLabels = uniqueCategoryCount <= 12;
      config.labelRotation = maxLabelLength > 8 ? 30 : 0;
      break;
    }

    case 'sankey': {
      config.sankeyNodeWidth = 18;
      config.sankeyNodeGap = 16;
      config.sankeyLeftPadding = 6;
      config.sankeyRightPadding = 18;
      break;
    }

    case 'sunburst': {
      config.showLegend = true;
      config.sunburstLegendLevel = 0;
      config.sunburstLegendFormat = 'name_count_percent';
      config.sunburstLegendPosition = 'bottom-center';
      config.sunburstSort = 'desc';
      break;
    }

    case 'treemap': {
      config.showLegend = false;
      break;
    }

    case 'heatmap': {
      config.showDataLabels = true;
      config.labelRotation = maxLabelLength > 10 ? 30 : 0;
      break;
    }

    case 'scatter':
    case 'bubble': {
      const count = papers.length;
      if (count > 50) {
        config.bubbleScale = 0.8;
      } else if (count < 15) {
        config.bubbleScale = 1.6;
      } else {
        config.bubbleScale = 1.2;
      }
      break;
    }

    default:
      break;
  }

  return config;
}
