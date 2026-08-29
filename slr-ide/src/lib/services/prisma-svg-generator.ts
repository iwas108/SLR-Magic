import { PrismaConfig } from '@/components/features/modals/PrismaConfigModal';

export interface PrismaSvgOptions {
  isDark?: boolean;
}

export function generatePrismaSvg(data: any, config: PrismaConfig, options: PrismaSvgOptions = {}): string {
  if (!data) return '';

  const otherMethodsTotal =
    (data.totalOtherRecordsIdentified || 0) +
    (data.otherReportsSought || 0) +
    (data.otherDuplicatesRemoved || 0);
  const isCollapsed = config.collapseEmptyColumn && otherMethodsTotal === 0;

  // Geometry matching Canvas
  const startX = isCollapsed ? 500 : 200;
  const boxWidth = isCollapsed ? 650 : 500;
  const gap = isCollapsed ? 750 : 540;
  const leftPhaseLabelX = isCollapsed ? 300 : 80;

  const mainFlowCenter = startX + boxWidth / 2;
  const mainFlowRight = startX + boxWidth;
  const exclusionFlowLeft = startX + gap;
  const headerWidth = isCollapsed ? 1400 : 1040;
  const headerCenter = startX + headerWidth / 2;

  const baseWidth = 2400;
  const verticalGap = 40;
  const bottomPadding = 40;
  const padding = config.boxPadding || 20;

  const baseFontSize = config.baseFontSize || 22;
  const fontFamily = config.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';
  const borderRadius = config.boxBorderRadius ?? 8;
  const lhBold = Math.round(baseFontSize * 1.4);
  const lhNormal = Math.round(baseFontSize * 1.3);

  // Theme styling
  const isDark = Boolean(options.isDark && config.colorTheme === 'appTheme');
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
    if (isDark) {
      bg = '#0f172a';
      textMain = '#f8fafc';
      textMuted = '#94a3b8';
      border = '#334155';
      cardBg = '#1e293b';
      goldHeader = '#451a03';
      goldHeaderText = '#fef08a';
      headerBorder = '#d97706';
      labelBg = '#1e3a8a';
      labelText = '#93c5fd';
      arrowColor = textMuted;
      borderWidth = 2;
    }
  } else {
    // Journal Monochrome
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

  // Text wrap utility
  function wrapLines(text: string, maxCharsPerLine: number): string[] {
    const rawLines = text.split('\n');
    const result: string[] = [];
    for (const rawLine of rawLines) {
      if (!rawLine) {
        result.push('');
        continue;
      }
      const words = rawLine.split(' ');
      let currentLine = '';
      for (const word of words) {
        if (!currentLine) {
          currentLine = word;
        } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
          currentLine += ' ' + word;
        } else {
          result.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        result.push(currentLine);
      }
    }
    return result;
  }

  // Estimate max characters based on width & font size
  const maxCharsMain = Math.floor((boxWidth - 2 * padding) / (baseFontSize * 0.58));
  const maxCharsOther = Math.floor((500 - 2 * padding) / (baseFontSize * 0.58));
  const maxCharsHeader = Math.floor((headerWidth - 2 * padding) / (baseFontSize * 0.58));

  // --- HEIGHT CALCULATIONS ---
  // Row 1
  const dbSourcesText = (data.databaseSources || [])
    .map((s: any) => `${s.source} (n = ${s.count})`)
    .join('\n');
  const box1BoldLines = wrapLines('Records identified from:', maxCharsMain);
  const box1NormalLines = wrapLines(dbSourcesText || 'No database papers', maxCharsMain);
  const box1Height = box1BoldLines.length * lhBold + 5 + box1NormalLines.length * lhNormal;

  const box2BoldLines = wrapLines('Records removed before screening:', maxCharsMain);
  const box2NormalLines = wrapLines(
    `Duplicate records removed (n = ${data.dbDuplicatesRemoved ?? 0})\n` +
    `Records marked as ineligible by automation tools (n = 0)\n` +
    `Records removed for other reasons (n = 0)`,
    maxCharsMain
  );
  const box2Height = box2BoldLines.length * lhBold + 5 + box2NormalLines.length * lhNormal;

  let box13Height = 0;
  let box13BoldLines: string[] = [];
  let box13NormalLines: string[] = [];
  let box14Height = 0;
  let box14BoldLines: string[] = [];
  let box14NormalLines: string[] = [];

  if (!isCollapsed) {
    const otherSourcesText = (data.otherMethodsSources || [])
      .map((s: any) => `${s.source} (n = ${s.count})`)
      .join('\n');
    box13BoldLines = wrapLines('Records identified from:', maxCharsOther);
    box13NormalLines = wrapLines(otherSourcesText || 'No records identified', maxCharsOther);
    box13Height = box13BoldLines.length * lhBold + 5 + box13NormalLines.length * lhNormal;

    box14BoldLines = wrapLines('Records removed before screening:', maxCharsOther);
    box14NormalLines = wrapLines(
      `Duplicate records removed (n = ${data.otherDuplicatesRemoved || 0})\n` +
      `Records marked as ineligible by automation tools (n = 0)\n` +
      `Records removed for other reasons (n = 0)`,
      maxCharsOther
    );
    box14Height = box14BoldLines.length * lhBold + 5 + box14NormalLines.length * lhNormal;
  }

  const hRow1 =
    Math.max(box1Height, box2Height, isCollapsed ? 0 : Math.max(box13Height, box14Height)) +
    padding * 2;

  // Row 2
  const box5BoldLines = wrapLines(`Records screened (n = ${data.dbRecordsScreened ?? 0})`, maxCharsMain);
  const box5Height = box5BoldLines.length * lhBold;

  const s1ExclusionsText = (data.dbStage1ExcludedByEC || [])
    .map((ec: any) => `${ec.code} (n = ${ec.count})`)
    .join(', ');
  const box6BoldLines = wrapLines(`Records excluded (n = ${data.dbStage1Excluded ?? 0})`, maxCharsMain);
  const box6NormalLines = wrapLines(s1ExclusionsText || 'No exclusions', maxCharsMain);
  const box6Height = box6BoldLines.length * lhBold + box6NormalLines.length * lhNormal;

  const hRow2 = Math.max(box5Height, box6Height) + padding * 2;

  // Row 3
  const box8BoldLines = wrapLines('Reports sought for retrieval', maxCharsMain);
  const box8NormalLines = wrapLines(`(n = ${data.dbReportsSought ?? 0})`, maxCharsMain);
  const box8Height = box8BoldLines.length * lhBold + box8NormalLines.length * lhNormal;

  const box9BoldLines = wrapLines('Reports not retrieved', maxCharsMain);
  const box9NormalLines = wrapLines(`(n = ${data.dbReportsNotRetrieved ?? 0})`, maxCharsMain);
  const box9Height = box9BoldLines.length * lhBold + box9NormalLines.length * lhNormal;

  let box16Height = 0;
  let box16BoldLines: string[] = [];
  let box16NormalLines: string[] = [];
  let box17Height = 0;
  let box17BoldLines: string[] = [];
  let box17NormalLines: string[] = [];

  if (!isCollapsed) {
    box16BoldLines = wrapLines('Reports sought for retrieval', maxCharsOther);
    box16NormalLines = wrapLines(`(n = ${data.otherReportsSought ?? 0})`, maxCharsOther);
    box16Height = box16BoldLines.length * lhBold + box16NormalLines.length * lhNormal;

    box17BoldLines = wrapLines('Reports not retrieved', maxCharsOther);
    box17NormalLines = wrapLines(`(n = ${data.otherReportsNotRetrieved ?? 0})`, maxCharsOther);
    box17Height = box17BoldLines.length * lhBold + box17NormalLines.length * lhNormal;
  }

  const hRow3 =
    Math.max(box8Height, box9Height, isCollapsed ? 0 : Math.max(box16Height, box17Height)) +
    padding * 2;

  // Row 4
  const box10BoldLines = wrapLines('Reports assessed for eligibility', maxCharsMain);
  const box10NormalLines = wrapLines(`(n = ${data.dbReportsAssessed ?? 0})`, maxCharsMain);
  const box10Height = box10BoldLines.length * lhBold + box10NormalLines.length * lhNormal;

  const dbExcludedLines: string[] = [];
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

  const box11BoldLines = wrapLines('Reports excluded:', maxCharsMain);
  const box11NormalLines = wrapLines(dbExcludedLines.join('\n') || 'No exclusions', maxCharsMain);
  const box11Height = box11BoldLines.length * lhBold + 5 + box11NormalLines.length * lhNormal;

  let box18Height = 0;
  let box18BoldLines: string[] = [];
  let box18NormalLines: string[] = [];
  let box19Height = 0;
  let box19BoldLines: string[] = [];
  let box19NormalLines: string[] = [];

  if (!isCollapsed) {
    box18BoldLines = wrapLines('Reports assessed for eligibility', maxCharsOther);
    box18NormalLines = wrapLines(`(n = ${data.otherReportsAssessed ?? 0})`, maxCharsOther);
    box18Height = box18BoldLines.length * lhBold + box18NormalLines.length * lhNormal;

    const otherExcludedLines: string[] = [];
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
    box19BoldLines = wrapLines('Reports excluded:', maxCharsOther);
    box19NormalLines = wrapLines(otherExcludedLines.join('\n') || 'No exclusions', maxCharsOther);
    box19Height = box19BoldLines.length * lhBold + 5 + box19NormalLines.length * lhNormal;
  }

  const hRow4 =
    Math.max(box10Height, box11Height, isCollapsed ? 0 : Math.max(box18Height, box19Height)) +
    padding * 2;

  // Phase 3: Included Box
  const incBold1 = wrapLines('Studies included in review', maxCharsHeader);
  const incCount1 = wrapLines(`(n = ${data.dbStudiesIncluded ?? 0})`, maxCharsHeader);
  const incBold2 = wrapLines('Reports of included studies', maxCharsHeader);
  const incCount2 = wrapLines(`(n = ${data.otherStudiesIncluded ?? 0})`, maxCharsHeader);
  const hInc =
    incBold1.length * lhBold +
    5 +
    incCount1.length * lhNormal +
    15 +
    incBold2.length * lhBold +
    5 +
    incCount2.length * lhNormal +
    padding * 2;

  // Row Coordinates
  const headerY = 40;
  const headerH = 60;
  const row1Y = headerY + headerH + verticalGap;
  const row2Y = row1Y + hRow1 + verticalGap;
  const row3Y = row2Y + hRow2 + verticalGap;
  const row4Y = row3Y + hRow3 + verticalGap;
  const row5Y = row4Y + hRow4 + verticalGap;
  const baseHeight = row5Y + hInc + bottomPadding;

  // --- SVG HELPER GENERATORS ---
  function escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  function renderBox(x: number, y: number, w: number, h: number, f: string = cardBg, s: string = border, strokeW: number = borderWidth): string {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${borderRadius}" ry="${borderRadius}" fill="${f}" stroke="${s}" stroke-width="${strokeW}" />\n`;
  }

  function renderTextLines(
    x: number,
    startY: number,
    lines: string[],
    lineH: number,
    fontWeight: 'bold' | 'normal',
    color: string = textMain,
    fontSize: number = baseFontSize
  ): { svg: string; nextY: number } {
    let svg = '';
    let curY = startY;
    for (const line of lines) {
      if (line) {
        svg += `  <text x="${x}" y="${curY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}">${escapeXml(line)}</text>\n`;
      }
      curY += lineH;
    }
    return { svg, nextY: curY };
  }

  function renderVerticalLabel(text: string, yStart: number, yEnd: number): string {
    const x = leftPhaseLabelX;
    const yCenter = (yStart + yEnd) / 2;
    const labelWidth = 60;
    const labelHeight = yEnd - yStart;
    const fontSize = baseFontSize + 2;

    let res = renderBox(x - labelWidth / 2, yStart, labelWidth, labelHeight, labelBg, border, borderWidth);
    res += `  <g transform="translate(${x}, ${yCenter}) rotate(-90)">\n`;
    res += `    <text x="0" y="0" dy="0.1em" font-family="${fontFamily}" font-size="${fontSize}" font-weight="bold" fill="${labelText}" text-anchor="middle" dominant-baseline="central">${escapeXml(text.toUpperCase())}</text>\n`;
    res += `  </g>\n`;
    return res;
  }

  function renderArrow(fromX: number, fromY: number, toX: number, toY: number, color: string = arrowColor): string {
    return `  <line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="${color}" stroke-width="3" marker-end="url(#arrowhead)" />\n`;
  }

  // --- SVG ASSEMBLY ---
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${baseWidth} ${baseHeight}" width="${baseWidth}" height="${baseHeight}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${arrowColor}" />
    </marker>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="${bg}" />

  <!-- Left Phase Labels -->
${renderVerticalLabel('Identification', headerY, row1Y + hRow1)}
${renderVerticalLabel('Screening', row2Y, row4Y + hRow4)}
${renderVerticalLabel('Included', row5Y, row5Y + hInc)}

  <!-- Phase 1: Header Left -->
${renderBox(startX, headerY, headerWidth, headerH, goldHeader, headerBorder, borderWidth)}
  <text x="${headerCenter}" y="${headerY + headerH / 2}" dy="0.1em" font-family="${fontFamily}" font-size="${baseFontSize}" font-weight="bold" fill="${goldHeaderText}" text-anchor="middle" dominant-baseline="central">Identification of studies via databases and registers</text>
`;

  if (!isCollapsed) {
    svg += `  <!-- Phase 1: Header Right -->
${renderBox(1300, headerY, 1040, headerH, goldHeader, headerBorder, borderWidth)}
  <text x="1820" y="${headerY + headerH / 2}" dy="0.1em" font-family="${fontFamily}" font-size="${baseFontSize}" font-weight="bold" fill="${goldHeaderText}" text-anchor="middle" dominant-baseline="central">Identification of studies via other methods</text>
`;
  }

  // Box 1: Records identified from databases
  svg += `  <!-- Box 1 -->
${renderBox(startX, row1Y, boxWidth, hRow1)}`;
  let curY = row1Y + padding + Math.round(baseFontSize * 0.8);
  let tRes = renderTextLines(startX + padding, curY, box1BoldLines, lhBold, 'bold');
  svg += tRes.svg;
  svg += renderTextLines(startX + padding, tRes.nextY + 5, box1NormalLines, lhNormal, 'normal').svg;

  // Box 2: Records removed before screening
  svg += `  <!-- Box 2 -->
${renderBox(exclusionFlowLeft, row1Y, boxWidth, hRow1)}`;
  curY = row1Y + padding + Math.round(baseFontSize * 0.8);
  tRes = renderTextLines(exclusionFlowLeft + padding, curY, box2BoldLines, lhBold, 'bold');
  svg += tRes.svg;
  svg += renderTextLines(exclusionFlowLeft + padding, tRes.nextY + 5, box2NormalLines, lhNormal, 'normal').svg;

  if (!isCollapsed) {
    // Box 13: Other methods identified
    svg += `  <!-- Box 13 -->
${renderBox(1300, row1Y, 500, hRow1)}`;
    curY = row1Y + padding + Math.round(baseFontSize * 0.8);
    tRes = renderTextLines(1300 + padding, curY, box13BoldLines, lhBold, 'bold');
    svg += tRes.svg;
    svg += renderTextLines(1300 + padding, tRes.nextY + 5, box13NormalLines, lhNormal, 'normal').svg;

    // Box 14: Other methods removed
    svg += `  <!-- Box 14 -->
${renderBox(1840, row1Y, 500, hRow1)}`;
    curY = row1Y + padding + Math.round(baseFontSize * 0.8);
    tRes = renderTextLines(1840 + padding, curY, box14BoldLines, lhBold, 'bold');
    svg += tRes.svg;
    svg += renderTextLines(1840 + padding, tRes.nextY + 5, box14NormalLines, lhNormal, 'normal').svg;
  }

  // --- PHASE 2: Screening ---
  // Box 5: Records screened
  svg += `  <!-- Box 5 -->
${renderBox(startX, row2Y, boxWidth, hRow2)}`;
  curY = row2Y + padding + Math.round(baseFontSize * 0.8);
  svg += renderTextLines(startX + padding, curY, box5BoldLines, lhBold, 'bold').svg;

  // Box 6: Records excluded
  svg += `  <!-- Box 6 -->
${renderBox(exclusionFlowLeft, row2Y, boxWidth, hRow2)}`;
  curY = row2Y + padding + Math.round(baseFontSize * 0.8);
  tRes = renderTextLines(exclusionFlowLeft + padding, curY, box6BoldLines, lhBold, 'bold');
  svg += tRes.svg;
  svg += renderTextLines(exclusionFlowLeft + padding, tRes.nextY, box6NormalLines, lhNormal, 'normal', textMuted).svg;

  // Box 8: Reports sought
  svg += `  <!-- Box 8 -->
${renderBox(startX, row3Y, boxWidth, hRow3)}`;
  curY = row3Y + padding + Math.round(baseFontSize * 0.8);
  tRes = renderTextLines(startX + padding, curY, box8BoldLines, lhBold, 'bold');
  svg += tRes.svg;
  svg += renderTextLines(startX + padding, tRes.nextY, box8NormalLines, lhNormal, 'normal').svg;

  // Box 9: Reports not retrieved
  svg += `  <!-- Box 9 -->
${renderBox(exclusionFlowLeft, row3Y, boxWidth, hRow3)}`;
  curY = row3Y + padding + Math.round(baseFontSize * 0.8);
  tRes = renderTextLines(exclusionFlowLeft + padding, curY, box9BoldLines, lhBold, 'bold');
  svg += tRes.svg;
  svg += renderTextLines(exclusionFlowLeft + padding, tRes.nextY, box9NormalLines, lhNormal, 'normal').svg;

  // Box 10: Reports assessed
  svg += `  <!-- Box 10 -->
${renderBox(startX, row4Y, boxWidth, hRow4)}`;
  curY = row4Y + padding + Math.round(baseFontSize * 0.8);
  tRes = renderTextLines(startX + padding, curY, box10BoldLines, lhBold, 'bold');
  svg += tRes.svg;
  svg += renderTextLines(startX + padding, tRes.nextY, box10NormalLines, lhNormal, 'normal').svg;

  // Box 11: Reports excluded
  svg += `  <!-- Box 11 -->
${renderBox(exclusionFlowLeft, row4Y, boxWidth, hRow4)}`;
  curY = row4Y + padding + Math.round(baseFontSize * 0.8);
  tRes = renderTextLines(exclusionFlowLeft + padding, curY, box11BoldLines, lhBold, 'bold');
  svg += tRes.svg;
  svg += renderTextLines(exclusionFlowLeft + padding, tRes.nextY + 5, box11NormalLines, lhNormal, 'normal').svg;

  if (!isCollapsed) {
    // Box 16: Other reports sought
    svg += `  <!-- Box 16 -->
${renderBox(1300, row3Y, 500, hRow3)}`;
    curY = row3Y + padding + Math.round(baseFontSize * 0.8);
    tRes = renderTextLines(1300 + padding, curY, box16BoldLines, lhBold, 'bold');
    svg += tRes.svg;
    svg += renderTextLines(1300 + padding, tRes.nextY, box16NormalLines, lhNormal, 'normal').svg;

    // Box 17: Other reports not retrieved
    svg += `  <!-- Box 17 -->
${renderBox(1840, row3Y, 500, hRow3)}`;
    curY = row3Y + padding + Math.round(baseFontSize * 0.8);
    tRes = renderTextLines(1840 + padding, curY, box17BoldLines, lhBold, 'bold');
    svg += tRes.svg;
    svg += renderTextLines(1840 + padding, tRes.nextY, box17NormalLines, lhNormal, 'normal').svg;

    // Box 18: Other reports assessed
    svg += `  <!-- Box 18 -->
${renderBox(1300, row4Y, 500, hRow4)}`;
    curY = row4Y + padding + Math.round(baseFontSize * 0.8);
    tRes = renderTextLines(1300 + padding, curY, box18BoldLines, lhBold, 'bold');
    svg += tRes.svg;
    svg += renderTextLines(1300 + padding, tRes.nextY, box18NormalLines, lhNormal, 'normal').svg;

    // Box 19: Other reports excluded
    svg += `  <!-- Box 19 -->
${renderBox(1840, row4Y, 500, hRow4)}`;
    curY = row4Y + padding + Math.round(baseFontSize * 0.8);
    tRes = renderTextLines(1840 + padding, curY, box19BoldLines, lhBold, 'bold');
    svg += tRes.svg;
    svg += renderTextLines(1840 + padding, tRes.nextY + 5, box19NormalLines, lhNormal, 'normal').svg;
  }

  // --- PHASE 3: Included ---
  svg += `  <!-- Box 12 & 20: Included -->
${renderBox(startX, row5Y, headerWidth, hInc)}`;
  curY = row5Y + padding + Math.round(baseFontSize * 0.8);
  tRes = renderTextLines(startX + padding, curY, incBold1, lhBold, 'bold');
  svg += tRes.svg;
  tRes = renderTextLines(startX + padding, tRes.nextY + 5, incCount1, lhNormal, 'normal');
  svg += tRes.svg;
  tRes = renderTextLines(startX + padding, tRes.nextY + 15, incBold2, lhBold, 'bold');
  svg += tRes.svg;
  svg += renderTextLines(startX + padding, tRes.nextY + 5, incCount2, lhNormal, 'normal').svg;

  // --- CONNECTOR ARROWS ---
  svg += `  <!-- Connector Arrows -->\n`;
  svg += renderArrow(mainFlowCenter, row1Y + hRow1, mainFlowCenter, row2Y); // Box 1 to 5
  svg += renderArrow(mainFlowRight, row1Y + hRow1 / 2, exclusionFlowLeft, row1Y + hRow1 / 2); // Box 1 to 2

  svg += renderArrow(mainFlowCenter, row2Y + hRow2, mainFlowCenter, row3Y); // Box 5 to 8
  svg += renderArrow(mainFlowRight, row2Y + hRow2 / 2, exclusionFlowLeft, row2Y + hRow2 / 2); // Box 5 to 6

  svg += renderArrow(mainFlowCenter, row3Y + hRow3, mainFlowCenter, row4Y); // Box 8 to 10
  svg += renderArrow(mainFlowRight, row3Y + hRow3 / 2, exclusionFlowLeft, row3Y + hRow3 / 2); // Box 8 to 9

  svg += renderArrow(mainFlowCenter, row4Y + hRow4, mainFlowCenter, row5Y); // Box 10 to 12
  svg += renderArrow(mainFlowRight, row4Y + hRow4 / 2, exclusionFlowLeft, row4Y + hRow4 / 2); // Box 10 to 11

  if (!isCollapsed) {
    svg += renderArrow(1800, row1Y + hRow1 / 2, 1840, row1Y + hRow1 / 2); // Box 13 to 14
    svg += renderArrow(1550, row1Y + hRow1, 1550, row3Y); // Box 13 to 16
    svg += renderArrow(1550, row3Y + hRow3, 1550, row4Y); // Box 16 to 18
    svg += renderArrow(1800, row3Y + hRow3 / 2, 1840, row3Y + hRow3 / 2); // Box 16 to 17
    svg += renderArrow(1800, row4Y + hRow4 / 2, 1840, row4Y + hRow4 / 2); // Box 18 to 19

    const lineY = (row4Y + hRow4 + row5Y) / 2;
    svg += `  <polyline points="1550,${row4Y + hRow4} 1550,${lineY} 1100,${lineY} 1100,${row5Y}" fill="none" stroke="${arrowColor}" stroke-width="3" marker-end="url(#arrowhead)" />\n`;
  }

  svg += `</svg>`;
  return svg;
}
