'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Download, BarChart2, PieChart, TrendingUp, ScatterChart, Grid, Layers, Sliders, RefreshCw, Sparkles, FileText, Check, Palette, ArrowRight, ArrowLeft, ChevronDown, Info, Settings2, Target, Filter, Share2, Gauge, Calendar, AlertTriangle } from 'lucide-react';
import * as echarts from 'echarts';

export type ChartType = 
  | 'bar_vertical'
  | 'bar_horizontal'
  | 'stacked_bar'
  | 'line'
  | 'pie_donut'
  | 'scatter'
  | 'bubble'
  | 'treemap'
  | 'heatmap'
  | 'sankey'
  | 'radar'
  | 'funnel'
  | 'boxplot'
  | 'sunburst'
  | 'graph'
  | 'gauge'
  | 'calendar';

export type ThemePreset = 
  | 'academic_grayscale'
  | 'ieee_blue'
  | 'nature_emerald'
  | 'science_contrast'
  | 'dark_modern'
  | 'slr_light';

interface VisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  papers: any[];
  totalUnfilteredCount?: number;
  isFiltered?: boolean;
  umbrellanizerMap?: Record<string, Record<string, string>>;
}

const CHART_TYPES_INFO: Record<ChartType, { name: string; category: string; description: string; slrUseCase: string; icon: any }> = {
  bar_vertical: {
    name: 'Vertical Bar Chart',
    category: 'Categorical Count',
    description: 'Compares paper counts across discrete categories using vertical columns.',
    slrUseCase: 'Ideal for showing publication distributions by Year, Study Type, or Publisher.',
    icon: BarChart2
  },
  bar_horizontal: {
    name: 'Horizontal Bar Chart',
    category: 'Categorical Count',
    description: 'Compares paper counts horizontally, giving ample space for long labels.',
    slrUseCase: 'Best for long extraction strings like specific Research Methods or Intervention types.',
    icon: BarChart2
  },
  stacked_bar: {
    name: 'Stacked Bar Chart',
    category: '2D Distribution',
    description: 'Shows total category counts broken down by a secondary sub-category.',
    slrUseCase: 'Great for plotting publication trends by Year stacked by Study Design or Quality Tier.',
    icon: Layers
  },
  line: {
    name: 'Line / Area Chart',
    category: 'Timeseries / Trend',
    description: 'Displays cumulative or annual trends over an ordered sequence.',
    slrUseCase: 'Standard figure for scientific literature growth rate over publication years.',
    icon: TrendingUp
  },
  pie_donut: {
    name: 'Pie & Donut Chart',
    category: 'Proportions',
    description: 'Visualizes proportional shares of a total cohort with optional inner cutout.',
    slrUseCase: 'Useful for breakdown of PDF acquisition status, study locations, or primary databases.',
    icon: PieChart
  },
  scatter: {
    name: 'Scatter Plot',
    category: 'Correlation',
    description: 'Plots individual papers on two continuous numerical axes.',
    slrUseCase: 'Examines correlation between Overall QA Score vs. Citation Count.',
    icon: ScatterChart
  },
  bubble: {
    name: 'Bubble Chart',
    category: '3D Correlation',
    description: 'Plots papers on X & Y numerical axes with bubble size representing a third metric.',
    slrUseCase: 'Multi-dimensional analysis: Publication Year (X) vs. Citations (Y) vs. QA Score (Size).',
    icon: Sparkles
  },
  treemap: {
    name: 'Treemap',
    category: 'Hierarchical',
    description: 'Displays nested rectangular tiles proportional to study group sizes.',
    slrUseCase: 'Nests broad study domains into sub-categories (e.g. Domain -> Specific Method).',
    icon: Grid
  },
  heatmap: {
    name: 'Heatmap Matrix',
    category: 'Co-occurrence',
    description: 'Cross-tabulation matrix highlighting co-occurrence frequency with color intensity.',
    slrUseCase: 'Cross-analyzes Intervention types vs. Clinical Outcomes in the review cohort.',
    icon: Sliders
  },
  sankey: {
    name: 'Sankey Flow Diagram',
    category: 'Sequential Workflow',
    description: 'Visualizes flow quantities between consecutive pipeline nodes or categories.',
    slrUseCase: 'Maps cohort flow from Ingestion Source -> PDF Acquisition -> Inclusion Stage.',
    icon: RefreshCw
  },
  radar: {
    name: 'Radar / Spider Chart',
    category: 'Multi-Dimensional QA',
    description: 'Compares multiple quality assessment criteria scores simultaneously across groups.',
    slrUseCase: 'Ideal for plotting average scores across QA dimensions (QA1 to QA8) per publisher or year.',
    icon: Target
  },
  funnel: {
    name: 'Funnel Chart',
    category: 'Screening Attrition',
    description: 'Visualizes progressive stage-by-stage screening yield and attrition values.',
    slrUseCase: 'Great for displaying paper counts moving from Ingestion -> Fast Filter -> Final Cohort.',
    icon: Filter
  },
  boxplot: {
    name: 'Boxplot Chart',
    category: 'Statistical Dispersion',
    description: 'Displays the 5-number summary (Min, Q1, Median, Q3, Max) for continuous metrics.',
    slrUseCase: 'Examines citation count or QA score dispersion across publication years or study designs.',
    icon: Sliders
  },
  sunburst: {
    name: 'Sunburst Ring Chart',
    category: 'Hierarchical Proportions',
    description: 'Renders nested multi-level ring sectors proportional to subgroup sizes.',
    slrUseCase: 'Visualizes multi-level taxonomy breakdowns (e.g. Domain -> Intervention -> Specific Method).',
    icon: Sparkles
  },
  graph: {
    name: 'Graph Network Diagram',
    category: 'Co-occurrence Network',
    description: 'Maps relations and co-occurrences between categorical nodes using connected edges.',
    slrUseCase: 'Displays connections between Import Sources and Publishers or Extraction Domains.',
    icon: Share2
  },
  gauge: {
    name: 'Gauge KPI Dial',
    category: 'Overall KPI Score',
    description: 'Displays a single dial score representing cohort performance or completeness percentage.',
    slrUseCase: 'Highlights overall cohort Average QA Score or PDF Acquisition Rate on a target dial.',
    icon: Gauge
  },
  calendar: {
    name: 'Calendar Heatmap',
    category: 'Ingestion Activity',
    description: 'Visualizes daily paper addition activity over calendar dates.',
    slrUseCase: 'Tracks review throughput and paper ingestion dates across calendar months.',
    icon: Calendar
  }
};

