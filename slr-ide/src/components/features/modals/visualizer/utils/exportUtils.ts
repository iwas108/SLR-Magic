import * as echarts from 'echarts';
import { THEME_PALETTES } from '../constants/themePalettes';
import { resolveFontFamilyCss } from '../constants/fontFamilies';
import { formatSubfigureLabel } from '../constants/layoutPresets';
import { exportSvgToPdf } from '@/lib/services/pdf-export-service';
import type { 
  ChartType, 
  ThemePreset, 
  FontFamily, 
  LayoutMode, 
  SlotId, 
  SlotConfig, 
  SubfigureLabelStyle,
  AspectRatioPreset,
  DimensionUnit,
  ExportFormat
} from '../types';

export interface ExportChartOptions {
  chartInstance: echarts.ECharts | null;
  chartType: ChartType;
  exportFormat: ExportFormat;
  exportScale: number;
  themePreset: ThemePreset;
  chartScale?: number;
  panX?: number;
  panY?: number;
  fitOffsetX?: number;
  fitOffsetY?: number;
  containerPadding?: number;
  tiltAngle: number;
  rotationAngle: number;
  subTitle?: string;
}

export interface ExportMultiPanelOptions {
  layoutMode: LayoutMode;
  activeSlotsList: SlotId[];
  chartInstances: Record<SlotId, echarts.ECharts | null>;
  slotsConfig: Record<SlotId, SlotConfig>;
  exportFormat: ExportFormat;
  exportScale: number;
  themePreset: ThemePreset;
  fontFamily: FontFamily;
  fontSize: number;
  chartTitle: string;
  chartSubtitle: string;
  showChartTitle: boolean;
  showChartSubtitle: boolean;
  subfigureLabelStyle: SubfigureLabelStyle;
  panelGutter: number;
  showPanelBorders: boolean;
  aspectRatio?: AspectRatioPreset;
  customWidth?: number;
  customHeight?: number;
  dimensionUnit?: DimensionUnit;
  chartScale?: number;
  panX?: number;
  panY?: number;
  fitOffsetX?: number;
  fitOffsetY?: number;
  containerPadding?: number;
  tiltAngle: number;
  rotationAngle: number;
  generateSlotOption?: (slotId: SlotId) => echarts.EChartsOption;
}

export function resolveTargetDimensions(
  aspectRatio: AspectRatioPreset = '16:9',
  customWidth: number = 190,
  customHeight: number = 107,
  dimensionUnit: DimensionUnit = 'mm',
  baseWidth: number = 1200
): { targetWidth: number; targetHeight: number; aspectLabel: string } {
  let targetWidth = baseWidth;
  let targetHeight = Math.round(baseWidth * (9 / 16));
  let aspectLabel = '16:9';

  if (aspectRatio === '16:9') {
    targetWidth = 1200;
    targetHeight = 675;
    aspectLabel = '16:9 (Double Column / 190mm)';
  } else if (aspectRatio === '16:10') {
    targetWidth = 1200;
    targetHeight = 750;
    aspectLabel = '16:10 (1.5 Column / 140mm)';
  } else if (aspectRatio === '4:3') {
    targetWidth = 1000;
    targetHeight = 750;
    aspectLabel = '4:3 (Single Column / 90mm)';
  } else if (aspectRatio === '3:2') {
    targetWidth = 1200;
    targetHeight = 800;
    aspectLabel = '3:2 (Academic Standard)';
  } else if (aspectRatio === '1:1') {
    targetWidth = 900;
    targetHeight = 900;
    aspectLabel = '1:1 (Square Panel / 90mm)';
  } else if (aspectRatio === '21:9') {
    targetWidth = 1400;
    targetHeight = 600;
    aspectLabel = '21:9 (Ultra-Wide Panorama)';
  } else if (aspectRatio === 'custom') {
    let pxW = customWidth;
    let pxH = customHeight;
    if (dimensionUnit === 'mm') {
      pxW = Math.round((customWidth / 25.4) * 300);
      pxH = Math.round((customHeight / 25.4) * 300);
    } else if (dimensionUnit === 'in') {
      pxW = Math.round(customWidth * 300);
      pxH = Math.round(customHeight * 300);
    }
    targetWidth = Math.max(400, Math.min(4800, pxW));
    targetHeight = Math.max(300, Math.min(3600, pxH));
    aspectLabel = `Custom (${customWidth}x${customHeight} ${dimensionUnit})`;
  } else {
    targetWidth = baseWidth;
    targetHeight = Math.round(baseWidth * (9 / 16));
    aspectLabel = 'Responsive Auto';
  }

  return { targetWidth, targetHeight, aspectLabel };
}

