import { 
  BarChart2, 
  Layers, 
  TrendingUp, 
  PieChart, 
  ScatterChart, 
  Sparkles, 
  Grid, 
  Sliders, 
  RefreshCw, 
  Target, 
  Filter, 
  Share2, 
  Gauge, 
  Calendar 
} from 'lucide-react';
import type { ChartType, ChartTypeMeta } from '../types';

export const CHART_TYPES_INFO: Record<ChartType, ChartTypeMeta> = {
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
  clustered_bar: {
    name: 'Clustered / Comparative Bar Chart',
    category: 'Comparative / Multi-Series',
    description: 'Compares secondary series groups side-by-side across primary categories with horizontal or vertical orientation.',
    slrUseCase: 'Best for comparing Research Methods across Application Domains, Study Designs per Year, or Multi-Group Quality Metrics.',
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
    category: 'Benchmark Gap & Multi-Variable',
    description: 'Plots multi-axis variable reporting frequencies against benchmark requirements or QA dimensions.',
    slrUseCase: 'Ideal for Boundary Reporting Paradox analysis (empirical cohort baseline vs. target requirements) and QA profiling.',
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
