import React from 'react';

export interface ClickableCellProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  valueToCopy?: string;
  traceInfo?: {
    mapping?: string;
    evidence?: string;
    justification?: string;
  };
  originalValue?: string;
  pdfLink?: string;
  onClick?: () => void;
}

export default function ClickableCell({ 
  children, 
  className = "",
  title,
  valueToCopy,
  traceInfo,
  originalValue,
  onClick
}: ClickableCellProps) {
  const effectiveTitle = title || [
    valueToCopy ? `Umbrellanized Value: ${valueToCopy}` : '',
    originalValue && originalValue !== valueToCopy ? `Raw Token: ${originalValue}` : '',
    traceInfo?.justification ? `Taxonomy Justification: ${traceInfo.justification}` : '',
    traceInfo?.mapping ? `Extraction Mapping: ${traceInfo.mapping}` : '',
    traceInfo?.evidence ? `Evidence Quote: "${traceInfo.evidence}"` : ''
  ].filter(Boolean).join('\n\n');

  return (
    <div 
      onClick={onClick}
      title={effectiveTitle || undefined}
      className="w-full h-full min-h-[22px] flex items-center select-text"
    >
      <div 
        className={`transition-all duration-150 truncate max-h-[18px] overflow-hidden whitespace-nowrap text-ellipsis block w-full ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