// Single Subfigure Export
export async function exportFigure(options: ExportChartOptions): Promise<void> {
  const {
    chartInstance,
    chartType,
    exportFormat,
    exportScale,
    themePreset,
    chartScale = 1.0,
    panX = 0,
    panY = 0,
    tiltAngle,
    rotationAngle,
    subTitle
  } = options;

  if (!chartInstance) return;

  const bg = THEME_PALETTES[themePreset]?.bg || '#ffffff';
  const normScale = chartScale > 10 ? chartScale / 100 : (chartScale || 1.0);
  const hasTransform = normScale !== 1.0 || panX !== 0 || panY !== 0 || tiltAngle !== 0 || rotationAngle !== 0;
  const cleanTitle = (subTitle || chartType).replace(/[^a-zA-Z0-9_-]/g, '_');

  if (exportFormat === 'svg' || exportFormat === 'pdf') {
    const svgData = chartInstance.renderToSVGString();
    let finalSvg = svgData;
    if (hasTransform) {
      const radX = (tiltAngle * Math.PI) / 180;
      const scaleY = (normScale * Math.cos(radX)).toFixed(3);
      const scaleX = normScale.toFixed(3);
      const transformStr = `rotate(${rotationAngle}) scale(${scaleX}, ${scaleY})`;
      finalSvg = svgData.replace(/<g>/, `<g transform="${transformStr}">`);
    }

    if (exportFormat === 'pdf') {
      await exportSvgToPdf(finalSvg, {
        filename: `slr_figure_${cleanTitle}_${Date.now()}.pdf`,
        marginMm: 0
      });
      return;
    }

    const blob = new Blob([finalSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slr_figure_${cleanTitle}_${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const rawDataUrl = chartInstance.getDataURL({
      type: 'png',
      pixelRatio: exportScale,
      backgroundColor: bg
    });

    const cleanTitle = (subTitle || chartType).replace(/[^a-zA-Z0-9_-]/g, '_');

    if (!hasTransform) {
      const a = document.createElement('a');
      a.href = rawDataUrl;
      a.download = `slr_figure_${cleanTitle}_${exportScale}x_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          
          const offsetX = (panX / 100) * canvas.width;
          const offsetY = (panY / 100) * canvas.height;
          ctx.translate(offsetX, offsetY);
          ctx.scale(normScale, normScale);

          const radX = (tiltAngle * Math.PI) / 180;
          const radZ = (rotationAngle * Math.PI) / 180;
          ctx.scale(1, Math.cos(radX));
          ctx.rotate(radZ);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          ctx.restore();

          const transformedDataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = transformedDataUrl;
          a.download = `slr_figure_${cleanTitle}_${exportScale}x_3D_${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      };
      img.src = rawDataUrl;
    }
  }
}

interface SlotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function calculateSlotRects(
  layoutMode: LayoutMode,
  activeSlotsList: SlotId[],
  stageWidth: number,
  stageHeight: number,
  gutter: number
): Record<SlotId, SlotRect> {
  const rects: Partial<Record<SlotId, SlotRect>> = {};
  const g = gutter;

  if (layoutMode === 'single') {
    rects.slot_a = { x: 0, y: 0, width: stageWidth, height: stageHeight };
  } else if (layoutMode === 'dual_horizontal') {
    const colWidth = (stageWidth - g) / 2;
    rects.slot_a = { x: 0, y: 0, width: colWidth, height: stageHeight };
    rects.slot_b = { x: colWidth + g, y: 0, width: colWidth, height: stageHeight };
  } else if (layoutMode === 'dual_vertical') {
    const rowHeight = (stageHeight - g) / 2;
    rects.slot_a = { x: 0, y: 0, width: stageWidth, height: rowHeight };
    rects.slot_b = { x: 0, y: rowHeight + g, width: stageWidth, height: rowHeight };
  } else if (layoutMode === 'tri_top_two_bottom') {
    const rowHeight = (stageHeight - g) / 2;
    const colWidth = (stageWidth - g) / 2;
    rects.slot_a = { x: 0, y: 0, width: stageWidth, height: rowHeight };
    rects.slot_b = { x: 0, y: rowHeight + g, width: colWidth, height: rowHeight };
    rects.slot_c = { x: colWidth + g, y: rowHeight + g, width: colWidth, height: rowHeight };
  } else if (layoutMode === 'quad_grid') {
    const colWidth = (stageWidth - g) / 2;
    const rowHeight = (stageHeight - g) / 2;
    rects.slot_a = { x: 0, y: 0, width: colWidth, height: rowHeight };
    rects.slot_b = { x: colWidth + g, y: 0, width: colWidth, height: rowHeight };
    rects.slot_c = { x: 0, y: rowHeight + g, width: colWidth, height: rowHeight };
    rects.slot_d = { x: colWidth + g, y: rowHeight + g, width: colWidth, height: rowHeight };
  }

  return rects as Record<SlotId, SlotRect>;
}

// 100% Zero-Distortion Native Off-Screen Multi-Panel Composite Export Engine (PNG & SVG)
export async function exportMultiPanelFigure(options: ExportMultiPanelOptions): Promise<void> {
  const {
    layoutMode,
    activeSlotsList,
    chartInstances,
    slotsConfig,
    exportFormat,
    exportScale,
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
    aspectRatio = '16:9',
    customWidth = 190,
    customHeight = 107,
    dimensionUnit = 'mm',
    chartScale = 1.0,
    panX = 0,
    panY = 0,
    tiltAngle,
    rotationAngle,
    generateSlotOption
  } = options;

  const palette = THEME_PALETTES[themePreset] || THEME_PALETTES.ieee_blue;
  const font = resolveFontFamilyCss(fontFamily);
  const bg = palette.bg || '#ffffff';

  // Compute Base Physical Geometry based on Aspect Ratio Preset
  const { targetWidth: baseWidth, targetHeight: baseHeight } = resolveTargetDimensions(
    aspectRatio,
    customWidth,
    customHeight,
    dimensionUnit,
    1200
  );

  const hasMainHeader = (showChartTitle && chartTitle) || (showChartSubtitle && chartSubtitle);
  const headerHeight = hasMainHeader ? 70 : 0;
  const outerPadding = typeof options.containerPadding === 'number' ? options.containerPadding : 20;

  const stageWidth = baseWidth - outerPadding * 2;
  const stageHeight = baseHeight - outerPadding * 2 - headerHeight;

  const slotRects = calculateSlotRects(layoutMode, activeSlotsList, stageWidth, stageHeight, panelGutter);

  const normScale = chartScale > 10 ? chartScale / 100 : (chartScale || 1.0);
  const hasTransform = normScale !== 1.0 || panX !== 0 || panY !== 0 || tiltAngle !== 0 || rotationAngle !== 0;

  if (exportFormat === 'png') {
    const scale = exportScale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(baseWidth * scale);
    canvas.height = Math.round(baseHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(scale, scale);

    // Render Global Figure Title & Subtitle Header
    if (hasMainHeader) {
      ctx.fillStyle = palette.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      if (showChartTitle && chartTitle) {
        ctx.font = `bold ${fontSize + 5}px ${font}`;
        ctx.fillText(chartTitle, baseWidth / 2, outerPadding);
      }

      if (showChartSubtitle && chartSubtitle) {
        ctx.fillStyle = palette.subtext || '#64748b';
        ctx.font = `${fontSize}px ${font}`;
        ctx.fillText(chartSubtitle, baseWidth / 2, outerPadding + (showChartTitle ? fontSize + 9 : 0));
      }
    }

    // Render Each Subfigure at Exact Destination Slot Rect via Off-Screen ECharts Instance
    for (let index = 0; index < activeSlotsList.length; index++) {
      const slotId = activeSlotsList[index];
      const rect = slotRects[slotId];
      if (!rect) continue;

      const drawX = outerPadding + rect.x;
      const drawY = outerPadding + headerHeight + rect.y;

      // Panel Background & Border
      if (showPanelBorders) {
        ctx.strokeStyle = palette.border || '#cbd5e1';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(drawX, drawY, rect.width, rect.height);
      }

      // Subfigure Label Badge (e.g. "(a) RQ1 Computational Topologies")
      const subLabel = formatSubfigureLabel(index, subfigureLabelStyle);
      const cfg = slotsConfig[slotId];
      const panelTitle = cfg?.subTitle ? `${subLabel ? `${subLabel} ` : ''}${cfg.subTitle}` : subLabel;

      if (panelTitle && layoutMode !== 'single') {
        ctx.fillStyle = palette.text;
        ctx.font = `bold ${fontSize + 1}px ${font}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(panelTitle, drawX + 8, drawY + 8);
      }

      const chartOffsetY = (panelTitle && layoutMode !== 'single') ? 26 : 4;
      const chartW = Math.round(rect.width - 8);
      const chartH = Math.round(rect.height - chartOffsetY - 4);

      // Create Headless Off-Screen ECharts Container sized to the EXACT slot rectangle
      const offscreenDiv = document.createElement('div');
      offscreenDiv.style.width = `${chartW}px`;
      offscreenDiv.style.height = `${chartH}px`;
      offscreenDiv.style.position = 'fixed';
      offscreenDiv.style.left = '-9999px';
      offscreenDiv.style.top = '-9999px';
      offscreenDiv.style.visibility = 'hidden';
      document.body.appendChild(offscreenDiv);

      let dataUrl: string | null = null;

      try {
        const offInstance = echarts.init(offscreenDiv, undefined, {
          renderer: 'canvas',
          width: chartW,
          height: chartH
        });

        const option = generateSlotOption
          ? generateSlotOption(slotId)
          : (chartInstances[slotId]?.getOption() as echarts.EChartsOption);

        if (option) {
          offInstance.setOption({
            ...option,
            animation: false,
            animationDuration: 0,
            animationDurationUpdate: 0
          }, true);

          // Render at target device pixel ratio (scale: 1x, 2x, 3x, 4x)
          dataUrl = offInstance.getDataURL({
            type: 'png',
            pixelRatio: scale,
            backgroundColor: 'transparent'
          });
        }

        offInstance.dispose();
      } catch (err) {
        console.error(`Failed native render for ${slotId}:`, err);
      } finally {
        if (document.body.contains(offscreenDiv)) {
          document.body.removeChild(offscreenDiv);
        }
      }

      if (dataUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            // Drawn at exact 1:1 aspect ratio with zero distortion!
            ctx.drawImage(
              img,
              drawX + 4,
              drawY + chartOffsetY,
              chartW,
              chartH
            );
            resolve();
          };
          img.onerror = () => resolve();
          img.src = dataUrl!;
        });
      }
    }

    ctx.restore();

    // 3D Perspective Pitch, Zoom Scale, Pan Translation & Rotation Transform
    let finalDataUrl = canvas.toDataURL('image/png');

    if (hasTransform) {
      const transformCanvas = document.createElement('canvas');
      transformCanvas.width = canvas.width;
      transformCanvas.height = canvas.height;
      const tCtx = transformCanvas.getContext('2d');
      if (tCtx) {
        tCtx.fillStyle = bg;
        tCtx.fillRect(0, 0, transformCanvas.width, transformCanvas.height);
        tCtx.save();
        tCtx.translate(transformCanvas.width / 2, transformCanvas.height / 2);
        
        // Pan offset
        const offsetX = ((panX || 0) / 100) * transformCanvas.width;
        const offsetY = ((panY || 0) / 100) * transformCanvas.height;
        tCtx.translate(offsetX, offsetY);

        // Zoom scale
        tCtx.scale(normScale, normScale);

        // 3D Tilt pitch and Z-rotation
        const radX = (tiltAngle * Math.PI) / 180;
        const radZ = (rotationAngle * Math.PI) / 180;
        tCtx.scale(1, Math.cos(radX));
        tCtx.rotate(radZ);

        tCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        tCtx.restore();
        finalDataUrl = transformCanvas.toDataURL('image/png');
      }
    }

    // Trigger Download
    const a = document.createElement('a');
    a.href = finalDataUrl;
    const cleanTitle = (chartTitle || 'composite_figure').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `slr_figure_${cleanTitle}_${aspectRatio}_${exportScale}x_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    // Vector SVG Composite Export with Native Sizing
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${baseWidth}" height="${baseHeight}" viewBox="0 0 ${baseWidth} ${baseHeight}">\n`;
    svgContent += `  <rect width="100%" height="100%" fill="${bg}" />\n`;

    if (hasMainHeader) {
      if (showChartTitle && chartTitle) {
        svgContent += `  <text x="${baseWidth / 2}" y="${outerPadding + fontSize + 4}" text-anchor="middle" font-family="${font}" font-size="${fontSize + 5}" font-weight="bold" fill="${palette.text}">${chartTitle}</text>\n`;
      }
      if (showChartSubtitle && chartSubtitle) {
        svgContent += `  <text x="${baseWidth / 2}" y="${outerPadding + (showChartTitle ? fontSize + 22 : fontSize + 4)}" text-anchor="middle" font-family="${font}" font-size="${fontSize}" fill="${palette.subtext || '#64748b'}">${chartSubtitle}</text>\n`;
      }
    }

    for (let index = 0; index < activeSlotsList.length; index++) {
      const slotId = activeSlotsList[index];
      const rect = slotRects[slotId];
      if (!rect) continue;

      const drawX = outerPadding + rect.x;
      const drawY = outerPadding + headerHeight + rect.y;

      if (showPanelBorders) {
        svgContent += `  <rect x="${drawX}" y="${drawY}" width="${rect.width}" height="${rect.height}" fill="none" stroke="${palette.border || '#cbd5e1'}" stroke-width="1.2" />\n`;
      }

      const subLabel = formatSubfigureLabel(index, subfigureLabelStyle);
      const cfg = slotsConfig[slotId];
      const panelTitle = cfg?.subTitle ? `${subLabel ? `${subLabel} ` : ''}${cfg.subTitle}` : subLabel;

      if (panelTitle && layoutMode !== 'single') {
        svgContent += `  <text x="${drawX + 8}" y="${drawY + fontSize + 6}" font-family="${font}" font-size="${fontSize + 1}" font-weight="bold" fill="${palette.text}">${panelTitle}</text>\n`;
      }

      const chartOffsetY = (panelTitle && layoutMode !== 'single') ? 26 : 4;
      const chartW = Math.round(rect.width - 8);
      const chartH = Math.round(rect.height - chartOffsetY - 4);

      const offscreenDiv = document.createElement('div');
      offscreenDiv.style.width = `${chartW}px`;
      offscreenDiv.style.height = `${chartH}px`;
      offscreenDiv.style.position = 'fixed';
      offscreenDiv.style.left = '-9999px';
      offscreenDiv.style.visibility = 'hidden';
      document.body.appendChild(offscreenDiv);

      try {
        const offInstance = echarts.init(offscreenDiv, undefined, {
          renderer: 'svg',
          width: chartW,
          height: chartH
        });

        const option = generateSlotOption
          ? generateSlotOption(slotId)
          : (chartInstances[slotId]?.getOption() as echarts.EChartsOption);

        if (option) {
          offInstance.setOption({
            ...option,
            animation: false,
            animationDuration: 0,
            animationDurationUpdate: 0
          }, true);
          const rawSvg = offInstance.renderToSVGString();
          svgContent += `  <g transform="translate(${drawX + 4}, ${drawY + chartOffsetY})">\n    ${rawSvg}\n  </g>\n`;
        }

        offInstance.dispose();
      } catch (err) {
        console.error(`Failed SVG native render for ${slotId}:`, err);
      } finally {
        if (document.body.contains(offscreenDiv)) {
          document.body.removeChild(offscreenDiv);
        }
      }
    }

    if (hasTransform) {
      const radX = (tiltAngle * Math.PI) / 180;
      const scaleY = (normScale * Math.cos(radX)).toFixed(3);
      const scaleX = normScale.toFixed(3);
      const offsetX = (((panX || 0) / 100) * baseWidth).toFixed(1);
      const offsetY = (((panY || 0) / 100) * baseHeight).toFixed(1);
      const transformStr = `translate(${baseWidth / 2 + Number(offsetX)}, ${baseHeight / 2 + Number(offsetY)}) rotate(${rotationAngle}) scale(${scaleX}, ${scaleY}) translate(${-baseWidth / 2}, ${-baseHeight / 2})`;
      svgContent = svgContent.replace(/<svg(.*?)>/, `<svg$1>\n  <g transform="${transformStr}">`);
      svgContent = svgContent.replace(/<\/svg>/, `  </g>\n</svg>`);
    } else {
      svgContent += `</svg>`;
    }

    const cleanTitle = (chartTitle || 'composite_figure').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (exportFormat === 'pdf') {
      await exportSvgToPdf(svgContent, {
        filename: `slr_figure_${cleanTitle}_${aspectRatio}_${Date.now()}.pdf`,
        marginMm: 0
      });
      return;
    }

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slr_figure_${cleanTitle}_${aspectRatio}_${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
