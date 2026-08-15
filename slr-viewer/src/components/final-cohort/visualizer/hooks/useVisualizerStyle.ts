import { useState } from 'react';
import type { 
  ThemePreset, 
  FontFamily, 
  SubfigureLabelStyle, 
  GlobalStyleConfig, 
  LayoutMode, 
  AspectRatioPreset, 
  DimensionUnit,
  DecimalPrecision,
  RatioStyle,
  DisplayFormatTemplate
} from '../types';

export function useVisualizerStyle() {
  // Global Figure Title & Header
  const [chartTitle, setChartTitle] = useState<string>('Systematic Review Synthesis');
  const [chartSubtitle, setChartSubtitle] = useState<string>('Comprehensive Multidimensional Analysis');
  const [showChartTitle, setShowChartTitle] = useState<boolean>(true);
  const [showChartSubtitle, setShowChartSubtitle] = useState<boolean>(true);

  // Global Academic Typography & Palette
  const [themePreset, setThemePreset] = useState<ThemePreset>('ieee_blue');
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');
  const [fontSize, setFontSize] = useState<number>(13);

  // Multi-Block Journal Subfigure Formatting
  const [subfigureLabelStyle, setSubfigureLabelStyle] = useState<SubfigureLabelStyle>('paren_lower');
  const [panelGutter, setPanelGutter] = useState<number>(16);
  const [showPanelBorders, setShowPanelBorders] = useState<boolean>(true);

  // Journal Publication Aspect Ratio & Column Dimensions
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>('16:9');
  const [customWidth, setCustomWidth] = useState<number>(190);
  const [customHeight, setCustomHeight] = useState<number>(107);
  const [dimensionUnit, setDimensionUnit] = useState<DimensionUnit>('mm');

  // Reviewer Granularity & Precision Settings
  const [decimalPrecision, setDecimalPrecision] = useState<DecimalPrecision>(0);
  const [useTildeForCoarse, setUseTildeForCoarse] = useState<boolean>(true);
  const [ratioStyle, setRatioStyle] = useState<RatioStyle>('n_over_N');
  const [forceCohortDenominator, setForceCohortDenominator] = useState<boolean>(false);
  const [defaultLabelFormat, setDefaultLabelFormat] = useState<DisplayFormatTemplate>('ratio_percent');
  const [defaultLegendFormat, setDefaultLegendFormat] = useState<DisplayFormatTemplate>('name');

  const getGlobalStyleConfig = (layoutMode: LayoutMode): GlobalStyleConfig => ({
    layoutMode,
    themePreset,
    fontFamily,
    fontSize,
    chartTitle,
    chartSubtitle,
    showChartTitle,
    showChartSubtitle,
    subfigureLabelStyle,
    panelGutter,
    showPanelBorders,
    aspectRatio,
    customWidth,
    customHeight,
    dimensionUnit,
    decimalPrecision,
    useTildeForCoarse,
    ratioStyle,
    forceCohortDenominator,
    defaultLabelFormat,
    defaultLegendFormat
  });

  const setGlobalStyleConfig = (config: Partial<GlobalStyleConfig>) => {
    if (config.themePreset) setThemePreset(config.themePreset);
    if (config.fontFamily) setFontFamily(config.fontFamily);
    if (typeof config.fontSize === 'number') setFontSize(config.fontSize);
    if (config.chartTitle !== undefined) setChartTitle(config.chartTitle);
    if (config.chartSubtitle !== undefined) setChartSubtitle(config.chartSubtitle);
    if (typeof config.showChartTitle === 'boolean') setShowChartTitle(config.showChartTitle);
    if (typeof config.showChartSubtitle === 'boolean') setShowChartSubtitle(config.showChartSubtitle);
    if (config.subfigureLabelStyle) setSubfigureLabelStyle(config.subfigureLabelStyle);
    if (typeof config.panelGutter === 'number') setPanelGutter(config.panelGutter);
    if (typeof config.showPanelBorders === 'boolean') setShowPanelBorders(config.showPanelBorders);
    if (config.aspectRatio) setAspectRatio(config.aspectRatio);
    if (typeof config.customWidth === 'number') setCustomWidth(config.customWidth);
    if (typeof config.customHeight === 'number') setCustomHeight(config.customHeight);
    if (config.dimensionUnit) setDimensionUnit(config.dimensionUnit);
    if (config.decimalPrecision !== undefined) setDecimalPrecision(config.decimalPrecision);
    if (typeof config.useTildeForCoarse === 'boolean') setUseTildeForCoarse(config.useTildeForCoarse);
    if (config.ratioStyle) setRatioStyle(config.ratioStyle);
    if (typeof config.forceCohortDenominator === 'boolean') setForceCohortDenominator(config.forceCohortDenominator);
    if (config.defaultLabelFormat) setDefaultLabelFormat(config.defaultLabelFormat);
    if (config.defaultLegendFormat) setDefaultLegendFormat(config.defaultLegendFormat);
  };

  return {
    chartTitle,
    setChartTitle,
    chartSubtitle,
    setChartSubtitle,
    showChartTitle,
    setShowChartTitle,
    showChartSubtitle,
    setShowChartSubtitle,
    themePreset,
    setThemePreset,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    subfigureLabelStyle,
    setSubfigureLabelStyle,
    panelGutter,
    setPanelGutter,
    showPanelBorders,
    setShowPanelBorders,
    aspectRatio,
    setAspectRatio,
    customWidth,
    setCustomWidth,
    customHeight,
    setCustomHeight,
    dimensionUnit,
    setDimensionUnit,
    decimalPrecision,
    setDecimalPrecision,
    useTildeForCoarse,
    setUseTildeForCoarse,
    ratioStyle,
    setRatioStyle,
    forceCohortDenominator,
    setForceCohortDenominator,
    defaultLabelFormat,
    setDefaultLabelFormat,
    defaultLegendFormat,
    setDefaultLegendFormat,
    getGlobalStyleConfig,
    setGlobalStyleConfig
  };
}
