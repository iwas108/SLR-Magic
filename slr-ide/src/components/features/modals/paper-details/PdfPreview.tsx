import React from 'react';
import { Eye, ExternalLink } from 'lucide-react';

interface PdfPreviewProps {
  localPdfPath: string;
}

export default function PdfPreview({ localPdfPath }: PdfPreviewProps) {
  if (!localPdfPath) return null;

  return (
    <div className="flex-1 bg-secondary/15 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0 select-none">
        <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-primary" />
          PDF Preview
        </span>
        <a
          href={`/api/pdf/serve?path=${encodeURIComponent(localPdfPath)}`}
          target="_blank"
          rel="noreferrer"
          className="text-[9px] font-bold uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
        >
          Open in New Tab <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="flex-1 relative bg-secondary/10">
        <iframe
          src={`/api/pdf/serve?path=${encodeURIComponent(localPdfPath)}#toolbar=1`}
          className="absolute inset-0 w-full h-full border-none"
          title="PDF Viewer"
        />
      </div>
    </div>
  );
}