const THEME_PALETTES: Record<ThemePreset, { name: string; colors: string[]; bg: string; text: string; subtext: string; border: string }> = {
  academic_grayscale: {
    name: 'Academic Grayscale (Print Ready)',
    colors: ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#27272a'],
    bg: '#ffffff',
    text: '#09090b',
    subtext: '#52525b',
    border: '#e4e4e7'
  },
  ieee_blue: {
    name: 'IEEE / ACM Slate Blue',
    colors: ['#0f172a', '#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
    bg: '#ffffff',
    text: '#0f172a',
    subtext: '#475569',
    border: '#cbd5e1'
  },
  nature_emerald: {
    name: 'Nature / BioMed Emerald',
    colors: ['#064e3b', '#047857', '#10b981', '#34d399', '#0284c7', '#0369a1'],
    bg: '#ffffff',
    text: '#022c22',
    subtext: '#047857',
    border: '#a7f3d0'
  },
  science_contrast: {
    name: 'Science High-Contrast',
    colors: ['#b91c1c', '#1d4ed8', '#047857', '#d97706', '#6b21a8', '#0891b2'],
    bg: '#ffffff',
    text: '#111827',
    subtext: '#4b5563',
    border: '#e5e7eb'
  },
  dark_modern: {
    name: 'SLR IDE Dark Mode',
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    bg: '#090d16',
    text: '#f8fafc',
    subtext: '#94a3b8',
    border: '#1e293b'
  },
  slr_light: {
    name: 'SLR IDE Light Mode',
    colors: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    bg: '#f8fafc',
    text: '#0f172a',
    subtext: '#64748b',
    border: '#e2e8f0'
  }
};

export default function VisualizerModal({
  isOpen,
  onClose,
  papers,
  totalUnfilteredCount,
  isFiltered,
  umbrellanizerMap = {}
}: VisualizerModalProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  // Wizard Step State: 1 = Select Type, 2 = Map Data, 3 = Customize Style, 4 = Visualize & Export
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 State: Chart Type
  const [chartType, setChartType] = useState<ChartType>('bar_vertical');

  // Step 2 State: Data Mapping Parameters
  const [primaryField, setPrimaryField] = useState<string>('Year');
  const [secondaryField, setSecondaryField] = useState<string>('Import_Source');
  const [metricMode, setMetricMode] = useState<'count' | 'avg_citation' | 'avg_qa'>('count');
  
  // Dynamic Multi-Level Flow Fields (for Sankey and Sunburst)
  const [sankeyFields, setSankeyFields] = useState<string[]>(['Year', 'Import_Source', 'Local_PDF_Status']);
  const [sankeyLabelPositions, setSankeyLabelPositions] = useState<Record<number, 'left' | 'right'>>({});
  const [sankeyMaxNodes, setSankeyMaxNodes] = useState<Record<number, number>>({});

  // Data Limiting Parameters
  const [limitCategories, setLimitCategories] = useState<boolean>(false);
  const [maxCategoriesCount, setMaxCategoriesCount] = useState<number>(10);

  // Numerical Field Selectors (for Scatter, Bubble, Boxplot)
  const [numFieldX, setNumFieldX] = useState<string>('Overall_QA');
  const [numFieldY, setNumFieldY] = useState<string>('citation_count');
  const [numFieldSize, setNumFieldSize] = useState<string>('Year');

  // Cell Value Options
  const [useUmbrellanizer, setUseUmbrellanizer] = useState<boolean>(true);
  const [splitMultiValues, setSplitMultiValues] = useState<boolean>(true);
  const [excludeEmpty, setExcludeEmpty] = useState<boolean>(true);

  // Step 3 State: Style Customization
  const [chartTitle, setChartTitle] = useState<string>('Cohort Distribution');
  const [chartSubtitle, setChartSubtitle] = useState<string>('Systematic Literature Review Paper Analysis');
  const [themePreset, setThemePreset] = useState<ThemePreset>('ieee_blue');
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans-serif'>('serif');
  const [fontSize, setFontSize] = useState<number>(13);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [legendPosition, setLegendPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [showDataLabels, setShowDataLabels] = useState<boolean>(true);
  const [labelRotation, setLabelRotation] = useState<number>(0);

  // Type-Specific Options
  const [donutRatio, setDonutRatio] = useState<number>(50); // Pie
  const [smoothLine, setSmoothLine] = useState<boolean>(true); // Line
  const [sankeyNodeWidth, setSankeyNodeWidth] = useState<number>(20); // Sankey
  const [sankeyNodeGap, setSankeyNodeGap] = useState<number>(18); // Sankey
  const [sankeyLeftPadding, setSankeyLeftPadding] = useState<number>(8); // Sankey left edge %
  const [sankeyRightPadding, setSankeyRightPadding] = useState<number>(20); // Sankey right edge %
  const [bubbleScale, setBubbleScale] = useState<number>(1.2); // Bubble/Scatter
  const [gaugeMaxScale, setGaugeMaxScale] = useState<number>(100); // Gauge dial max target

  // Step 4 State: Export Settings
  const [exportFormat, setExportFormat] = useState<'png' | 'svg'>('png');
  const [exportScale, setExportScale] = useState<number>(3);

  // Available data fields
  const availableFields = useMemo(() => {
    const fieldsSet = new Set<string>([
      'Paper_ID',
      'Title',
      'Authors',
      'Year',
      'DOI',
      'Import_Source',
      'Local_PDF_Status',
      'Publisher',
      'citation_count',
      'Overall_QA'
    ]);

    papers.forEach(p => {
      if (p.manual_extracted_data || p.ai_extracted_data) {
        try {
          const str = (p.manual_stage || 0) >= (p.ai_stage || 0)
            ? (p.manual_extracted_data || p.ai_extracted_data)
            : (p.ai_extracted_data || p.manual_extracted_data);
          const parsed = typeof str === 'string' ? JSON.parse(str) : str;
          const extObj = parsed.extracted_data || parsed;
          Object.keys(extObj).forEach(k => {
            if (!k.startsWith('_') && k !== 'logic_trace' && k !== '_scientist_logic_trace') {
              fieldsSet.add(`ext:${k}`);
            }
          });
        } catch (e) {}
      }
    });

    return Array.from(fieldsSet).sort();
  }, [papers]);

  // Numerical Fields specifically for Scatter, Bubble, Boxplot
  const numericalFields = useMemo(() => {
    return ['Overall_QA', 'citation_count', 'Year'];
  }, []);

  // Resolve Umbrellanizer taxonomy mapping
  const resolveValue = useCallback((val: any, key: string) => {
    if (val === undefined || val === null || val === '') return '';
    const rawVal = String(val).trim();
    if (!useUmbrellanizer) return rawVal;

    const raw = rawVal.toLowerCase().replace(/\s+/g, ' ');
    const map = umbrellanizerMap[key] || {};
    const matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === raw);
    if (!matchedKey) return rawVal;

    const mappedVal = map[matchedKey] as any;
    if (!mappedVal) return rawVal;

    if (typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
      return String(mappedVal.umbrella_category || matchedKey).trim();
    }
    if (Array.isArray(mappedVal)) {
      return String(mappedVal[0] || matchedKey).trim();
    }
    return String(mappedVal).trim();
  }, [useUmbrellanizer, umbrellanizerMap]);

  // Helper to extract field values from paper
  const getFieldValue = useCallback((paper: any, fieldKey: string): string[] => {
    if (!fieldKey) return [];

    if (fieldKey.startsWith('ext:')) {
      const realKey = fieldKey.substring(4);
      const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
      const extStr = isManualDominant 
        ? (paper.manual_extracted_data || paper.ai_extracted_data || '') 
        : (paper.ai_extracted_data || paper.manual_extracted_data || '');

      if (!extStr) return excludeEmpty ? [] : ['Unspecified'];
      try {
        const parsed = JSON.parse(extStr);
        const extObj = parsed.extracted_data || parsed;
        let rawVal = extObj[realKey];
        if (rawVal && typeof rawVal === 'object' && 'value' in rawVal) {
          rawVal = rawVal.value;
        }

        if (rawVal === undefined || rawVal === null || rawVal === '') {
          return excludeEmpty ? [] : ['Unspecified'];
        }

        if (Array.isArray(rawVal)) {
          if (splitMultiValues) {
            const resolvedList = rawVal.map(v => resolveValue(v, realKey)).filter(Boolean);
            return resolvedList.length > 0 ? resolvedList : (excludeEmpty ? [] : ['Unspecified']);
          } else {
            const joined = rawVal.map(v => resolveValue(v, realKey)).filter(Boolean).join(', ');
            return joined ? [joined] : (excludeEmpty ? [] : ['Unspecified']);
          }
        } else {
          const resolved = resolveValue(rawVal, realKey);
          return resolved ? [resolved] : (excludeEmpty ? [] : ['Unspecified']);
        }
      } catch (e) {
        return excludeEmpty ? [] : ['Unspecified'];
      }
    } else if (fieldKey === 'Publisher') {
      const pub = paper.Publisher || paper.Original_Publisher || '';
      return pub ? [pub] : (excludeEmpty ? [] : ['Unspecified']);
    } else if (fieldKey === 'Overall_QA') {
      const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
      const qaStr = isManualDominant 
        ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '') 
        : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');
      if (!qaStr) return excludeEmpty ? [] : ['Unspecified'];
      try {
        const parsed = JSON.parse(qaStr);
        const qaObj = parsed.qa_scores || parsed;
        let score = 0;
        Object.values(qaObj).forEach((v: any) => {
          const val = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
          const num = parseFloat(String(val));
          if (!isNaN(num)) score += num;
          else if (['YES', 'PASS', 'TRUE'].includes(String(val).toUpperCase())) score += 1;
        });
        return [String(score)];
      } catch (e) {
        return [String(qaStr)];
      }
    } else {
      const val = paper[fieldKey];
      const strVal = val !== undefined && val !== null ? String(val).trim() : '';
      return strVal ? [strVal] : (excludeEmpty ? [] : ['Unspecified']);
    }
  }, [resolveValue, splitMultiValues, excludeEmpty]);

  // Extract numerical value from paper for scatter/bubble
  const getNumericalValue = useCallback((paper: any, numKey: string): number => {
    if (numKey === 'citation_count') {
      return parseFloat(String(paper.citation_count ?? 0)) || 0;
    }
    if (numKey === 'Year') {
      return parseFloat(String(paper.Year ?? 0)) || 0;
    }
    if (numKey === 'Overall_QA') {
      const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
      const qaStr = isManualDominant 
        ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '') 
        : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');
      if (!qaStr) return 0;
      try {
        const parsed = JSON.parse(qaStr);
        const qaObj = parsed.qa_scores || parsed;
        let score = 0;
        Object.values(qaObj).forEach((v: any) => {
          const val = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
          const num = parseFloat(String(val));
          if (!isNaN(num)) score += num;
          else if (['YES', 'PASS', 'TRUE'].includes(String(val).toUpperCase())) score += 1;
        });
        return score;
      } catch (e) {}
    }
    return 0;
  }, []);

  // Compute aggregate metrics
  const computeMetricValue = useCallback((groupPapers: any[]) => {
    if (metricMode === 'count') return groupPapers.length;

    if (metricMode === 'avg_citation') {
      let sum = 0;
      let count = 0;
      groupPapers.forEach(p => {
        const c = parseFloat(String(p.citation_count ?? 0));
        if (!isNaN(c)) {
          sum += c;
          count++;
        }
      });
      return count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
    }

    if (metricMode === 'avg_qa') {
      let sum = 0;
      let count = 0;
      groupPapers.forEach(p => {
        const score = getNumericalValue(p, 'Overall_QA');
        sum += score;
        count++;
      });
      return count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
    }

    return groupPapers.length;
  }, [metricMode, getNumericalValue]);

  // Category Limiting Helper: restricts top N-1 items and groups tail into "Other"
  const limitCategoryMap = useCallback((countsMap: Map<string, any[]>) => {
    if (!limitCategories || countsMap.size <= maxCategoriesCount || maxCategoriesCount < 2) {
      return countsMap;
    }

    const sortedEntries = Array.from(countsMap.entries())
      .map(([cat, list]) => ({
        cat,
        list,
        val: computeMetricValue(list)
      }))
      .sort((a, b) => b.val - a.val);

    const topEntries = sortedEntries.slice(0, maxCategoriesCount - 1);
    const tailEntries = sortedEntries.slice(maxCategoriesCount - 1);

    const result = new Map<string, any[]>();
    topEntries.forEach(e => result.set(e.cat, e.list));

    const otherList: any[] = [];
    tailEntries.forEach(e => otherList.push(...e.list));
    if (otherList.length > 0) {
      result.set('Other', otherList);
    }

    return result;
  }, [limitCategories, maxCategoriesCount, computeMetricValue]);

  // Generate ECharts Option dynamically
  const generateChartOption = useCallback((): echarts.EChartsOption => {
    const palette = THEME_PALETTES[themePreset];
    const font = fontFamily === 'serif' ? 'Times New Roman, Georgia, serif' : 'Inter, Roboto, sans-serif';

    const baseTitle = {
      text: chartTitle,
      subtext: chartSubtitle,
      left: 'center',
      top: 15,
      textStyle: { fontFamily: font, fontSize: fontSize + 4, fontWeight: 'bold' as const, color: palette.text },
      subtextStyle: { fontFamily: font, fontSize: Math.max(10, fontSize - 2), color: palette.subtext }
    };

    const baseLegend = {
      show: showLegend,
      type: 'scroll' as const,
      left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
      top: legendPosition === 'top' ? 65 : legendPosition === 'bottom' ? 'bottom' : 'middle',
      orient: (legendPosition === 'left' || legendPosition === 'right') ? 'vertical' as const : 'horizontal' as const,
      textStyle: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }
    };

    const baseTooltip = {
      trigger: 'item' as const,
      backgroundColor: palette.bg,
      borderColor: palette.border,
      textStyle: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }
    };

    // --- 1. Bar Vertical & Horizontal ---
    if (chartType === 'bar_vertical' || chartType === 'bar_horizontal') {
      const countsMap = new Map<string, any[]>();
      papers.forEach(p => {
        const vals = getFieldValue(p, primaryField);
        vals.forEach(v => {
          if (!countsMap.has(v)) countsMap.set(v, []);
          countsMap.get(v)!.push(p);
        });
      });

      const activeCountsMap = limitCategoryMap(countsMap);

      const categories = Array.from(activeCountsMap.keys()).sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });

      const values = categories.map(cat => computeMetricValue(activeCountsMap.get(cat)!));
      const isVert = chartType === 'bar_vertical';

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        legend: baseLegend,
        tooltip: { ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '8%', right: '8%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
        xAxis: isVert ? {
          type: 'category',
          data: categories,
          axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text, rotate: labelRotation }
        } : {
          type: 'value',
          axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text },
          splitLine: { lineStyle: { color: palette.border, type: 'dashed' } }
        },
        yAxis: isVert ? {
          type: 'value',
          axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text },
          splitLine: { lineStyle: { color: palette.border, type: 'dashed' } }
        } : {
          type: 'category',
          data: categories,
          axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }
        },
        series: [{
          name: metricMode.replace('_', ' ').toUpperCase(),
          type: 'bar',
          data: values,
          label: { show: showDataLabels, position: isVert ? 'top' : 'right', fontFamily: font, fontSize: fontSize - 2, color: palette.text },
          itemStyle: { borderRadius: [4, 4, 0, 0] }
        }]
      };
    }

    // --- 2. Stacked Bar ---
    if (chartType === 'stacked_bar') {
      const catSet = new Set<string>();
      const stackSet = new Set<string>();
      const rawMatrixMap = new Map<string, Map<string, any[]>>();

      papers.forEach(p => {
        const primVals = getFieldValue(p, primaryField);
        const secVals = getFieldValue(p, secondaryField);

        primVals.forEach(pv => {
          catSet.add(pv);
          secVals.forEach(sv => {
            stackSet.add(sv);
            if (!rawMatrixMap.has(pv)) rawMatrixMap.set(pv, new Map());
            if (!rawMatrixMap.get(pv)!.has(sv)) rawMatrixMap.get(pv)!.set(sv, []);
            rawMatrixMap.get(pv)!.get(sv)!.push(p);
          });
        });
      });

      const primPapersMap = new Map<string, any[]>();
      catSet.forEach(pv => {
        const pList: any[] = [];
        rawMatrixMap.get(pv)?.forEach(list => pList.push(...list));
        primPapersMap.set(pv, pList);
      });

      const limitedPrimMap = limitCategoryMap(primPapersMap);
      const categories = Array.from(limitedPrimMap.keys()).sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));
      const stacks = Array.from(stackSet).sort();

      const seriesList = stacks.map((stk) => ({
        name: stk,
        type: 'bar' as const,
        stack: 'total',
        data: categories.map(cat => {
          if (cat === 'Other') {
            let otherSum = 0;
            limitedPrimMap.get('Other')?.forEach(p => {
              const secVals = getFieldValue(p, secondaryField);
              if (secVals.includes(stk)) otherSum++;
            });
            return otherSum;
          }
          return computeMetricValue(rawMatrixMap.get(cat)?.get(stk) || []);
        }),
        label: { show: showDataLabels, fontFamily: font, fontSize: fontSize - 3, color: '#ffffff' }
      }));

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        legend: baseLegend,
        tooltip: { ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '8%', right: '8%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: categories, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text, rotate: labelRotation } },
        yAxis: { type: 'value', axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
        series: seriesList
      };
    }

    // --- 3. Line Chart ---
    if (chartType === 'line') {
      const countsMap = new Map<string, any[]>();
      papers.forEach(p => {
        const vals = getFieldValue(p, primaryField);
        vals.forEach(v => {
          if (!countsMap.has(v)) countsMap.set(v, []);
          countsMap.get(v)!.push(p);
        });
      });

      const activeCountsMap = limitCategoryMap(countsMap);

      const categories = Array.from(activeCountsMap.keys()).sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
      const values = categories.map(cat => computeMetricValue(activeCountsMap.get(cat)!));

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        legend: baseLegend,
        tooltip: { ...baseTooltip, trigger: 'axis' },
        grid: { left: '8%', right: '8%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: categories, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text, rotate: labelRotation } },
        yAxis: { type: 'value', axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
        series: [{
          name: metricMode.replace('_', ' ').toUpperCase(),
          type: 'line',
          smooth: smoothLine,
          data: values,
          symbolSize: 8,
          label: { show: showDataLabels, position: 'top', fontFamily: font, fontSize: fontSize - 2, color: palette.text },
          areaStyle: { opacity: 0.15 }
        }]
      };
    }

    // --- 4. Pie & Donut Chart ---
    if (chartType === 'pie_donut') {
      const countsMap = new Map<string, any[]>();
      papers.forEach(p => {
        const vals = getFieldValue(p, primaryField);
        vals.forEach(v => {
          if (!countsMap.has(v)) countsMap.set(v, []);
          countsMap.get(v)!.push(p);
        });
      });

      const activeCountsMap = limitCategoryMap(countsMap);

      const pieData = Array.from(activeCountsMap.entries()).map(([cat, pList]) => ({
        name: cat,
        value: computeMetricValue(pList)
      })).filter(d => d.value > 0);

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        legend: baseLegend,
        tooltip: { ...baseTooltip, formatter: '{b}: {c} ({d}%)' },
        series: [{
          name: primaryField,
          type: 'pie',
          radius: [donutRatio > 0 ? `${donutRatio * 0.7}%` : '0%', '70%'],
          center: ['50%', '55%'],
          data: pieData,
          label: { show: showDataLabels, fontFamily: font, fontSize: fontSize - 1, color: palette.text, formatter: '{b}: {c}' },
          itemStyle: { borderRadius: 4, borderColor: palette.bg, borderWidth: 2 }
        }]
      };
    }

    // --- 5. Scatter Plot ---
    if (chartType === 'scatter') {
      const scatterData: [number, number, string][] = papers.map(p => [
        getNumericalValue(p, numFieldX),
        getNumericalValue(p, numFieldY),
        p.Title || p.Paper_ID
      ]);

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        legend: baseLegend,
        tooltip: { ...baseTooltip, formatter: (p: any) => `<strong>${p.data[2]}</strong><br/>${numFieldX}: ${p.data[0]}<br/>${numFieldY}: ${p.data[1]}` },
        grid: { left: '10%', right: '10%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
        xAxis: { type: 'value', name: numFieldX, nameLocation: 'middle', nameGap: 30, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
        yAxis: { type: 'value', name: numFieldY, nameLocation: 'middle', nameGap: 35, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
        series: [{ type: 'scatter', symbolSize: Math.round(10 * bubbleScale), data: scatterData, itemStyle: { opacity: 0.8 } }]
      };
    }

    // --- 6. Bubble Chart ---
    if (chartType === 'bubble') {
      const bubbleData: [number, number, number, string][] = papers.map(p => [
        getNumericalValue(p, numFieldX),
        getNumericalValue(p, numFieldY),
        getNumericalValue(p, numFieldSize),
        p.Title || p.Paper_ID
      ]);

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        legend: baseLegend,
        tooltip: { ...baseTooltip, formatter: (p: any) => `<strong>${p.data[3]}</strong><br/>${numFieldX}: ${p.data[0]}<br/>${numFieldY}: ${p.data[1]}<br/>${numFieldSize}: ${p.data[2]}` },
        grid: { left: '10%', right: '10%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
        xAxis: { type: 'value', name: numFieldX, nameLocation: 'middle', nameGap: 30, scale: true, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
        yAxis: { type: 'value', name: numFieldY, nameLocation: 'middle', nameGap: 35, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
        series: [{ type: 'scatter', symbolSize: (d: any) => Math.max(6, Math.round(d[2] * 2 * bubbleScale)), data: bubbleData, itemStyle: { opacity: 0.75 } }]
      };
    }

    // --- 7. Treemap ---
    if (chartType === 'treemap') {
      const allowedLevelSets = sankeyFields.map((fieldKey, idx) => {
        const limitCount = sankeyMaxNodes[idx] || 0;
        if (limitCount < 2) return null;

        const counts = new Map<string, number>();
        papers.forEach(p => {
          const vals = getFieldValue(p, fieldKey);
          vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
        });

        if (counts.size <= limitCount) return null;

        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        return new Set<string>(sorted.slice(0, limitCount - 1).map(e => e[0]));
      });

      const buildTree = (papersList: any[], levelIdx: number): any[] => {
        if (levelIdx >= sankeyFields.length) return [];

        const fieldKey = sankeyFields[levelIdx];
        const topSet = allowedLevelSets[levelIdx];
        const groupMap = new Map<string, any[]>();

        papersList.forEach(p => {
          const rawVals = getFieldValue(p, fieldKey);
          const mappedVals = topSet ? Array.from(new Set(rawVals.map(v => topSet.has(v) ? v : 'Other'))) : rawVals;

          mappedVals.forEach(v => {
            if (!groupMap.has(v)) groupMap.set(v, []);
            groupMap.get(v)!.push(p);
          });
        });

        return Array.from(groupMap.entries()).map(([valName, childPapers]) => {
          const children = buildTree(childPapers, levelIdx + 1);
          if (children.length > 0) {
            return { name: valName, children };
          }
          return { name: valName, value: childPapers.length };
        });
      };

      const treeData = buildTree(papers, 0);

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        tooltip: baseTooltip,
        series: [{
          type: 'treemap',
          top: showLegend ? 90 : 70,
          bottom: '5%',
          data: treeData,
          label: { show: true, fontFamily: font, fontSize: fontSize - 1, formatter: '{b}\n{c}' },
          levels: [{ itemStyle: { borderColor: palette.bg, borderWidth: 2, gapWidth: 2 } }]
        }]
      };
    }

    // --- 8. Heatmap Matrix ---
    if (chartType === 'heatmap') {
      const countsP = new Map<string, any[]>();
      const countsS = new Map<string, any[]>();

      papers.forEach(p => {
        getFieldValue(p, primaryField).forEach(v => {
          if (!countsP.has(v)) countsP.set(v, []);
          countsP.get(v)!.push(p);
        });
        getFieldValue(p, secondaryField).forEach(v => {
          if (!countsS.has(v)) countsS.set(v, []);
          countsS.get(v)!.push(p);
        });
      });

      const activeCountsP = limitCategoryMap(countsP);
      const activeCountsS = limitCategoryMap(countsS);

      const catXSet = new Set<string>();
      const catYSet = new Set<string>();
      const matrixMap = new Map<string, Map<string, number>>();

      papers.forEach(p => {
        const rawP = getFieldValue(p, primaryField);
        const rawS = getFieldValue(p, secondaryField);

        const primVals = Array.from(new Set(rawP.map(v => activeCountsP.has(v) ? v : 'Other')));
        const secVals = Array.from(new Set(rawS.map(v => activeCountsS.has(v) ? v : 'Other')));

        primVals.forEach(pv => {
          catXSet.add(pv);
          secVals.forEach(sv => {
            catYSet.add(sv);
            if (!matrixMap.has(pv)) matrixMap.set(pv, new Map());
            matrixMap.get(pv)!.set(sv, (matrixMap.get(pv)!.get(sv) || 0) + 1);
          });
        });
      });

      const xData = Array.from(catXSet).sort();
      const yData = Array.from(catYSet).sort();
      const heatData: [number, number, number][] = [];
      let maxVal = 1;

      xData.forEach((xVal, i) => {
        yData.forEach((yVal, j) => {
          const count = matrixMap.get(xVal)?.get(yVal) || 0;
          heatData.push([i, j, count]);
          if (count > maxVal) maxVal = count;
        });
      });

      return {
        backgroundColor: palette.bg,
        title: baseTitle,
        tooltip: { ...baseTooltip, formatter: (p: any) => `${xData[p.data[0]]} × ${yData[p.data[1]]}: ${p.data[2]} papers` },
        grid: { left: '12%', right: '12%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: xData, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text, rotate: labelRotation } },
        yAxis: { type: 'category', data: yData, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text } },
        visualMap: { min: 0, max: maxVal, calculable: true, orient: 'horizontal', left: 'center', bottom: '2%', inRange: { color: [palette.bg, palette.colors[2] || '#3b82f6', palette.colors[0] || '#0f172a'] }, textStyle: { fontFamily: font, color: palette.text } },
        series: [{ type: 'heatmap', data: heatData, label: { show: showDataLabels, fontFamily: font, fontSize: fontSize - 2, color: palette.text } }]
      };
    }

    // --- 9. Sankey Flow ---
    if (chartType === 'sankey') {
      const nodesSet = new Set<string>();
      const linksMap = new Map<string, number>();

      // Pre-calculate top values per level if maxNodes limit is configured
      const allowedLevelSets = sankeyFields.map((fieldKey, idx) => {
        const limitCount = sankeyMaxNodes[idx] || 0;
        if (limitCount < 2) return null;

        const counts = new Map<string, number>();
        papers.forEach(p => {
          const vals = getFieldValue(p, fieldKey);
          vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
        });

        if (counts.size <= limitCount) return null;

        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        return new Set<string>(sorted.slice(0, limitCount - 1).map(e => e[0]));
      });

      papers.forEach(p => {
        const levelValues = sankeyFields.map((f, idx) => {
          const rawVals = getFieldValue(p, f);
          const topSet = allowedLevelSets[idx];
          if (!topSet) return rawVals;

          const mapped = rawVals.map(v => (topSet.has(v) ? v : 'Other'));
          return Array.from(new Set(mapped));
        });

        for (let i = 0; i < levelValues.length - 1; i++) {
          const currentVals = levelValues[i];
          const nextVals = levelValues[i + 1];

          currentVals.forEach(cv => {
            const sourceNode = `${i + 1}: ${cv}`;
            nodesSet.add(sourceNode);

            nextVals.forEach(nv => {
              const targetNode = `${i + 2}: ${nv}`;
              nodesSet.add(targetNode);

              const linkKey = `${sourceNode}--->${targetNode}`;
              linksMap.set(linkKey, (linksMap.get(linkKey) || 0) + 1);
            });
          });
        }
      });

      const nodes = Array.from(nodesSet).map(n => {
        const colonIdx = n.indexOf(': ');
        const levelNum = colonIdx > -1 ? parseInt(n.substring(0, colonIdx), 10) : 1;
        const levelIdx = levelNum - 1;

        const customPos = sankeyLabelPositions[levelIdx];
        const defaultPos = levelNum === sankeyFields.length ? ('left' as const) : ('right' as const);
        const position = customPos || defaultPos;

        return {
          name: n,
          label: { position }
        };
      });

      const links = Array.from(linksMap.entries()).map(([k, val]) => {
        const [source, target] = k.split('--->');
        return { source, target, value: val };
      });

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        tooltip: {
          ...baseTooltip,
          formatter: (params: any) => {
            if (params.dataType === 'node') {
              const name = params.name;
              const idx = name.indexOf(': ');
              return idx > -1 ? name.substring(idx + 2) : name;
            }
            if (params.dataType === 'edge') {
              const src = params.data.source;
              const tgt = params.data.target;
              const srcClean = src.indexOf(': ') > -1 ? src.substring(src.indexOf(': ') + 2) : src;
              const tgtClean = tgt.indexOf(': ') > -1 ? tgt.substring(tgt.indexOf(': ') + 2) : tgt;
              return `${srcClean} → ${tgtClean}: ${params.data.value} papers`;
            }
            return '';
          }
        },
        series: [{
          type: 'sankey',
          left: `${sankeyLeftPadding}%`,
          right: `${sankeyRightPadding}%`,
          top: showLegend ? 90 : 75,
          bottom: '8%',
          nodeWidth: sankeyNodeWidth,
          nodeGap: sankeyNodeGap,
          data: nodes,
          links: links,
          emphasis: { focus: 'adjacency' },
          label: {
            fontFamily: font,
            fontSize: fontSize - 1,
            color: palette.text,
            formatter: (params: any) => {
              const name = params.name;
              const idx = name.indexOf(': ');
              return idx > -1 ? name.substring(idx + 2) : name;
            }
          },
          lineStyle: { color: 'gradient', curveness: 0.5 }
        }]
      };
    }

    // --- 10. Radar / Spider ---
    if (chartType === 'radar') {
      const qaKeysSet = new Set<string>();
      papers.forEach(p => {
        const isManualDominant = (p.manual_stage || 0) >= (p.ai_stage || 0);
        const qaStr = isManualDominant
          ? (p.manual_quality_assessment || p.ai_quality_assessment || '')
          : (p.ai_quality_assessment || p.manual_quality_assessment || '');
        if (qaStr) {
          try {
            const parsed = JSON.parse(qaStr);
            const qaObj = parsed.qa_scores || parsed;
            if (typeof qaObj === 'object' && qaObj !== null) {
              Object.keys(qaObj).forEach(k => qaKeysSet.add(k));
            }
          } catch (e) {}
        }
      });

      const keysList = qaKeysSet.size > 0 ? Array.from(qaKeysSet).sort() : ['QA1', 'QA2', 'QA3', 'QA4', 'QA5', 'QA6', 'QA7', 'QA8'];

      const getQaValue = (p: any, key: string): number => {
        const isManualDominant = (p.manual_stage || 0) >= (p.ai_stage || 0);
        const qaStr = isManualDominant
          ? (p.manual_quality_assessment || p.ai_quality_assessment || '')
          : (p.ai_quality_assessment || p.manual_quality_assessment || '');
        if (!qaStr) return 0;
        try {
          const parsed = JSON.parse(qaStr);
          const qaObj = parsed.qa_scores || parsed;
          const v = qaObj[key];
          const val = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
          const num = parseFloat(String(val));
          if (!isNaN(num)) return num;
          if (['YES', 'PASS', 'TRUE'].includes(String(val).toUpperCase())) return 1;
        } catch (e) {}
        return 0;
      };

      const indicators = keysList.map(k => ({ name: k, max: 1.0 }));

      const countsMap = new Map<string, any[]>();
      papers.forEach(p => {
        const vals = getFieldValue(p, primaryField);
        vals.forEach(v => {
          if (!countsMap.has(v)) countsMap.set(v, []);
          countsMap.get(v)!.push(p);
        });
      });

      const activeCountsMap = limitCategoryMap(countsMap);

      const seriesData = Array.from(activeCountsMap.entries()).map(([catName, pList]) => {
        const avgScores = keysList.map(k => {
          if (pList.length === 0) return 0;
          let sum = 0;
          pList.forEach(p => sum += getQaValue(p, k));
          return parseFloat((sum / pList.length).toFixed(2));
        });
        return { name: catName, value: avgScores };
      });

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        legend: baseLegend,
        tooltip: baseTooltip,
        radar: {
          indicator: indicators,
          center: ['50%', '55%'],
          radius: '65%',
          shape: 'polygon',
          axisName: { fontFamily: font, fontSize: fontSize - 1, color: palette.text },
          splitArea: { areaStyle: { color: [palette.bg, palette.border] } }
        },
        series: [{
          type: 'radar',
          data: seriesData,
          symbolSize: 6,
          areaStyle: { opacity: 0.25 }
        }]
      };
    }

    // --- 11. Funnel Chart ---
    if (chartType === 'funnel') {
      const countsMap = new Map<string, any[]>();
      papers.forEach(p => {
        const vals = getFieldValue(p, primaryField);
        vals.forEach(v => {
          if (!countsMap.has(v)) countsMap.set(v, []);
          countsMap.get(v)!.push(p);
        });
      });

      const activeCountsMap = limitCategoryMap(countsMap);

      const funnelData = Array.from(activeCountsMap.entries()).map(([cat, pList]) => ({
        name: cat,
        value: computeMetricValue(pList)
      })).sort((a, b) => b.value - a.value);

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        legend: baseLegend,
        tooltip: { ...baseTooltip, formatter: '{b}: {c}' },
        series: [{
          name: primaryField,
          type: 'funnel',
          left: '15%',
          right: '15%',
          top: showLegend ? 90 : 70,
          bottom: '10%',
          sort: 'descending',
          gap: 2,
          label: { show: showDataLabels, position: 'inside', fontFamily: font, fontSize: fontSize - 1, color: '#ffffff' },
          data: funnelData
        }]
      };
    }

    // --- 12. Boxplot Chart ---
    if (chartType === 'boxplot') {
      const countsMap = new Map<string, any[]>();
      papers.forEach(p => {
        const vals = getFieldValue(p, primaryField);
        vals.forEach(v => {
          if (!countsMap.has(v)) countsMap.set(v, []);
          countsMap.get(v)!.push(p);
        });
      });

      const activeCountsMap = limitCategoryMap(countsMap);
      const categories = Array.from(activeCountsMap.keys()).sort();

      const boxData = categories.map(cat => {
        const pList = activeCountsMap.get(cat)!;
        const nums = pList.map(p => getNumericalValue(p, numFieldY)).sort((a, b) => a - b);
        if (nums.length === 0) return [0, 0, 0, 0, 0];

        const min = nums[0];
        const max = nums[nums.length - 1];

        const getPercentile = (p: number) => {
          const index = (nums.length - 1) * p;
          const lower = Math.floor(index);
          const upper = Math.ceil(index);
          const weight = index - lower;
          return nums[lower] * (1 - weight) + nums[upper] * weight;
        };

        const q1 = getPercentile(0.25);
        const median = getPercentile(0.5);
        const q3 = getPercentile(0.75);

        return [min, q1, median, q3, max];
      });

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        legend: baseLegend,
        tooltip: { ...baseTooltip, trigger: 'item', formatter: (params: any) => `<strong>${params.name}</strong><br/>Min: ${params.data[1]}<br/>Q1: ${params.data[2]}<br/>Median: ${params.data[3]}<br/>Q3: ${params.data[4]}<br/>Max: ${params.data[5]}` },
        grid: { left: '10%', right: '10%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: categories, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text, rotate: labelRotation } },
        yAxis: { type: 'value', name: numFieldY, nameLocation: 'middle', nameGap: 35, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
        series: [{
          name: numFieldY,
          type: 'boxplot',
          data: boxData,
          itemStyle: { borderColor: palette.colors[0], borderWidth: 2 }
        }]
      };
    }

    // --- 13. Sunburst Ring ---
    if (chartType === 'sunburst') {
      const allowedLevelSets = sankeyFields.map((fieldKey, idx) => {
        const limitCount = sankeyMaxNodes[idx] || 0;
        if (limitCount < 2) return null;

        const counts = new Map<string, number>();
        papers.forEach(p => {
          const vals = getFieldValue(p, fieldKey);
          vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
        });

        if (counts.size <= limitCount) return null;

        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        return new Set<string>(sorted.slice(0, limitCount - 1).map(e => e[0]));
      });

      const buildTree = (papersList: any[], levelIdx: number): any[] => {
        if (levelIdx >= sankeyFields.length) return [];

        const field = sankeyFields[levelIdx];
        const topSet = allowedLevelSets[levelIdx];
        const groupMap = new Map<string, any[]>();

        papersList.forEach(p => {
          const rawVals = getFieldValue(p, field);
          const mappedVals = topSet ? Array.from(new Set(rawVals.map(v => topSet.has(v) ? v : 'Other'))) : rawVals;

          mappedVals.forEach(v => {
            if (!groupMap.has(v)) groupMap.set(v, []);
            groupMap.get(v)!.push(p);
          });
        });

        return Array.from(groupMap.entries()).map(([valName, childPapers]) => {
          const children = buildTree(childPapers, levelIdx + 1);
          if (children.length > 0) {
            return { name: valName, children };
          }
          return { name: valName, value: childPapers.length };
        });
      };

      const sunburstData = buildTree(papers, 0);

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        tooltip: baseTooltip,
        series: [{
          type: 'sunburst',
          data: sunburstData,
          radius: ['15%', '80%'],
          center: ['50%', '55%'],
          label: { show: showDataLabels, fontFamily: font, fontSize: fontSize - 2, color: palette.text },
          itemStyle: { borderRadius: 4, borderWidth: 1, borderColor: palette.bg }
        }]
      };
    }

    // --- 14. Graph Network ---
    if (chartType === 'graph') {
      const countsP = new Map<string, any[]>();
      const countsS = new Map<string, any[]>();

      papers.forEach(p => {
        getFieldValue(p, primaryField).forEach(v => {
          if (!countsP.has(v)) countsP.set(v, []);
          countsP.get(v)!.push(p);
        });
        getFieldValue(p, secondaryField).forEach(v => {
          if (!countsS.has(v)) countsS.set(v, []);
          countsS.get(v)!.push(p);
        });
      });

      const activeCountsP = limitCategoryMap(countsP);
      const activeCountsS = limitCategoryMap(countsS);

      const nodesMap = new Map<string, { name: string; category: number }>();
      const linksMap = new Map<string, number>();

      papers.forEach(p => {
        const rawP = getFieldValue(p, primaryField);
        const rawS = getFieldValue(p, secondaryField);

        const mappedP = Array.from(new Set(rawP.map(v => activeCountsP.has(v) ? v : 'Other')));
        const mappedS = Array.from(new Set(rawS.map(v => activeCountsS.has(v) ? v : 'Other')));

        mappedP.forEach(pv => {
          const n1 = `[${primaryField}] ${pv}`;
          if (!nodesMap.has(n1)) nodesMap.set(n1, { name: n1, category: 0 });

          mappedS.forEach(sv => {
            const n2 = `[${secondaryField}] ${sv}`;
            if (!nodesMap.has(n2)) nodesMap.set(n2, { name: n2, category: 1 });

            const edgeKey = `${n1}--->${n2}`;
            linksMap.set(edgeKey, (linksMap.get(edgeKey) || 0) + 1);
          });
        });
      });

      const graphNodes = Array.from(nodesMap.values()).map(n => ({
        name: n.name,
        category: n.category,
        symbolSize: 20
      }));

      const graphLinks = Array.from(linksMap.entries()).map(([k, val]) => {
        const [source, target] = k.split('--->');
        return { source, target, value: val, lineStyle: { width: Math.min(10, Math.max(1, val)) } };
      });

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        legend: {
          show: showLegend,
          data: [primaryField, secondaryField],
          textStyle: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }
        },
        tooltip: { ...baseTooltip, formatter: (p: any) => p.dataType === 'edge' ? `${p.data.source} → ${p.data.target}: ${p.data.value} papers` : p.name },
        series: [{
          type: 'graph',
          layout: 'force',
          force: { repulsion: 120, edgeLength: 90 },
          roam: true,
          label: { show: showDataLabels, fontFamily: font, fontSize: fontSize - 2, color: palette.text, position: 'right' },
          categories: [{ name: primaryField }, { name: secondaryField }],
          data: graphNodes,
          links: graphLinks,
          lineStyle: { color: 'source', curveness: 0.2 }
        }]
      };
    }

    // --- 15. Gauge Dial ---
    if (chartType === 'gauge') {
      let metricValue = 0;
      let maxTarget = gaugeMaxScale || 100;
      let gaugeTitle = 'Cohort Metric';

      if (metricMode === 'avg_qa') {
        const sum = papers.reduce((acc, p) => acc + getNumericalValue(p, 'Overall_QA'), 0);
        const avg = papers.length > 0 ? sum / papers.length : 0;
        metricValue = parseFloat((avg / 8 * maxTarget).toFixed(1));
        gaugeTitle = `Avg QA Score (${avg.toFixed(1)} / 8.0)`;
      } else if (metricMode === 'avg_citation') {
        const sum = papers.reduce((acc, p) => acc + (parseFloat(String(p.citation_count ?? 0)) || 0), 0);
        const avg = papers.length > 0 ? sum / papers.length : 0;
        metricValue = parseFloat(avg.toFixed(1));
        gaugeTitle = `Avg Citation Count (${avg.toFixed(1)})`;
      } else {
        const downloaded = papers.filter(p => String(p.Local_PDF_Status || '').toLowerCase().includes('download')).length;
        metricValue = papers.length > 0 ? parseFloat((downloaded / papers.length * maxTarget).toFixed(1)) : 0;
        gaugeTitle = `PDF Download Ratio (${downloaded}/${papers.length})`;
      }

      return {
        backgroundColor: palette.bg,
        color: palette.colors,
        title: baseTitle,
        series: [{
          type: 'gauge',
          center: ['50%', '60%'],
          radius: '75%',
          min: 0,
          max: maxTarget,
          progress: { show: true, width: 14 },
          axisLine: { lineStyle: { width: 14, color: [[1, palette.border]] } },
          axisTick: { show: false },
          splitLine: { length: 8, lineStyle: { width: 2, color: palette.text } },
          axisLabel: { fontFamily: font, fontSize: fontSize - 2, color: palette.text, distance: 15 },
          pointer: { width: 6 },
          title: { show: true, offsetCenter: [0, '70%'], fontFamily: font, fontSize: fontSize, color: palette.text },
          detail: { valueAnimation: true, formatter: '{value}%', offsetCenter: [0, '40%'], fontFamily: font, fontSize: fontSize + 6, fontWeight: 'bold', color: palette.text },
          data: [{ value: metricValue, name: gaugeTitle }]
        }]
      };
    }

    // --- 16. Calendar Heatmap ---
    if (chartType === 'calendar') {
      const dateMap = new Map<string, number>();
      papers.forEach(p => {
        const dt = p.created_at || p.imported_at;
        if (dt) {
          const dateStr = String(dt).substring(0, 10);
          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
          }
        }
      });

      const calendarData = Array.from(dateMap.entries()).map(([d, val]) => [d, val]);

      let minYear = '2026';
      let maxYear = '2026';
      if (calendarData.length > 0) {
        const years = calendarData.map(d => String(d[0]).substring(0, 4)).sort();
        minYear = years[0];
        maxYear = years[years.length - 1];
      }

      const maxVal = Math.max(...calendarData.map(d => Number(d[1])), 5);

      return {
        backgroundColor: palette.bg,
        title: baseTitle,
        tooltip: { ...baseTooltip, formatter: (p: any) => `${p.data[0]}: ${p.data[1]} papers ingested` },
        visualMap: {
          min: 0,
          max: maxVal,
          type: 'continuous',
          orient: 'horizontal',
          left: 'center',
          bottom: '2%',
          inRange: { color: [palette.bg, palette.colors[2] || '#3b82f6', palette.colors[0] || '#0f172a'] },
          textStyle: { fontFamily: font, color: palette.text }
        },
        calendar: {
          top: showLegend ? 110 : 80,
          left: 60,
          right: 40,
          cellSize: ['auto', 14],
          range: minYear === maxYear ? minYear : [minYear, maxYear],
          itemStyle: { borderWidth: 1, borderColor: palette.border },
          yearLabel: { show: true, color: palette.text, fontFamily: font },
          dayLabel: { color: palette.text, fontFamily: font },
          monthLabel: { color: palette.text, fontFamily: font }
        },
        series: [{
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: calendarData
        }]
      };
    }

    return { backgroundColor: palette.bg, title: baseTitle };
  }, [
    chartType,
    primaryField,
    secondaryField,
    metricMode,
    sankeyFields,
    limitCategoryMap,
    numFieldX,
    numFieldY,
    numFieldSize,
    papers,
    getFieldValue,
    getNumericalValue,
    computeMetricValue,
    themePreset,
    fontFamily,
    fontSize,
    chartTitle,
    chartSubtitle,
    showLegend,
    legendPosition,
    showDataLabels,
    labelRotation,
    donutRatio,
    smoothLine,
    sankeyNodeWidth,
    sankeyNodeGap,
    sankeyLeftPadding,
    sankeyRightPadding,
    sankeyLabelPositions,
    sankeyMaxNodes,
    bubbleScale,
    gaugeMaxScale
  ]);

  // Re-render chart on Step 4
  useEffect(() => {
    if (!isOpen || currentStep !== 4 || !chartRef.current) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current, undefined, {
        renderer: exportFormat === 'svg' ? 'svg' : 'canvas'
      });
    } else {
      chartInstanceRef.current.dispose();
      chartInstanceRef.current = echarts.init(chartRef.current, undefined, {
        renderer: exportFormat === 'svg' ? 'svg' : 'canvas'
      });
    }

    const option = generateChartOption();
    chartInstanceRef.current.setOption(option, true);

    const handleResize = () => chartInstanceRef.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, currentStep, exportFormat, generateChartOption]);

  // Clean up on modal close
  useEffect(() => {
    if (!isOpen && chartInstanceRef.current) {
      chartInstanceRef.current.dispose();
      chartInstanceRef.current = null;
      setCurrentStep(1);
    }
  }, [isOpen]);

  // Export Chart handler
  const handleExportChart = () => {
    if (!chartInstanceRef.current) return;

    if (exportFormat === 'svg') {
      const svgData = chartInstanceRef.current.renderToSVGString();
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slr_figure_${chartType}_${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const dataUrl = chartInstanceRef.current.getDataURL({
        type: 'png',
        pixelRatio: exportScale,
        backgroundColor: THEME_PALETTES[themePreset].bg
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `slr_figure_${chartType}_${exportScale}x_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (!isOpen) return null;

  const chartInfo = CHART_TYPES_INFO[chartType];
  const IconComp = chartInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full h-full max-w-[94vw] max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Wizard Header & Stepper */}
        <div className="h-16 px-6 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                SLR Cohort Visualizer Wizard
              </h2>
              <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-2">
                <span>Step-by-step scientific figure generation ({papers.length} papers in source table)</span>
                {isFiltered && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    Filtered: {papers.length} / {totalUnfilteredCount || papers.length} papers
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="flex items-center gap-2 bg-secondary/40 border border-border rounded-xl p-1">
            {[
              { num: 1, title: '1. Select Type' },
              { num: 2, title: '2. Map Data' },
              { num: 3, title: '3. Customize Style' },
              { num: 4, title: '4. Visualize & Export' }
            ].map(step => (
              <button
                key={step.num}
                onClick={() => setCurrentStep(step.num as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentStep === step.num
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : currentStep > step.num
                    ? 'bg-card text-foreground hover:bg-secondary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {currentStep > step.num ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : null}
                {step.title}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: SELECT CHART TYPE */}
        {currentStep === 1 && (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center max-w-5xl mx-auto w-full space-y-8">
            {isFiltered && (
              <div className="w-full max-w-xl p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                <div>
                  <span className="font-bold text-xs block">Cohort Table View Filter Active</span>
                  <p className="text-[11px] opacity-90 leading-tight">
                    The chart datasource is currently filtered ({papers.length} of {totalUnfilteredCount || papers.length} papers displayed). Generated figures will reflect only this filtered subset.
                  </p>
                </div>
              </div>
            )}

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-foreground tracking-tight">Step 1: Choose Chart Type</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Select the target visualization format. Subsequent data mapping and styling steps will adjust automatically based on your choice.
              </p>
            </div>

            {/* Primary Dropdown Selector */}
            <div className="w-full max-w-md space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                Select Chart Format (17 Scientific Templates Available)
              </label>
              <div className="relative">
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as ChartType)}
                  className="w-full bg-secondary border-2 border-primary/40 rounded-xl px-4 py-3 text-sm font-bold text-foreground focus:outline-none focus:border-primary appearance-none shadow-sm cursor-pointer"
                >
                  {Object.entries(CHART_TYPES_INFO).map(([id, info]) => (
                    <option key={id} value={id}>
                      {info.name} — ({info.category})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-primary absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Active Selected Chart Card */}
            <div className="w-full bg-card border border-border rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <IconComp className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground">{chartInfo.name}</h4>
                  <span className="text-[10px] font-extrabold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                    {chartInfo.category}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Description</span>
                  <p className="text-xs text-foreground font-medium">{chartInfo.description}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-primary block">Recommended SLR Use Case</span>
                  <p className="text-xs text-muted-foreground font-medium">{chartInfo.slrUseCase}</p>
                </div>
              </div>
            </div>

            {/* Quick Choice Grid */}
            <div className="w-full space-y-3">
              <span className="text-xs font-bold text-muted-foreground uppercase block text-center">
                Or pick visually from all 17 templates:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {Object.entries(CHART_TYPES_INFO).map(([id, info]) => {
                  const ItemIcon = info.icon;
                  const isSelected = chartType === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setChartType(id as ChartType)}
                      className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary shadow-sm scale-105 font-bold'
                          : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground'
                      }`}
                    >
                      <ItemIcon className="w-4 h-4" />
                      <span className="text-[10px] leading-tight font-semibold line-clamp-1">{info.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 1 Footer */}
            <div className="w-full flex justify-end pt-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                Proceed to Data Mapping
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DYNAMIC DATA MAPPING */}
        {currentStep === 2 && (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center max-w-3xl mx-auto w-full space-y-6">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-foreground tracking-tight">
                Step 2: Map Data Fields for <span className="text-primary">{chartInfo.name}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Configure field assignments tailored specifically for {chartInfo.name.toLowerCase()}.
              </p>
            </div>

            <div className="w-full bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
              
              {/* Dynamic Field Controls Based on Chart Type */}
              
              {/* 1. Bar Vertical / Bar Horizontal / Funnel / Radar */}
              {['bar_vertical', 'bar_horizontal', 'funnel', 'radar'].includes(chartType) && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      {chartType === 'radar' ? 'Primary Series Grouping Variable' : 'Category Field (X-Axis / Slice)'}
                    </label>
                    <select
                      value={primaryField}
                      onChange={(e) => setPrimaryField(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      {availableFields.map(f => (
                        <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                      ))}
                    </select>
                  </div>

                  {chartType !== 'radar' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground block">Metric Calculation</label>
                      <select
                        value={metricMode}
                        onChange={(e) => setMetricMode(e.target.value as any)}
                        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="count">Paper Record Count</option>
                        <option value="avg_citation">Average Citation Count</option>
                        <option value="avg_qa">Average Overall QA Score</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Stacked Bar / Graph */}
              {['stacked_bar', 'graph'].includes(chartType) && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground block">Primary Category / Source Node</label>
                      <select
                        value={primaryField}
                        onChange={(e) => setPrimaryField(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                      >
                        {availableFields.map(f => (
                          <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground block">Sub-Category / Target Node</label>
                      <select
                        value={secondaryField}
                        onChange={(e) => setSecondaryField(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                      >
                        {availableFields.map(f => (
                          <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {chartType === 'stacked_bar' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground block">Metric Calculation</label>
                      <select
                        value={metricMode}
                        onChange={(e) => setMetricMode(e.target.value as any)}
                        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="count">Paper Record Count</option>
                        <option value="avg_citation">Average Citation Count</option>
                        <option value="avg_qa">Average Overall QA Score</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Line Chart */}
              {chartType === 'line' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Time / Sequence Field (X-Axis)</label>
                    <select
                      value={primaryField}
                      onChange={(e) => setPrimaryField(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      {availableFields.map(f => (
                        <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Y-Axis Metric</label>
                    <select
                      value={metricMode}
                      onChange={(e) => setMetricMode(e.target.value as any)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="count">Paper Record Count</option>
                      <option value="avg_citation">Average Citation Count</option>
                      <option value="avg_qa">Average Overall QA Score</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 4. Pie & Donut */}
              {chartType === 'pie_donut' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Slice Category Field</label>
                    <select
                      value={primaryField}
                      onChange={(e) => setPrimaryField(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      {availableFields.map(f => (
                        <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Metric Calculation</label>
                    <select
                      value={metricMode}
                      onChange={(e) => setMetricMode(e.target.value as any)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="count">Paper Record Count</option>
                      <option value="avg_citation">Average Citation Count</option>
                      <option value="avg_qa">Average Overall QA Score</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 5. Scatter & Boxplot */}
              {['scatter', 'boxplot'].includes(chartType) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Category Variable (X-Axis)</label>
                    {chartType === 'boxplot' ? (
                      <select
                        value={primaryField}
                        onChange={(e) => setPrimaryField(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                      >
                        {availableFields.map(f => (
                          <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={numFieldX}
                        onChange={(e) => setNumFieldX(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                      >
                        {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Y-Axis Continuous Numerical Metric</label>
                    <select
                      value={numFieldY}
                      onChange={(e) => setNumFieldY(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* 6. Bubble Chart */}
              {chartType === 'bubble' && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">X-Axis Variable</label>
                    <select
                      value={numFieldX}
                      onChange={(e) => setNumFieldX(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Y-Axis Variable</label>
                    <select
                      value={numFieldY}
                      onChange={(e) => setNumFieldY(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Bubble Size Metric</label>
                    <select
                      value={numFieldSize}
                      onChange={(e) => setNumFieldSize(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* 7. Heatmap Matrix */}
              {chartType === 'heatmap' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground block">Row Category (X-Axis)</label>
                      <select
                        value={primaryField}
                        onChange={(e) => setPrimaryField(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                      >
                        {availableFields.map(f => (
                          <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground block">Column Category (Y-Axis)</label>
                      <select
                        value={secondaryField}
                        onChange={(e) => setSecondaryField(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                      >
                        {availableFields.map(f => (
                          <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 8. Dynamic Multi-Level Depth (Sankey Flow, Sunburst Ring & Treemap) */}
              {['sankey', 'sunburst', 'treemap'].includes(chartType) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <span className="text-xs font-bold text-foreground">
                      {chartType === 'sankey' ? 'Sankey Flow' : chartType === 'sunburst' ? 'Sunburst Ring' : 'Treemap Tile'} Depth Levels
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Levels ({sankeyFields.length}):</span>
                      <button
                        disabled={sankeyFields.length <= 2}
                        onClick={() => setSankeyFields(prev => prev.slice(0, prev.length - 1))}
                        className="w-7 h-7 rounded-lg bg-secondary border border-border font-bold text-xs flex items-center justify-center disabled:opacity-40 hover:bg-secondary/80"
                      >
                        -
                      </button>
                      <button
                        disabled={sankeyFields.length >= 6}
                        onClick={() => setSankeyFields(prev => [...prev, availableFields[0] || 'Unspecified'])}
                        className="w-7 h-7 rounded-lg bg-secondary border border-border font-bold text-xs flex items-center justify-center disabled:opacity-40 hover:bg-secondary/80"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {sankeyFields.map((fieldVal, idx) => (
                      <div key={idx} className="p-3 bg-secondary/30 border border-border rounded-xl space-y-2">
                        <label className="text-xs font-bold text-foreground block">
                          Level {idx + 1} ({idx === 0 ? 'Source / Inner' : idx === sankeyFields.length - 1 ? 'Target / Outer' : 'Intermediate'})
                        </label>
                        <select
                          value={fieldVal}
                          onChange={(e) => {
                            const next = [...sankeyFields];
                            next[idx] = e.target.value;
                            setSankeyFields(next);
                          }}
                          className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                        >
                          {availableFields.map(f => (
                            <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                          ))}
                        </select>

                        <div className="flex items-center justify-between pt-1">
                          <label className="text-[10px] font-bold text-muted-foreground">
                            Max Nodes (Top N):
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            placeholder="Unlimited"
                            value={sankeyMaxNodes[idx] || ''}
                            onChange={(e) => {
                              const val = e.target.value ? Math.max(0, Number(e.target.value)) : 0;
                              setSankeyMaxNodes(prev => ({ ...prev, [idx]: val }));
                            }}
                            className="w-20 bg-card border border-border rounded-md px-2 py-0.5 text-[11px] font-bold text-foreground text-right focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 9. Gauge KPI Dial Settings */}
              {chartType === 'gauge' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">KPI Target Indicator</label>
                    <select
                      value={metricMode}
                      onChange={(e) => setMetricMode(e.target.value as any)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="avg_qa">Average Overall QA Score Target (%)</option>
                      <option value="count">PDF Acquisition Completeness Ratio (%)</option>
                      <option value="avg_citation">Average Citation Yield</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Category Data Limiting Option */}
              {['bar_vertical', 'bar_horizontal', 'stacked_bar', 'line', 'pie_donut', 'funnel', 'radar', 'boxplot', 'graph', 'heatmap'].includes(chartType) && (
                <div className="p-4 bg-secondary/20 border border-border/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                      <input
                        type="checkbox"
                        checked={limitCategories}
                        onChange={(e) => setLimitCategories(e.target.checked)}
                        className="rounded border-border text-primary"
                      />
                      Enable Category Limiting (Group Minority Tail into "Other")
                    </label>
                  </div>

                  {limitCategories && (
                    <div className="flex items-center gap-3 pt-1">
                      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        Max Categories to Show (Top N-1 + "Other"):
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={50}
                        value={maxCategoriesCount}
                        onChange={(e) => setMaxCategoriesCount(Math.max(2, Number(e.target.value)))}
                        className="w-24 bg-card border border-border rounded-lg px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Cell Value & Extraction Controls */}
              <div className="p-4 bg-secondary/20 border border-border/80 rounded-xl space-y-3 pt-3">
                <span className="text-[10px] font-extrabold uppercase text-primary block">
                  Cell & Extraction Value Treatment
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={useUmbrellanizer}
                      onChange={(e) => setUseUmbrellanizer(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                    Umbrellanizer Taxonomy
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={splitMultiValues}
                      onChange={(e) => setSplitMultiValues(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                    Split Multi-Value Cells
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={excludeEmpty}
                      onChange={(e) => setExcludeEmpty(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                    Exclude Unspecified
                  </label>
                </div>
              </div>

            </div>

            {/* Step 2 Footer */}
            <div className="w-full flex justify-between pt-2">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-5 py-2.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-border"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Chart Select
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                Proceed to Customize Style
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CUSTOMIZE STYLE */}
        {currentStep === 3 && (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center max-w-3xl mx-auto w-full space-y-6">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-foreground tracking-tight">Step 3: Customize Properties & Layout</h3>
              <p className="text-xs text-muted-foreground">
                Fine-tune titles, scientific theme palettes, typography, and chart-specific parameters.
              </p>
            </div>

            <div className="w-full bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
              
              {/* Titles */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Figure Main Title</label>
                  <input
                    type="text"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Figure Subtitle</label>
                  <input
                    type="text"
                    value={chartSubtitle}
                    onChange={(e) => setChartSubtitle(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Theme & Fonts */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Journal Palette Theme</label>
                  <select
                    value={themePreset}
                    onChange={(e) => setThemePreset(e.target.value as ThemePreset)}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  >
                    {Object.entries(THEME_PALETTES).map(([k, v]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Font Family</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as any)}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="serif">Times New Roman (Serif)</option>
                    <option value="sans-serif">Inter / Outfit (Sans)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Font Size ({fontSize}px)</label>
                  <input
                    type="number"
                    min={10}
                    max={22}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Legend & Labels */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-secondary/20 border border-border/80 rounded-xl">
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-bold text-foreground cursor-pointer">
                    Show Legend
                    <input
                      type="checkbox"
                      checked={showLegend}
                      onChange={(e) => setShowLegend(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                  </label>
                  {showLegend && (
                    <select
                      value={legendPosition}
                      onChange={(e) => setLegendPosition(e.target.value as any)}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold"
                    >
                      <option value="top">Top Center</option>
                      <option value="bottom">Bottom Center</option>
                      <option value="left">Left Side</option>
                      <option value="right">Right Side</option>
                    </select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-bold text-foreground cursor-pointer">
                    Show Value Labels
                    <input
                      type="checkbox"
                      checked={showDataLabels}
                      onChange={(e) => setShowDataLabels(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                  </label>
                </div>

                {['bar_vertical', 'line', 'stacked_bar', 'heatmap', 'boxplot'].includes(chartType) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Label Rotation Angle</label>
                    <select
                      value={labelRotation}
                      onChange={(e) => setLabelRotation(Number(e.target.value))}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold"
                    >
                      <option value={0}>0° (Horizontal)</option>
                      <option value={30}>30° Inclined</option>
                      <option value={45}>45° Inclined</option>
                      <option value={90}>90° Vertical</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Specific Chart Type Parameters */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                <span className="text-[10px] font-extrabold uppercase text-primary block">
                  {chartInfo.name} Specific Parameters
                </span>

                {chartType === 'pie_donut' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">Donut Hole Radius ({donutRatio}%)</label>
                    <input
                      type="range"
                      min={0}
                      max={75}
                      value={donutRatio}
                      onChange={(e) => setDonutRatio(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                )}

                {chartType === 'line' && (
                  <label className="flex items-center justify-between text-xs font-bold text-foreground cursor-pointer">
                    Smooth Spline Curve
                    <input
                      type="checkbox"
                      checked={smoothLine}
                      onChange={(e) => setSmoothLine(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                  </label>
                )}

                {chartType === 'sankey' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-foreground block">Node Width ({sankeyNodeWidth}px)</label>
                        <input
                          type="range"
                          min={10}
                          max={50}
                          value={sankeyNodeWidth}
                          onChange={(e) => setSankeyNodeWidth(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-foreground block">Node Gap ({sankeyNodeGap}px)</label>
                        <input
                          type="range"
                          min={10}
                          max={40}
                          value={sankeyNodeGap}
                          onChange={(e) => setSankeyNodeGap(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-primary/20">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-foreground block">Left Node Outer Margin Padding ({sankeyLeftPadding}%)</label>
                        <input
                          type="range"
                          min={2}
                          max={40}
                          value={sankeyLeftPadding}
                          onChange={(e) => setSankeyLeftPadding(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-foreground block">Right Node Outer Margin Padding ({sankeyRightPadding}%)</label>
                        <input
                          type="range"
                          min={2}
                          max={40}
                          value={sankeyRightPadding}
                          onChange={(e) => setSankeyRightPadding(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-primary/20">
                      <label className="text-xs font-bold text-foreground block">
                        Per-Level Node Label Position (Left vs Right Alignment)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {sankeyFields.map((fieldVal, idx) => {
                          const currentPos = sankeyLabelPositions[idx] || (idx === sankeyFields.length - 1 ? 'left' : 'right');
                          return (
                            <div key={idx} className="flex items-center justify-between p-2 bg-secondary/40 border border-border rounded-lg">
                              <span className="text-xs font-semibold text-foreground truncate max-w-[110px]" title={fieldVal}>
                                L{idx + 1}: {fieldVal.startsWith('ext:') ? fieldVal.substring(4) : fieldVal}
                              </span>
                              <div className="flex items-center gap-1 bg-card border border-border rounded-md p-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setSankeyLabelPositions(prev => ({ ...prev, [idx]: 'left' }))}
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-colors ${
                                    currentPos === 'left' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  Left
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSankeyLabelPositions(prev => ({ ...prev, [idx]: 'right' }))}
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-colors ${
                                    currentPos === 'right' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  Right
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {['scatter', 'bubble'].includes(chartType) && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">Marker Size Multiplier ({bubbleScale}x)</label>
                    <input
                      type="range"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={bubbleScale}
                      onChange={(e) => setBubbleScale(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                )}

                {chartType === 'gauge' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">Gauge Max Scale Target Value ({gaugeMaxScale})</label>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={gaugeMaxScale}
                      onChange={(e) => setGaugeMaxScale(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                )}
              </div>

            </div>

            {/* Step 3 Footer */}
            <div className="w-full flex justify-between pt-2">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-border"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Data Mapping
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                Visualize & Export
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: VISUALIZE & EXPORT */}
        {currentStep === 4 && (
          <div className="flex-1 flex overflow-hidden">
            {/* Main Canvas View */}
            <div className="flex-1 bg-background flex flex-col p-6 overflow-hidden relative border-r border-border">
              
              {isFiltered && (
                <div className="mb-3 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2.5 shrink-0 shadow-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span className="font-semibold text-[11px]">
                    Warning: Visualizing filtered cohort dataset ({papers.length} of {totalUnfilteredCount || papers.length} total papers). Clear filters in Cohort Table View to cover all data.
                  </span>
                </div>
              )}

              {/* Top Bar Quick Controls */}
              <div className="h-12 border-b border-border bg-card/60 rounded-t-2xl px-4 flex items-center justify-between shrink-0 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <IconComp className="w-4 h-4 text-primary" />
                    {chartInfo.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({papers.length} source records)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="px-3 py-1.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-border"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Tweak Styles
                  </button>
                </div>
              </div>

              {/* Chart Instance Ref Canvas Container */}
              <div className="flex-1 border border-border rounded-2xl bg-card p-4 shadow-sm relative overflow-hidden flex items-center justify-center">
                <div ref={chartRef} className="w-full h-full min-h-[480px]" />
              </div>
            </div>

            {/* Scientific Export Sidebar */}
            <div className="w-[340px] bg-secondary/10 flex flex-col p-6 space-y-6 shrink-0 overflow-y-auto">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Download className="w-4 h-4 text-primary" />
                  Scientific Export
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  Export high-resolution figures ready for manuscript submission.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setExportFormat('png')}
                      className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors ${exportFormat === 'png' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-card border-border hover:bg-secondary/40 text-foreground'}`}
                    >
                      PNG (Raster)
                    </button>
                    <button
                      onClick={() => setExportFormat('svg')}
                      className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors ${exportFormat === 'svg' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-card border-border hover:bg-secondary/40 text-foreground'}`}
                    >
                      SVG (Vector)
                    </button>
                  </div>
                </div>

                {exportFormat === 'png' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Resolution (DPI Scale)</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map(s => (
                        <button
                          key={s}
                          onClick={() => setExportScale(s)}
                          className={`py-2 rounded-xl border font-extrabold text-xs transition-colors ${exportScale === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground'}`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      3x scale produces 300+ DPI images for IEEE, Nature, and ACM print journals.
                    </p>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={handleExportChart}
                    className="w-full py-3 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    Download Figure ({exportFormat.toUpperCase()})
                  </button>
                </div>
              </div>

              <div className="p-4 bg-card border border-border rounded-xl space-y-2 text-xs text-foreground mt-auto">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Manuscript Citation Info
                </span>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Exported vector SVG graphics can be directly embedded into LaTeX documents or edited losslessly in Adobe Illustrator.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="w-full py-2 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-border"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Customize
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
