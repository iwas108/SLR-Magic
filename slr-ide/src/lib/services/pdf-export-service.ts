import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';

export interface PdfExportOptions {
  filename: string;
  marginMm?: number;
}

/**
 * Converts an SVG string into a high-fidelity vector PDF matching the figure's aspect ratio.
 */
export async function exportSvgToPdf(svgString: string, options: PdfExportOptions): Promise<void> {
  const { filename, marginMm = 0 } = options;

  // Parse SVG XML to DOM SVGElement
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = doc.documentElement as unknown as SVGElement;

  if (!svgElement || svgElement.nodeName === 'parsererror') {
    throw new Error('Failed to parse SVG for PDF conversion');
  }

  // Extract dimensions from SVG viewBox or width/height
  let widthPx = 2400;
  let heightPx = 1700;

  const viewBox = svgElement.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      widthPx = parts[2];
      heightPx = parts[3];
    }
  } else {
    const w = parseFloat(svgElement.getAttribute('width') || '2400');
    const h = parseFloat(svgElement.getAttribute('height') || '1700');
    if (!isNaN(w) && w > 0) widthPx = w;
    if (!isNaN(h) && h > 0) heightPx = h;
  }

  // Target physical dimensions in millimeters (based on 300 DPI or direct ratio)
  // Standard width ~ 190 mm (double column width in academic papers)
  const targetWidthMm = 190;
  const targetHeightMm = (heightPx / widthPx) * targetWidthMm;

  const pageWidthMm = targetWidthMm + marginMm * 2;
  const pageHeightMm = targetHeightMm + marginMm * 2;
  const orientation = pageWidthMm >= pageHeightMm ? 'landscape' : 'portrait';

  // Initialize jsPDF with exact custom page size
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm],
    compress: true
  });

  // Temporarily attach to document body if required by svg2pdf.js for computed layout
  let container: HTMLDivElement | null = null;
  let attachedElement = svgElement;

  if (typeof document !== 'undefined') {
    container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-99999px';
    container.style.left = '-99999px';
    container.style.visibility = 'hidden';
    container.style.width = `${widthPx}px`;
    container.style.height = `${heightPx}px`;

    // Clone into active document
    const importedNode = document.importNode(svgElement, true);
    container.appendChild(importedNode);
    document.body.appendChild(container);
    attachedElement = importedNode;
  }

  try {
    await svg2pdf(attachedElement, pdf, {
      x: marginMm,
      y: marginMm,
      width: targetWidthMm,
      height: targetHeightMm
    });

    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
  } finally {
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
