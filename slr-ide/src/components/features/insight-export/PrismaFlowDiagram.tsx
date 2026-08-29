'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Settings, Sparkles, ChevronDown, FileCode, FileText, Image as ImageIcon } from 'lucide-react';
import PrismaConfigModal, { PrismaConfig } from '@/components/features/modals/PrismaConfigModal';
import { generatePrismaSvg } from '@/lib/services/prisma-svg-generator';
import { exportSvgToPdf } from '@/lib/services/pdf-export-service';

export interface PrismaFlowDiagramProps {
  projectId?: string;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  prismaData?: any;
  projectName?: string;
}

const DEFAULT_CONFIG: PrismaConfig = {
  collapseEmptyColumn: true,
  colorTheme: 'appTheme',
  fontFamily: 'Inter, system-ui, sans-serif',
  baseFontSize: 22,
  boxBorderRadius: 8,
  boxPadding: 20,
  exportScale: 1
};

export default function PrismaFlowDiagram({ projectId, showToast, prismaData, projectName }: PrismaFlowDiagramProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<PrismaConfig>(DEFAULT_CONFIG);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load configuration from localStorage
  useEffect(() => {
    const configKey = projectId ? `slr_prisma_config_${projectId}` : 'slr_prisma_config_default';
    const saved = localStorage.getItem(configKey);
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved prisma config', e);
      }
    } else {
      setConfig(DEFAULT_CONFIG);
    }
  }, [projectId]);

  const handleConfigChange = (newConfig: PrismaConfig) => {
    setConfig(newConfig);
    const configKey = projectId ? `slr_prisma_config_${projectId}` : 'slr_prisma_config_default';
    localStorage.setItem(configKey, JSON.stringify(newConfig));
  };

  useEffect(() => {
    if (prismaData) {
      setData(prismaData);
      setLoading(false);
      return;
    }

    async function fetchData() {
      if (!projectId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/insight/prisma?projectId=${projectId}`);
        if (!res.ok) throw new Error('Failed to fetch PRISMA data');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        if (showToast) showToast(err.message || 'Error fetching PRISMA data', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId, showToast, prismaData]);

  const drawPrisma = () => {
    if (!canvasRef.current || !data) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // "Other Methods" total calculation
    const otherMethodsTotal = (data.totalOtherRecordsIdentified || 0) + (data.otherReportsSought || 0) + (data.otherDuplicatesRemoved || 0);
    const isCollapsed = config.collapseEmptyColumn && otherMethodsTotal === 0;

    // Define base coordinates mapping
    const startX = isCollapsed ? 500 : 200;
    const boxWidth = isCollapsed ? 650 : 500;
    const gap = isCollapsed ? 750 : 540; // distance from main flow to exclusion flow
    const leftPhaseLabelX = isCollapsed ? 300 : 80;

    const mainFlowCenter = startX + boxWidth / 2;
    const mainFlowRight = startX + boxWidth;
    const exclusionFlowLeft = startX + gap;
    const headerWidth = isCollapsed ? 1400 : 1040;
    const headerCenter = startX + headerWidth / 2;

    const baseWidth = 2400;
    const verticalGap = 40;
    const bottomPadding = 40;

    // Colors mapping based on theme styles
    let bg = '#ffffff';
    let textMain = '#1e293b';
    let textMuted = '#64748b';
    let border = '#cbd5e1';
    let cardBg = '#f8fafc';
    let goldHeader = '#fef08a';
    let goldHeaderText = '#854d0e';
    let headerBorder = '#facc15';
    let labelBg = '#dbeafe';
    let labelText = '#1e40af';
    let arrowColor = '#64748b';
    let borderWidth = 2;

    if (config.colorTheme === 'appTheme') {
      const isDark = document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark');

      bg = isDark ? '#0f172a' : '#ffffff';
      textMain = isDark ? '#f8fafc' : '#0f172a';
      textMuted = isDark ? '#94a3b8' : '#475569';
      border = isDark ? '#334155' : '#cbd5e1';
      cardBg = isDark ? '#1e293b' : '#f8fafc';
      goldHeader = isDark ? '#451a03' : '#fef08a';
      goldHeaderText = isDark ? '#fef08a' : '#854d0e';
      headerBorder = isDark ? '#d97706' : '#facc15';
      labelBg = isDark ? '#1e3a8a' : '#dbeafe';
      labelText = isDark ? '#93c5fd' : '#1e40af';
      arrowColor = textMuted;
      borderWidth = 2;
    } else {
      // Strict publication monochrome
      bg = '#ffffff';
      textMain = '#000000';
      textMuted = '#000000';
      border = '#000000';
      cardBg = '#ffffff';
      goldHeader = '#ffffff';
      goldHeaderText = '#000000';
      headerBorder = '#000000';
      labelBg = '#ffffff';
      labelText = '#000000';
      arrowColor = '#000000';
      borderWidth = 1.5;
    }

    // Helpers
    const drawRoundRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      fill: string,
      stroke: string,
      lw = borderWidth
    ) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    };

    const drawArrow = (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      color: string,
      lw = 3
    ) => {
      const headLength = 16;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx);

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    const wrapText = (
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      lineHeight: number,
      fontWeight = 'normal',
      color = textMain,
      measureOnly = false
    ) => {
      if (!measureOnly) {
        ctx.fillStyle = color;
      }
      ctx.font = `${fontWeight} ${config.baseFontSize}px ${config.fontFamily}`;

      const lines = text.split('\n');
      let currentY = y;

      for (const line of lines) {
        const words = line.split(' ');
        let currentLine = '';

        for (let n = 0; n < words.length; n++) {
          const testLine = currentLine + words[n] + ' ';
          const testWidth = ctx.measureText(testLine).width;
          if (testWidth > maxWidth && n > 0) {
            if (!measureOnly) {
              ctx.fillText(currentLine, x, currentY);
            }
            currentLine = words[n] + ' ';
            currentY += lineHeight;
          } else {
            currentLine = testLine;
          }
        }
        if (!measureOnly) {
          ctx.fillText(currentLine, x, currentY);
        }
        currentY += lineHeight;
      }
      return currentY;
    };

    const drawVerticalLabel = (text: string, yStart: number, yEnd: number) => {
      const x = leftPhaseLabelX;
      const yCenter = (yStart + yEnd) / 2;
      const labelWidth = 60;
      const labelHeight = yEnd - yStart;

      // Draw label background strip
      drawRoundRect(x - labelWidth / 2, yStart, labelWidth, labelHeight, config.boxBorderRadius, labelBg, border, borderWidth);

      // Draw vertical text
      ctx.save();
      ctx.translate(x, yCenter);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = labelText;
      ctx.font = `bold ${config.baseFontSize + 2}px ${config.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.toUpperCase(), 0, 0);
      ctx.restore();
    };

    const padding = config.boxPadding;
    const lhBold = Math.round(config.baseFontSize * 1.4);
    const lhNormal = Math.round(config.baseFontSize * 1.3);

    // ----------------------------------------------------
    // PASS 1: HEIGHT PRE-CALCULATION
    // ----------------------------------------------------

    // Row 1: Identification & Deduplication (Y = 130)
    // Box 1
    const dbSourcesText = (data.databaseSources || [])
      .map((s: any) => `${s.source} (n = ${s.count})`)
      .join('\n');
    let yMeas = 0;
    yMeas = wrapText('Records identified from:', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(dbSourcesText || 'No database papers', 0, yMeas + 5, boxWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const box1TextHeight = yMeas;

    // Box 2
    yMeas = 0;
    yMeas = wrapText('Records removed before screening:', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(
      `Duplicate records removed (n = ${data.dbDuplicatesRemoved || 0})\n` +
      `Records marked as ineligible by automation tools (n = 0)\n` +
      `Records removed for other reasons (n = 0)`,
      0, yMeas + 5, boxWidth - 2 * padding, lhNormal, undefined, undefined, true
    );
    const box2TextHeight = yMeas;

    // Box 13 (Other methods identified)
    let box13TextHeight = 0;
    if (!isCollapsed) {
      const otherSourcesText = (data.otherMethodsSources || [])
        .map((s: any) => `${s.source} (n = ${s.count})`)
        .join('\n');
      yMeas = 0;
      yMeas = wrapText('Records identified from:', 0, yMeas, 500 - 2 * padding, lhBold, 'bold', undefined, true);
      yMeas = wrapText(otherSourcesText || 'No records identified', 0, yMeas + 5, 500 - 2 * padding, lhNormal, undefined, undefined, true);
      box13TextHeight = yMeas;
    }

    // Box 14 (Other methods removed before screening)
    let box14TextHeight = 0;
    if (!isCollapsed) {
      yMeas = 0;
      yMeas = wrapText('Records removed before screening:', 0, yMeas, 500 - 2 * padding, lhBold, 'bold', undefined, true);
      yMeas = wrapText(
        `Duplicate records removed (n = ${data.otherDuplicatesRemoved || 0})\n` +
        `Records marked as ineligible by automation tools (n = 0)\n` +
        `Records removed for other reasons (n = 0)`,
        0, yMeas + 5, 500 - 2 * padding, lhNormal, undefined, undefined, true
      );
      box14TextHeight = yMeas;
    }

    const row1MaxTextHeight = Math.max(box1TextHeight, box2TextHeight, isCollapsed ? 0 : Math.max(box13TextHeight, box14TextHeight));
    const hRow1 = row1MaxTextHeight + padding * 2;

    // Row 2: Screening & Stage 1 Exclusions (Y = 470)
    // Box 5
    yMeas = 0;
    yMeas = wrapText(`Records screened (n = ${data.dbRecordsScreened || 0})`, 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    const box5TextHeight = yMeas;

    // Box 6
    const s1ExclusionsText = (data.dbStage1ExcludedByEC || [])
      .map((ec: any) => `${ec.code} (n = ${ec.count})`)
      .join(', ');
    yMeas = 0;
    wrapText(`Records excluded (n = ${data.dbStage1Excluded || 0})`, 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(s1ExclusionsText || 'No exclusions', 0, yMeas + lhBold, boxWidth - 2 * padding, lhNormal, 'normal', undefined, true);
    const box6TextHeight = yMeas;

    const row2MaxTextHeight = Math.max(box5TextHeight, box6TextHeight);
    const hRow2 = row2MaxTextHeight + padding * 2;

    // Row 3: Reports Sought & Not Retrieved (Y = 640)
    // Box 8
    yMeas = 0;
    wrapText('Reports sought for retrieval', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(`(n = ${data.dbReportsSought || 0})`, 0, yMeas + lhBold, boxWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const box8TextHeight = yMeas;

    // Box 9
    yMeas = 0;
    wrapText('Reports not retrieved', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(`(n = ${data.dbReportsNotRetrieved || 0})`, 0, yMeas + lhBold, boxWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const box9TextHeight = yMeas;

    // Box 16 (if not collapsed)
    let box16TextHeight = 0;
    if (!isCollapsed) {
      yMeas = 0;
      wrapText('Reports sought for retrieval', 0, yMeas, 500 - 2 * padding, lhBold, 'bold', undefined, true);
      box16TextHeight = wrapText(`(n = ${data.otherReportsSought || 0})`, 0, yMeas + lhBold, 500 - 2 * padding, lhNormal, undefined, undefined, true);
    }

    // Box 17 (if not collapsed)
    let box17TextHeight = 0;
    if (!isCollapsed) {
      yMeas = 0;
      wrapText('Reports not retrieved', 0, yMeas, 500 - 2 * padding, lhBold, 'bold', undefined, true);
      box17TextHeight = wrapText(`(n = ${data.otherReportsNotRetrieved || 0})`, 0, yMeas + lhBold, 500 - 2 * padding, lhNormal, undefined, undefined, true);
    }

    const row3MaxTextHeight = Math.max(
      box8TextHeight,
      box9TextHeight,
      isCollapsed ? 0 : box16TextHeight,
      isCollapsed ? 0 : box17TextHeight
    );
    const hRow3 = row3MaxTextHeight + padding * 2;

    // Row 4: Reports Assessed & Stage 2 Exclusions (Y = 810)
    // Box 10
    yMeas = 0;
    wrapText('Reports assessed for eligibility', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(`(n = ${data.dbReportsAssessed || 0})`, 0, yMeas + lhBold, boxWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const box10TextHeight = yMeas;

    // Box 11
    let dbExcludedLines: string[] = [];
    (data.dbReportsExcludedStage2 || []).forEach((ec: any) => {
      const desc = data.ecLabels?.[ec.code?.toUpperCase()] || '';
      const label = desc ? `${ec.code}: ${desc}` : ec.code;
      dbExcludedLines.push(`${label} (n = ${ec.count})`);
    });
    (data.dbReportsExcludedStage3 || []).forEach((g: any) => {
      if (g.count > 0) {
        dbExcludedLines.push(`${g.gate} (n = ${g.count})`);
      }
    });
    yMeas = 0;
    const nextY11Meas = wrapText('Reports excluded:', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(dbExcludedLines.join('\n') || 'No exclusions', 0, nextY11Meas + 5, boxWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const box11TextHeight = yMeas;

    // Box 18 (if not collapsed)
    let box18TextHeight = 0;
    if (!isCollapsed) {
      yMeas = 0;
      wrapText('Reports assessed for eligibility', 0, yMeas, 500 - 2 * padding, lhBold, 'bold', undefined, true);
      box18TextHeight = wrapText(`(n = ${data.otherReportsAssessed || 0})`, 0, yMeas + lhBold, 500 - 2 * padding, lhNormal, undefined, undefined, true);
    }

    // Box 19 (if not collapsed)
    let otherExcludedLines: string[] = [];
    (data.otherReportsExcludedStage2 || []).forEach((ec: any) => {
      const desc = data.ecLabels?.[ec.code?.toUpperCase()] || '';
      const label = desc ? `${ec.code}: ${desc}` : ec.code;
      otherExcludedLines.push(`${label} (n = ${ec.count})`);
    });
    (data.otherReportsExcludedStage3 || []).forEach((g: any) => {
      if (g.count > 0) {
        otherExcludedLines.push(`${g.gate} (n = ${g.count})`);
      }
    });
    let box19TextHeight = 0;
    if (!isCollapsed) {
      yMeas = 0;
      const nextY19Meas = wrapText('Reports excluded:', 0, yMeas, 500 - 2 * padding, lhBold, 'bold', undefined, true);
      box19TextHeight = wrapText(otherExcludedLines.join('\n') || 'No exclusions', 0, nextY19Meas + 5, 500 - 2 * padding, lhNormal, undefined, undefined, true);
    }

    const row4MaxTextHeight = Math.max(
      box10TextHeight,
      box11TextHeight,
      isCollapsed ? 0 : box18TextHeight,
      isCollapsed ? 0 : box19TextHeight
    );
    const hRow4 = row4MaxTextHeight + padding * 2;

    // Phase 3: Included Box (Y = 1350)
    yMeas = 0;
    const nextYIncMeas = wrapText('Studies included in review', 0, yMeas, headerWidth - 2 * padding, lhBold, 'bold', undefined, true);
    const nextYIncCountMeas = wrapText(`(n = ${data.dbStudiesIncluded || 0})`, 0, nextYIncMeas + 5, headerWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const nextYInc2Meas = wrapText('Reports of included studies', 0, nextYIncCountMeas + 15, headerWidth - 2 * padding, lhBold, 'bold', undefined, true);
    const endYIncMeas = wrapText(`(n = ${data.otherStudiesIncluded || 0})`, 0, nextYInc2Meas + 5, headerWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const boxIncTextHeight = endYIncMeas;
    const hInc = boxIncTextHeight + padding * 2;

    // Calculate Dynamic Row coordinates (Y-Axis Accumulation)
    const headerY = 40;
    const headerH = 60;
    const row1Y = headerY + headerH + verticalGap;
    const row2Y = row1Y + hRow1 + verticalGap;
    const row3Y = row2Y + hRow2 + verticalGap;
    const row4Y = row3Y + hRow3 + verticalGap;
    const row5Y = row4Y + hRow4 + verticalGap;
    const baseHeight = row5Y + hInc + bottomPadding;

    // Apply scale multiplier to backing store
    canvas.width = baseWidth * config.exportScale;
    canvas.height = baseHeight * config.exportScale;

    ctx.save();
    ctx.scale(config.exportScale, config.exportScale);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    // ----------------------------------------------------
    // PASS 2: DRAWING & RENDERING
    // ----------------------------------------------------

    // Draw Sections Left-hand Phase Labels dynamically
    drawVerticalLabel('Identification', headerY, row1Y + hRow1);
    drawVerticalLabel('Screening', row2Y, row4Y + hRow4);
    drawVerticalLabel('Included', row5Y, row5Y + hInc);

    // ----------------------------------------------------
    // PHASE 1: Identification
    // ----------------------------------------------------

    // Headers
    // Left: Identification of studies via databases and registers
    drawRoundRect(startX, headerY, headerWidth, headerH, config.boxBorderRadius, goldHeader, headerBorder, borderWidth);
    ctx.fillStyle = goldHeaderText;
    ctx.font = `bold ${config.baseFontSize}px ${config.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Identification of studies via databases and registers', headerCenter, headerY + headerH / 2);

    // Right: Identification of studies via other methods (only if not collapsed)
    if (!isCollapsed) {
      drawRoundRect(1300, headerY, 1040, headerH, config.boxBorderRadius, goldHeader, headerBorder, borderWidth);
      ctx.fillStyle = goldHeaderText;
      ctx.font = `bold ${config.baseFontSize}px ${config.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Identification of studies via other methods', 1820, headerY + headerH / 2);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Box [**1]: Databases identified
    drawRoundRect(startX, row1Y, boxWidth, hRow1, config.boxBorderRadius, cardBg, border);
    const nextY1 = wrapText('Records identified from:', startX + padding, row1Y + padding + Math.round(config.baseFontSize * 0.8), boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(dbSourcesText || 'No database papers', startX + padding, nextY1 + 5, boxWidth - 2 * padding, lhNormal);

    // Box [**2]: Removed before screening (databases)
    drawRoundRect(exclusionFlowLeft, row1Y, boxWidth, hRow1, config.boxBorderRadius, cardBg, border);
    const nextY2 = wrapText('Records removed before screening:', exclusionFlowLeft + padding, row1Y + padding + Math.round(config.baseFontSize * 0.8), boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(
      `Duplicate records removed (n = ${data.dbDuplicatesRemoved || 0})\n` +
      `Records marked as ineligible by automation tools (n = 0)\n` +
      `Records removed for other reasons (n = 0)`,
      exclusionFlowLeft + padding, nextY2 + 5, boxWidth - 2 * padding, lhNormal
    );

    // Box [**13]: Records identified from (other methods - only if not collapsed)
    if (!isCollapsed) {
      const otherSourcesText = (data.otherMethodsSources || [])
        .map((s: any) => `${s.source} (n = ${s.count})`)
        .join('\n');
      drawRoundRect(1300, row1Y, 500, hRow1, config.boxBorderRadius, cardBg, border);
      const nextY13 = wrapText('Records identified from:', 1300 + padding, row1Y + padding + Math.round(config.baseFontSize * 0.8), 500 - 2 * padding, lhBold, 'bold');
      wrapText(otherSourcesText || 'No records identified', 1300 + padding, nextY13 + 5, 500 - 2 * padding, lhNormal);

      // Box [**14]: Removed before screening (other methods - only if not collapsed)
      drawRoundRect(1840, row1Y, 500, hRow1, config.boxBorderRadius, cardBg, border);
      const nextY14 = wrapText('Records removed before screening:', 1840 + padding, row1Y + padding + Math.round(config.baseFontSize * 0.8), 500 - 2 * padding, lhBold, 'bold');
      wrapText(
        `Duplicate records removed (n = ${data.otherDuplicatesRemoved || 0})\n` +
        `Records marked as ineligible by automation tools (n = 0)\n` +
        `Records removed for other reasons (n = 0)`,
        1840 + padding, nextY14 + 5, 500 - 2 * padding, lhNormal
      );
    }

    // ----------------------------------------------------
    // PHASE 2: Screening
    // ----------------------------------------------------

    // Box [**5]: Records screened
    drawRoundRect(startX, row2Y, boxWidth, hRow2, config.boxBorderRadius, cardBg, border);
    wrapText(`Records screened (n = ${data.dbRecordsScreened || 0})`, startX + padding, row2Y + padding + Math.round(config.baseFontSize * 0.8), boxWidth - 2 * padding, lhBold, 'bold');

    // Box [**6] & [**7]: Records excluded (Stage 1)
    drawRoundRect(exclusionFlowLeft, row2Y, boxWidth, hRow2, config.boxBorderRadius, cardBg, border);
    const startY6 = row2Y + padding + Math.round(config.baseFontSize * 0.8);
    wrapText(`Records excluded (n = ${data.dbStage1Excluded || 0})`, exclusionFlowLeft + padding, startY6, boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(s1ExclusionsText || 'No exclusions', exclusionFlowLeft + padding, startY6 + lhBold, boxWidth - 2 * padding, lhNormal, 'normal', textMuted);

    // Box [**8]: Reports sought for retrieval
    drawRoundRect(startX, row3Y, boxWidth, hRow3, config.boxBorderRadius, cardBg, border);
    const startY8 = row3Y + padding + Math.round(config.baseFontSize * 0.8);
    wrapText('Reports sought for retrieval', startX + padding, startY8, boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(`(n = ${data.dbReportsSought || 0})`, startX + padding, startY8 + lhBold, boxWidth - 2 * padding, lhNormal);

    // Box [**9]: Reports not retrieved
    drawRoundRect(exclusionFlowLeft, row3Y, boxWidth, hRow3, config.boxBorderRadius, cardBg, border);
    const startY9 = row3Y + padding + Math.round(config.baseFontSize * 0.8);
    wrapText('Reports not retrieved', exclusionFlowLeft + padding, startY9, boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(`(n = ${data.dbReportsNotRetrieved || 0})`, exclusionFlowLeft + padding, startY9 + lhBold, boxWidth - 2 * padding, lhNormal);

    // Box [**10]: Reports assessed for eligibility
    drawRoundRect(startX, row4Y, boxWidth, hRow4, config.boxBorderRadius, cardBg, border);
    const startY10 = row4Y + padding + Math.round(config.baseFontSize * 0.8);
    wrapText('Reports assessed for eligibility', startX + padding, startY10, boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(`(n = ${data.dbReportsAssessed || 0})`, startX + padding, startY10 + lhBold, boxWidth - 2 * padding, lhNormal);

    // Box [**11]: Reports excluded (large block)
    drawRoundRect(exclusionFlowLeft, row4Y, boxWidth, hRow4, config.boxBorderRadius, cardBg, border);
    const startY11 = row4Y + padding + Math.round(config.baseFontSize * 0.8);
    const nextY11 = wrapText('Reports excluded:', exclusionFlowLeft + padding, startY11, boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(dbExcludedLines.join('\n') || 'No exclusions', exclusionFlowLeft + padding, nextY11 + 5, boxWidth - 2 * padding, lhNormal);

    // RIGHT COLUMN - Phase 2 (only if not collapsed)
    if (!isCollapsed) {
      // Box [**16]: Reports sought for retrieval
      drawRoundRect(1300, row3Y, 500, hRow3, config.boxBorderRadius, cardBg, border);
      const startY16 = row3Y + padding + Math.round(config.baseFontSize * 0.8);
      wrapText('Reports sought for retrieval', 1300 + padding, startY16, 500 - 2 * padding, lhBold, 'bold');
      wrapText(`(n = ${data.otherReportsSought || 0})`, 1300 + padding, startY16 + lhBold, 500 - 2 * padding, lhNormal);

      // Box [**17]: Reports not retrieved
      drawRoundRect(1840, row3Y, 500, hRow3, config.boxBorderRadius, cardBg, border);
      const startY17 = row3Y + padding + Math.round(config.baseFontSize * 0.8);
      wrapText('Reports not retrieved', 1840 + padding, startY17, 500 - 2 * padding, lhNormal);
      wrapText(`(n = ${data.otherReportsNotRetrieved || 0})`, 1840 + padding, startY17 + lhBold, 500 - 2 * padding, lhNormal);

      // Box [**18]: Reports assessed for eligibility
      drawRoundRect(1300, row4Y, 500, hRow4, config.boxBorderRadius, cardBg, border);
      const startY18 = row4Y + padding + Math.round(config.baseFontSize * 0.8);
      wrapText('Reports assessed for eligibility', 1300 + padding, startY18, 500 - 2 * padding, lhBold, 'bold');
      wrapText(`(n = ${data.otherReportsAssessed || 0})`, 1300 + padding, startY18 + lhBold, 500 - 2 * padding, lhNormal);

      // Box [**19]: Reports excluded (large block)
      drawRoundRect(1840, row4Y, 500, hRow4, config.boxBorderRadius, cardBg, border);
      const startY19 = row4Y + padding + Math.round(config.baseFontSize * 0.8);
      const nextY19 = wrapText('Reports excluded:', 1840 + padding, startY19, 500 - 2 * padding, lhBold, 'bold');
      wrapText(otherExcludedLines.join('\n') || 'No exclusions', 1840 + padding, nextY19 + 5, 500 - 2 * padding, lhNormal);
    }

    // ----------------------------------------------------
    // PHASE 3: Included
    // ----------------------------------------------------

    // Box [**12] & [**20]: Studies included
    drawRoundRect(startX, row5Y, headerWidth, hInc, config.boxBorderRadius, cardBg, border);
    const startYInc = row5Y + padding + Math.round(config.baseFontSize * 0.8);
    const nextYInc = wrapText('Studies included in review', startX + padding, startYInc, headerWidth - 2 * padding, lhBold, 'bold');
    const nextYIncCount = wrapText(`(n = ${data.dbStudiesIncluded || 0})`, startX + padding, nextYInc + 5, headerWidth - 2 * padding, lhNormal);
    
    const nextYInc2 = wrapText('Reports of included studies', startX + padding, nextYIncCount + 15, headerWidth - 2 * padding, lhBold, 'bold');
    wrapText(`(n = ${data.otherStudiesIncluded || 0})`, startX + padding, nextYInc2 + 5, headerWidth - 2 * padding, lhNormal);

    // ----------------------------------------------------
    // CONNECTOR ARROWS
    // ----------------------------------------------------
    const arrowCol = arrowColor;

    // LEFT Column: Identification
    drawArrow(mainFlowCenter, row1Y + hRow1, mainFlowCenter, row2Y, arrowCol); // Box 1 down to Box 5
    drawArrow(mainFlowRight, row1Y + hRow1 / 2, exclusionFlowLeft, row1Y + hRow1 / 2, arrowCol); // Box 1 right to Box 2

    // LEFT Column: Screening
    drawArrow(mainFlowCenter, row2Y + hRow2, mainFlowCenter, row3Y, arrowCol); // Box 5 down to Box 8
    drawArrow(mainFlowRight, row2Y + hRow2 / 2, exclusionFlowLeft, row2Y + hRow2 / 2, arrowCol); // Box 5 right to Box 6

    drawArrow(mainFlowCenter, row3Y + hRow3, mainFlowCenter, row4Y, arrowCol); // Box 8 down to Box 10
    drawArrow(mainFlowRight, row3Y + hRow3 / 2, exclusionFlowLeft, row3Y + hRow3 / 2, arrowCol); // Box 8 right to Box 9

    drawArrow(mainFlowCenter, row4Y + hRow4, mainFlowCenter, row5Y, arrowCol); // Box 10 down to Box 12
    drawArrow(mainFlowRight, row4Y + hRow4 / 2, exclusionFlowLeft, row4Y + hRow4 / 2, arrowCol); // Box 10 right to Box 11

    // RIGHT Column: Identification & Screening (only if not collapsed)
    if (!isCollapsed) {
      // Box 13 right to Box 14
      drawArrow(1800, row1Y + hRow1 / 2, 1840, row1Y + hRow1 / 2, arrowCol);

      // Box 13 down to Box 16
      drawArrow(1550, row1Y + hRow1, 1550, row3Y, arrowCol);

      // RIGHT Column: Screening
      drawArrow(1550, row3Y + hRow3, 1550, row4Y, arrowCol); // Box 16 down to Box 18
      drawArrow(1800, row3Y + hRow3 / 2, 1840, row3Y + hRow3 / 2, arrowCol); // Box 16 right to Box 17

      drawArrow(1800, row4Y + hRow4 / 2, 1840, row4Y + hRow4 / 2, arrowCol); // Box 18 right to Box 19

      // Box 18 down, left, and down into Included Box
      const lineY = (row4Y + hRow4 + row5Y) / 2;
      ctx.beginPath();
      ctx.moveTo(1550, row4Y + hRow4);
      ctx.lineTo(1550, lineY);
      ctx.lineTo(1100, lineY);
      ctx.lineTo(1100, row5Y);
      ctx.strokeStyle = arrowCol;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw arrowhead at (1100, row5Y) pointing straight down
      drawArrow(1100, row5Y - 10, 1100, row5Y, arrowCol);
    }

    ctx.restore();
  };

  useEffect(() => {
    if (data) {
      drawPrisma();
    }
  }, [data, config]);

  const getSafeProjectName = () => {
    return data?.projectName ? data.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'project';
  };

  const handleDownloadPng = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const safeProjName = getSafeProjectName();
    
    link.download = `PRISMA_${safeProjName}_${dateStr}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setIsExportMenuOpen(false);
    if (showToast) showToast('PRISMA Flowchart (PNG) downloaded successfully', 'success');
  };

  const handleDownloadSvg = () => {
    if (!data) return;
    try {
      const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
      const svgString = generatePrismaSvg(data, config, { isDark });
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      const safeProjName = getSafeProjectName();

      link.download = `PRISMA_${safeProjName}_${dateStr}.svg`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsExportMenuOpen(false);
      if (showToast) showToast('PRISMA Flowchart (Vector SVG) downloaded successfully', 'success');
    } catch (err: any) {
      console.error('Error generating SVG:', err);
      if (showToast) showToast(err.message || 'Error generating SVG', 'error');
    }
  };

  const handleDownloadPdf = async () => {
    if (!data) return;
    setIsExportingPdf(true);
    try {
      const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
      const svgString = generatePrismaSvg(data, config, { isDark });
      const dateStr = new Date().toISOString().split('T')[0];
      const safeProjName = getSafeProjectName();
      const filename = `PRISMA_${safeProjName}_${dateStr}.pdf`;

      await exportSvgToPdf(svgString, { filename, marginMm: 0 });
      setIsExportMenuOpen(false);
      if (showToast) showToast('PRISMA Flowchart (Vector PDF) downloaded successfully', 'success');
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      if (showToast) showToast(err.message || 'Error generating PDF', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Auto-populating PRISMA metrics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No PRISMA data available for this project.
      </div>
    );
  }

  const otherMethodsTotal = (data.totalOtherRecordsIdentified || 0) + (data.otherReportsSought || 0) + (data.otherDuplicatesRemoved || 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Settings / Controls */}
      <div className="flex items-center justify-between bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <div>
            <h4 className="text-sm font-semibold text-foreground">PRISMA 2020 Flowchart</h4>
            <p className="text-xs text-muted-foreground">Dynamic publication-compliant study flow diagram.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border text-xs font-semibold py-2 px-3 rounded-lg shadow-sm transition-all cursor-pointer"
            title="Configure Diagram"
          >
            <Settings className="w-4 h-4" />
            Configure Diagram
          </button>

          {/* Unified Multi-Format Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <div className="inline-flex rounded-lg shadow-sm">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold py-2 px-3.5 rounded-l-lg transition-all cursor-pointer"
                title="Download PNG (Raster)"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="bg-primary/90 text-primary-foreground hover:bg-primary border-l border-primary-foreground/20 px-2 py-2 rounded-r-lg transition-all cursor-pointer flex items-center justify-center"
                title="Export Formats (PNG, SVG, PDF)"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-card border border-border rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Export Options
                </div>

                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-secondary/70 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold">PNG Image</div>
                    <div className="text-[10px] text-muted-foreground">High-resolution raster ({config.exportScale}x scale)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-secondary/70 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <div className="font-semibold">Vector SVG</div>
                    <div className="text-[10px] text-muted-foreground">Lossless vector for LaTeX / Illustrator</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-secondary/70 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isExportingPdf ? (
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <div className="font-semibold">Publication PDF</div>
                    <div className="text-[10px] text-muted-foreground">Camera-ready vector PDF document</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Canvas container with styling to make it display beautifully */}
      <div className="w-full overflow-hidden border border-border rounded-xl bg-muted/30 p-4 flex justify-center shadow-inner">
        <canvas
          ref={canvasRef}
          className="w-full max-w-[1100px] border border-border/80 rounded-lg shadow-md bg-white select-none transition-shadow hover:shadow-lg"
          style={{ maxHeight: '780px' }}
        />
      </div>

      {/* Config Modal */}
      <PrismaConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        onChange={handleConfigChange}
        otherMethodsCount={otherMethodsTotal}
      />
    </div>
  );
}
