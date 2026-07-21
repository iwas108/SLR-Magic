import React, { useEffect, useRef, useState } from 'react';
import { Download, Settings, Sparkles } from 'lucide-react';
import PrismaConfigModal from './PrismaConfigModal';
import { useViewerData } from '../../context/ViewerContext';

const DEFAULT_CONFIG = {
  collapseEmptyColumn: true,
  colorTheme: 'appTheme',
  fontFamily: 'Inter, system-ui, sans-serif',
  baseFontSize: 22,
  boxBorderRadius: 8,
  boxPadding: 20,
  exportScale: 1
};

export default function PrismaFlowDiagram({ prismaData, projectName }) {
  const { showToast } = useViewerData();
  const canvasRef = useRef(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Load saved config
  useEffect(() => {
    const saved = localStorage.getItem('slr_prisma_config_viewer');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const handleConfigChange = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem('slr_prisma_config_viewer', JSON.stringify(newConfig));
  };

  // Process data for diagram rendering
  const processData = (raw) => {
    if (!raw) return null;

    const databaseSourcesList = raw.databaseSources
      ? (typeof raw.databaseSources === 'string' ? raw.databaseSources.split(', ') : raw.databaseSources)
      : ['IEEE Xplore', 'Scopus', 'PubMed', 'ACM', 'WOS'];

    const databaseSources = Array.isArray(databaseSourcesList)
      ? databaseSourcesList.map(s => ({ source: typeof s === 'string' ? s : s.source, count: s.count || 0 }))
      : [];

    const parseECList = (rawVal) => {
      if (!rawVal) return [];
      if (Array.isArray(rawVal)) {
        return rawVal.map(item => ({
          code: item.code || item.gate || 'Unspecified',
          gate: item.gate || item.code || 'Unspecified',
          count: item.count !== undefined ? item.count : 0
        }));
      }
      return Object.entries(rawVal).map(([code, count]) => ({
        code,
        gate: code,
        count: typeof count === 'number' ? count : (count.count || 0)
      }));
    };

    const dbStage1ExcludedByEC = parseECList(raw.dbStage1ExcludedByEC);
    const dbReportsExcludedStage2 = parseECList(raw.dbReportsExcludedStage2ByEC || raw.dbReportsExcludedStage2);
    const dbReportsExcludedStage3 = parseECList(raw.dbReportsExcludedStage3);
    const otherReportsExcludedStage2 = parseECList(raw.otherReportsExcludedStage2);
    const otherReportsExcludedStage3 = parseECList(raw.otherReportsExcludedStage3);

    return {
      projectName: raw.projectName || projectName || 'Project',
      databaseSources,
      dbDuplicatesRemoved: raw.dbDuplicatesRemoved || 0,
      dbRecordsScreened: raw.dbRecordsScreened || 0,
      dbStage1Excluded: raw.dbStage1Excluded || 0,
      dbStage1ExcludedByEC,
      dbReportsSought: raw.dbReportsSought || 0,
      dbReportsNotRetrieved: raw.dbReportsNotRetrieved || 0,
      dbReportsAssessed: raw.dbReportsAssessed || 0,
      dbReportsExcludedStage2,
      dbReportsExcludedStage3,
      dbStudiesIncluded: raw.dbStudiesIncluded || 0,
      otherDuplicatesRemoved: raw.otherDuplicatesRemoved || 0,
      otherReportsSought: raw.otherReportsSought || 0,
      otherReportsNotRetrieved: raw.otherReportsNotRetrieved || 0,
      otherReportsAssessed: raw.otherReportsAssessed || 0,
      otherReportsExcludedStage2,
      otherReportsExcludedStage3,
      otherStudiesIncluded: raw.otherStudiesIncluded || 0,
      ecLabels: raw.ecLabels || {},
    };
  };

  const data = processData(prismaData);

  const drawPrisma = () => {
    if (!canvasRef.current || !data) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const otherMethodsTotal = (data.otherReportsSought || 0) + (data.otherDuplicatesRemoved || 0);
    const isCollapsed = config.collapseEmptyColumn && otherMethodsTotal === 0;

    const startX = isCollapsed ? 500 : 200;
    const boxWidth = isCollapsed ? 650 : 500;
    const gap = isCollapsed ? 750 : 540;
    const leftPhaseLabelX = isCollapsed ? 300 : 50;

    const mainFlowCenter = startX + boxWidth / 2;
    const mainFlowRight = startX + boxWidth;
    const exclusionFlowLeft = startX + gap;
    const headerWidth = isCollapsed ? 1400 : 1040;
    const headerCenter = startX + headerWidth / 2;

    const baseWidth = 2400;
    const verticalGap = 40;
    const bottomPadding = 40;

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
      const isDark = document.documentElement.classList.contains('dark');

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

    const drawRoundRect = (x, y, w, h, r, fill, stroke, lw = borderWidth) => {
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

    const drawArrow = (fromX, fromY, toX, toY, color, lw = 3) => {
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

    const wrapText = (text, x, y, maxWidth, lineHeight, fontWeight = 'normal', color = textMain, measureOnly = false) => {
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

    const drawVerticalLabel = (text, yStart, yEnd) => {
      const x = leftPhaseLabelX;
      const yCenter = (yStart + yEnd) / 2;
      const labelWidth = 60;
      const labelHeight = yEnd - yStart;

      drawRoundRect(x - labelWidth / 2, yStart, labelWidth, labelHeight, config.boxBorderRadius, labelBg, border, borderWidth);

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

    // Pass 1: Pre-calculations
    const dbSourcesText = data.databaseSources
      .map(s => `${s.source} (n = ${s.count})`)
      .join('\n');
    let yMeas = 0;
    yMeas = wrapText('Records identified from:', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(dbSourcesText || 'No database papers', 0, yMeas + 5, boxWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const box1TextHeight = yMeas;

    yMeas = 0;
    yMeas = wrapText('Records removed before screening:', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(
      `Duplicate records removed (n = ${data.dbDuplicatesRemoved})\n` +
      `Records marked as ineligible by automation tools (n = 0)\n` +
      `Records removed for other reasons (n = 0)`,
      0, yMeas + 5, boxWidth - 2 * padding, lhNormal, undefined, undefined, true
    );
    const box2TextHeight = yMeas;

    let box13TextHeight = 0;
    if (!isCollapsed) {
      yMeas = 0;
      yMeas = wrapText('Records removed before screening:', 0, yMeas, 500 - 2 * padding, lhBold, 'bold', undefined, true);
      yMeas = wrapText(
        `Duplicate records removed (n = ${data.otherDuplicatesRemoved})\n` +
        `Records marked as ineligible by automation tools (n = 0)\n` +
        `Records removed for other reasons (n = 0)`,
        0, yMeas + 5, 500 - 2 * padding, lhNormal, undefined, undefined, true
      );
      box13TextHeight = yMeas;
    }

    const row1MaxTextHeight = Math.max(box1TextHeight, box2TextHeight, isCollapsed ? 0 : box13TextHeight);
    const hRow1 = row1MaxTextHeight + padding * 2;

    yMeas = 0;
    yMeas = wrapText(`Records screened (n = ${data.dbRecordsScreened})`, 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    const box5TextHeight = yMeas;

    const s1ExclusionsText = data.dbStage1ExcludedByEC
      .map(ec => `${ec.code} (n = ${ec.count})`)
      .join(', ');
    yMeas = 0;
    wrapText(`Records excluded (n = ${data.dbStage1Excluded})`, 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(s1ExclusionsText || 'No exclusions', 0, yMeas + lhBold, boxWidth - 2 * padding, lhNormal, 'normal', undefined, true);
    const box6TextHeight = yMeas;

    const row2MaxTextHeight = Math.max(box5TextHeight, box6TextHeight);
    const hRow2 = row2MaxTextHeight + padding * 2;

    yMeas = 0;
    wrapText('Reports sought for retrieval', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(`(n = ${data.dbReportsSought})`, 0, yMeas + lhBold, boxWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const box8TextHeight = yMeas;

    yMeas = 0;
    wrapText('Reports not retrieved', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(`(n = ${data.dbReportsNotRetrieved})`, 0, yMeas + lhBold, boxWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const box9TextHeight = yMeas;

    let box16TextHeight = 0;
    if (!isCollapsed) {
      yMeas = 0;
      wrapText('Reports sought for retrieval', 0, yMeas, 500 - 2 * padding, lhBold, 'bold', undefined, true);
      box16TextHeight = wrapText(`(n = ${data.otherReportsSought})`, 0, yMeas + lhBold, 500 - 2 * padding, lhNormal, undefined, undefined, true);
    }

    let box17TextHeight = 0;
    if (!isCollapsed) {
      yMeas = 0;
      wrapText('Reports not retrieved', 0, yMeas, 500 - 2 * padding, lhBold, 'bold', undefined, true);
      box17TextHeight = wrapText(`(n = ${data.otherReportsNotRetrieved})`, 0, yMeas + lhBold, 500 - 2 * padding, lhNormal, undefined, undefined, true);
    }

    const row3MaxTextHeight = Math.max(
      box8TextHeight,
      box9TextHeight,
      isCollapsed ? 0 : box16TextHeight,
      isCollapsed ? 0 : box17TextHeight
    );
    const hRow3 = row3MaxTextHeight + padding * 2;

    yMeas = 0;
    wrapText('Reports assessed for eligibility', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(`(n = ${data.dbReportsAssessed})`, 0, yMeas + lhBold, boxWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const box10TextHeight = yMeas;

    let dbExcludedLines = [];
    data.dbReportsExcludedStage2.forEach(ec => {
      const desc = data.ecLabels[ec.code?.toUpperCase()] || '';
      const label = desc ? `${ec.code}: ${desc}` : ec.code;
      dbExcludedLines.push(`${label} (n = ${ec.count})`);
    });
    data.dbReportsExcludedStage3.forEach(g => {
      if (g.count > 0) {
        dbExcludedLines.push(`${g.gate} (n = ${g.count})`);
      }
    });
    yMeas = 0;
    const nextY11Meas = wrapText('Reports excluded:', 0, yMeas, boxWidth - 2 * padding, lhBold, 'bold', undefined, true);
    yMeas = wrapText(dbExcludedLines.join('\n') || 'No exclusions', 0, nextY11Meas + 5, boxWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const box11TextHeight = yMeas;

    let box18TextHeight = 0;
    if (!isCollapsed) {
      yMeas = 0;
      wrapText('Reports assessed for eligibility', 0, yMeas, 500 - 2 * padding, lhBold, 'bold', undefined, true);
      box18TextHeight = wrapText(`(n = ${data.otherReportsAssessed})`, 0, yMeas + lhBold, 500 - 2 * padding, lhNormal, undefined, undefined, true);
    }

    let otherExcludedLines = [];
    data.otherReportsExcludedStage2.forEach(ec => {
      const desc = data.ecLabels[ec.code?.toUpperCase()] || '';
      const label = desc ? `${ec.code}: ${desc}` : ec.code;
      otherExcludedLines.push(`${label} (n = ${ec.count})`);
    });
    data.otherReportsExcludedStage3.forEach(g => {
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

    yMeas = 0;
    const nextYIncMeas = wrapText('Studies included in review', 0, yMeas, headerWidth - 2 * padding, lhBold, 'bold', undefined, true);
    const nextYIncCountMeas = wrapText(`(n = ${data.dbStudiesIncluded})`, 0, nextYIncMeas + 5, headerWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const nextYInc2Meas = wrapText('Reports of included studies', 0, nextYIncCountMeas + 15, headerWidth - 2 * padding, lhBold, 'bold', undefined, true);
    const endYIncMeas = wrapText(`(n = ${data.otherStudiesIncluded})`, 0, nextYInc2Meas + 5, headerWidth - 2 * padding, lhNormal, undefined, undefined, true);
    const hInc = endYIncMeas + padding * 2;

    const headerY = 40;
    const headerH = 60;
    const row1Y = headerY + headerH + verticalGap;
    const row2Y = row1Y + hRow1 + verticalGap;
    const row3Y = row2Y + hRow2 + verticalGap;
    const row4Y = row3Y + hRow3 + verticalGap;
    const row5Y = row4Y + hRow4 + verticalGap;
    const baseHeight = row5Y + hInc + bottomPadding;

    canvas.width = baseWidth * config.exportScale;
    canvas.height = baseHeight * config.exportScale;

    ctx.save();
    ctx.scale(config.exportScale, config.exportScale);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    // Pass 2: Rendering
    drawVerticalLabel('Identification', headerY, row1Y + hRow1);
    drawVerticalLabel('Screening', row2Y, row4Y + hRow4);
    drawVerticalLabel('Included', row5Y, row5Y + hInc);

    drawRoundRect(startX, headerY, headerWidth, headerH, config.boxBorderRadius, goldHeader, headerBorder, borderWidth);
    ctx.fillStyle = goldHeaderText;
    ctx.font = `bold ${config.baseFontSize}px ${config.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Identification of studies via databases and registers', headerCenter, headerY + headerH / 2);

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

    drawRoundRect(startX, row1Y, boxWidth, hRow1, config.boxBorderRadius, cardBg, border);
    const nextY1 = wrapText('Records identified from:', startX + padding, row1Y + padding + Math.round(config.baseFontSize * 0.8), boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(dbSourcesText || 'No database papers', startX + padding, nextY1 + 5, boxWidth - 2 * padding, lhNormal);

    drawRoundRect(exclusionFlowLeft, row1Y, boxWidth, hRow1, config.boxBorderRadius, cardBg, border);
    const nextY2 = wrapText('Records removed before screening:', exclusionFlowLeft + padding, row1Y + padding + Math.round(config.baseFontSize * 0.8), boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(
      `Duplicate records removed (n = ${data.dbDuplicatesRemoved})\n` +
      `Records marked as ineligible by automation tools (n = 0)\n` +
      `Records removed for other reasons (n = 0)`,
      exclusionFlowLeft + padding, nextY2 + 5, boxWidth - 2 * padding, lhNormal
    );

    if (!isCollapsed) {
      drawRoundRect(1300, row1Y, 500, hRow1, config.boxBorderRadius, cardBg, border);
      const nextY13 = wrapText('Records removed before screening:', 1300 + padding, row1Y + padding + Math.round(config.baseFontSize * 0.8), 500 - 2 * padding, lhBold, 'bold');
      wrapText(
        `Duplicate records removed (n = ${data.otherDuplicatesRemoved})\n` +
        `Records marked as ineligible by automation tools (n = 0)\n` +
        `Records removed for other reasons (n = 0)`,
        1300 + padding, nextY13 + 5, 500 - 2 * padding, lhNormal
      );
    }

    drawRoundRect(startX, row2Y, boxWidth, hRow2, config.boxBorderRadius, cardBg, border);
    wrapText(`Records screened (n = ${data.dbRecordsScreened})`, startX + padding, row2Y + padding + Math.round(config.baseFontSize * 0.8), boxWidth - 2 * padding, lhBold, 'bold');

    drawRoundRect(exclusionFlowLeft, row2Y, boxWidth, hRow2, config.boxBorderRadius, cardBg, border);
    const startY6 = row2Y + padding + Math.round(config.baseFontSize * 0.8);
    wrapText(`Records excluded (n = ${data.dbStage1Excluded})`, exclusionFlowLeft + padding, startY6, boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(s1ExclusionsText || 'No exclusions', exclusionFlowLeft + padding, startY6 + lhBold, boxWidth - 2 * padding, lhNormal, 'normal', textMuted);

    drawRoundRect(startX, row3Y, boxWidth, hRow3, config.boxBorderRadius, cardBg, border);
    const startY8 = row3Y + padding + Math.round(config.baseFontSize * 0.8);
    wrapText('Reports sought for retrieval', startX + padding, startY8, boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(`(n = ${data.dbReportsSought})`, startX + padding, startY8 + lhBold, boxWidth - 2 * padding, lhNormal);

    drawRoundRect(exclusionFlowLeft, row3Y, boxWidth, hRow3, config.boxBorderRadius, cardBg, border);
    const startY9 = row3Y + padding + Math.round(config.baseFontSize * 0.8);
    wrapText('Reports not retrieved', exclusionFlowLeft + padding, startY9, boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(`(n = ${data.dbReportsNotRetrieved})`, exclusionFlowLeft + padding, startY9 + lhBold, boxWidth - 2 * padding, lhNormal);

    drawRoundRect(startX, row4Y, boxWidth, hRow4, config.boxBorderRadius, cardBg, border);
    const startY10 = row4Y + padding + Math.round(config.baseFontSize * 0.8);
    wrapText('Reports assessed for eligibility', startX + padding, startY10, boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(`(n = ${data.dbReportsAssessed})`, startX + padding, startY10 + lhBold, boxWidth - 2 * padding, lhNormal);

    drawRoundRect(exclusionFlowLeft, row4Y, boxWidth, hRow4, config.boxBorderRadius, cardBg, border);
    const startY11 = row4Y + padding + Math.round(config.baseFontSize * 0.8);
    const nextY11 = wrapText('Reports excluded:', exclusionFlowLeft + padding, startY11, boxWidth - 2 * padding, lhBold, 'bold');
    wrapText(dbExcludedLines.join('\n') || 'No exclusions', exclusionFlowLeft + padding, nextY11 + 5, boxWidth - 2 * padding, lhNormal);

    if (!isCollapsed) {
      drawRoundRect(1300, row3Y, 500, hRow3, config.boxBorderRadius, cardBg, border);
      const startY16 = row3Y + padding + Math.round(config.baseFontSize * 0.8);
      wrapText('Reports sought for retrieval', 1300 + padding, startY16, 500 - 2 * padding, lhBold, 'bold');
      wrapText(`(n = ${data.otherReportsSought})`, 1300 + padding, startY16 + lhBold, 500 - 2 * padding, lhNormal);

      drawRoundRect(1840, row3Y, 500, hRow3, config.boxBorderRadius, cardBg, border);
      const startY17 = row3Y + padding + Math.round(config.baseFontSize * 0.8);
      wrapText('Reports not retrieved', 1840 + padding, startY17, 500 - 2 * padding, lhBold, 'bold');
      wrapText(`(n = ${data.otherReportsNotRetrieved})`, 1840 + padding, startY17 + lhBold, 500 - 2 * padding, lhNormal);

      drawRoundRect(1300, row4Y, 500, hRow4, config.boxBorderRadius, cardBg, border);
      const startY18 = row4Y + padding + Math.round(config.baseFontSize * 0.8);
      wrapText('Reports assessed for eligibility', 1300 + padding, startY18, 500 - 2 * padding, lhBold, 'bold');
      wrapText(`(n = ${data.otherReportsAssessed})`, 1300 + padding, startY18 + lhBold, 500 - 2 * padding, lhNormal);

      drawRoundRect(1840, row4Y, 500, hRow4, config.boxBorderRadius, cardBg, border);
      const startY19 = row4Y + padding + Math.round(config.baseFontSize * 0.8);
      const nextY19 = wrapText('Reports excluded:', 1840 + padding, startY19, 500 - 2 * padding, lhBold, 'bold');
      wrapText(otherExcludedLines.join('\n') || 'No exclusions', 1840 + padding, nextY19 + 5, 500 - 2 * padding, lhNormal);
    }

    drawRoundRect(startX, row5Y, headerWidth, hInc, config.boxBorderRadius, cardBg, border);
    const startYInc = row5Y + padding + Math.round(config.baseFontSize * 0.8);
    const nextYInc = wrapText('Studies included in review', startX + padding, startYInc, headerWidth - 2 * padding, lhBold, 'bold');
    const nextYIncCount = wrapText(`(n = ${data.dbStudiesIncluded})`, startX + padding, nextYInc + 5, headerWidth - 2 * padding, lhNormal);
    
    const nextYInc2 = wrapText('Reports of included studies', startX + padding, nextYIncCount + 15, headerWidth - 2 * padding, lhBold, 'bold');
    wrapText(`(n = ${data.otherStudiesIncluded})`, startX + padding, nextYInc2 + 5, headerWidth - 2 * padding, lhNormal);

    const arrowCol = arrowColor;
    drawArrow(mainFlowCenter, row1Y + hRow1, mainFlowCenter, row2Y, arrowCol);
    drawArrow(mainFlowRight, row1Y + hRow1 / 2, exclusionFlowLeft, row1Y + hRow1 / 2, arrowCol);

    drawArrow(mainFlowCenter, row2Y + hRow2, mainFlowCenter, row3Y, arrowCol);
    drawArrow(mainFlowRight, row2Y + hRow2 / 2, exclusionFlowLeft, row2Y + hRow2 / 2, arrowCol);

    drawArrow(mainFlowCenter, row3Y + hRow3, mainFlowCenter, row4Y, arrowCol);
    drawArrow(mainFlowRight, row3Y + hRow3 / 2, exclusionFlowLeft, row3Y + hRow3 / 2, arrowCol);

    drawArrow(mainFlowCenter, row4Y + hRow4, mainFlowCenter, row5Y, arrowCol);
    drawArrow(mainFlowRight, row4Y + hRow4 / 2, exclusionFlowLeft, row4Y + hRow4 / 2, arrowCol);

    if (!isCollapsed) {
      drawArrow(1550, row1Y + hRow1, 1550, row3Y, arrowCol);
      drawArrow(1550, row3Y + hRow3, 1550, row4Y, arrowCol);
      drawArrow(1800, row3Y + hRow3 / 2, 1840, row3Y + hRow3 / 2, arrowCol);
      drawArrow(1800, row4Y + hRow4 / 2, 1840, row4Y + hRow4 / 2, arrowCol);

      const lineY = (row4Y + hRow4 + row5Y) / 2;
      ctx.beginPath();
      ctx.moveTo(1550, row4Y + hRow4);
      ctx.lineTo(1550, lineY);
      ctx.lineTo(1100, lineY);
      ctx.lineTo(1100, row5Y);
      ctx.strokeStyle = arrowCol;
      ctx.lineWidth = 3;
      ctx.stroke();

      drawArrow(1100, row5Y - 10, 1100, row5Y, arrowCol);
    }

    ctx.restore();
  };

  useEffect(() => {
    if (data) {
      drawPrisma();
    }
  }, [data, config]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const safeProjName = data?.projectName ? data.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'project';
    
    link.download = `PRISMA_${safeProjName}_${dateStr}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('PRISMA Flowchart downloaded successfully', 'success');
  };

  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No PRISMA data available in this snapshot.
      </div>
    );
  }

  const otherMethodsTotal = (data.otherReportsSought || 0) + (data.otherDuplicatesRemoved || 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
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

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold py-2 px-4 rounded-lg shadow-sm transition-all cursor-pointer"
            title="Download PNG"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </button>
        </div>
      </div>

      {/* Canvas container */}
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
