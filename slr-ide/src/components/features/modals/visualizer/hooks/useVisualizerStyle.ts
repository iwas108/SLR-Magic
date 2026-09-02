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
  const [titleFontSize, setTitleFontSize] = useState<number>(16);
  const [titleFontWeight, setTitleFontWeight] = useState<'normal' | '500' | '600' | 'bold' | '700' | '800' | '900'>('bold');
  const [titleFontStyle, setTitleFontStyle] = useState<'normal' | 'italic'>('normal');
  const [titleColor, setTitleColor] = useState<string>('');
  const [titleAlign, setTitleAlign] = useState<'left' | 'center' | 'right'>('center');
  const [subtitleFontSize, setSubtitleFontSize] = useState<number>(12);
  const [subtitleFontWeight, setSubtitleFontWeight] = useState<'normal' | '500' | '600' | 'bold' | '700'>('normal');
  const [subtitleFontStyle, setSubtitleFontStyle] = useState<'normal' | 'italic'>('normal');
  const [subtitleColor, setSubtitleColor] = useState<string>('');
  const [subtitleLineHeight, setSubtitleLineHeight] = useState<number>(16);
  const [titleGap, setTitleGap] = useState<number>(4);

  // Global Academic Typography & Palette
  const [themePreset, setThemePreset] = useState<ThemePreset>('ieee_blue');
  const [fontFamily, setFontFamily] = useState<FontFamily>('roboto');
  const [fontSize, setFontSize] = useState<number>(13);

  // Multi-Block Journal Subfigure Formatting
  const [subfigureLabelStyle, setSubfigureLabelStyle] = useState<SubfigureLabelStyle>('paren_lower');
  const [subfigureLabelFontSize, setSubfigureLabelFontSize] = useState<number>(12);
  const [subfigureLabelFontWeight, setSubfigureLabelFontWeight] = useState<'normal' | 'bold' | '800'>('bold');
  const [panelGutter, setPanelGutter] = useState<number>(16);
  const [showPanelBorders, setShowPanelBorders] = useState<boolean>(false);

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
    titleFontSize,
    titleFontWeight,
    titleFontStyle,
    titleColor,
    titleAlign,
    subtitleFontSize,
    subtitleFontWeight,
    subtitleFontStyle,
    subtitleColor,
    subtitleLineHeight,
    titleGap,
    subfigureLabelStyle,
    subfigureLabelFontSize,
    subfigureLabelFontWeight,
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
    if (typeof config.titleFontSize === 'number') setTitleFontSize(config.titleFontSize);
    if (config.titleFontWeight) setTitleFontWeight(config.titleFontWeight);
    if (config.titleFontStyle) setTitleFontStyle(config.titleFontStyle);
    if (config.titleColor !== undefined) setTitleColor(config.titleColor);
    if (config.titleAlign) setTitleAlign(config.titleAlign);
    if (typeof config.subtitleFontSize === 'number') setSubtitleFontSize(config.subtitleFontSize);
    if (config.subtitleFontWeight) setSubtitleFontWeight(config.subtitleFontWeight);
    if (config.subtitleFontStyle) setSubtitleFontStyle(config.subtitleFontStyle);
    if (config.subtitleColor !== undefined) setSubtitleColor(config.subtitleColor);
    if (typeof config.subtitleLineHeight === 'number') setSubtitleLineHeight(config.subtitleLineHeight);
    if (typeof config.titleGap === 'number') setTitleGap(config.titleGap);
    if (config.subfigureLabelStyle) setSubfigureLabelStyle(config.subfigureLabelStyle);
    if (typeof config.subfigureLabelFontSize === 'number') setSubfigureLabelFontSize(config.subfigureLabelFontSize);
    if (config.subfigureLabelFontWeight) setSubfigureLabelFontWeight(config.subfigureLabelFontWeight);
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
    titleFontSize,
    setTitleFontSize,
    titleFontWeight,
    setTitleFontWeight,
    titleFontStyle,
    setTitleFontStyle,
    titleColor,
    setTitleColor,
    titleAlign,
    setTitleAlign,
    subtitleFontSize,
    setSubtitleFontSize,
    subtitleFontWeight,
    setSubtitleFontWeight,
    subtitleFontStyle,
    setSubtitleFontStyle,
    subtitleColor,
    setSubtitleColor,
    subtitleLineHeight,
    setSubtitleLineHeight,
    titleGap,
    setTitleGap,
    themePreset,
    setThemePreset,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    subfigureLabelStyle,
    setSubfigureLabelStyle,
    subfigureLabelFontSize,
    setSubfigureLabelFontSize,
    subfigureLabelFontWeight,
    setSubfigureLabelFontWeight,
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
