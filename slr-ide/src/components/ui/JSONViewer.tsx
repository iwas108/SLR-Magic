'use client';

import React from 'react';
import JsonView from '@uiw/react-json-view';
import { darkTheme } from '@uiw/react-json-view/dark';

interface JSONViewerProps {
  data: any;
}

export default function JSONViewer({ data }: JSONViewerProps) {
  let parsedData = data;
  let parseError: string | null = null;

  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data);
    } catch (e: any) {
      parseError = e.message;
    }
  }

  // If there's a parsing error, render as styled raw string with warning indicator
  if (parseError) {
    return (
      <div className="relative group bg-red-950/15 border border-red-500/20 p-3 rounded-lg overflow-auto font-mono text-xs max-h-96 w-full text-red-400">
        <div className="text-[10px] uppercase font-bold text-red-400/80 mb-1">Invalid JSON Syntax:</div>
        <pre className="whitespace-pre-wrap">{data}</pre>
        <span className="text-[9px] text-red-500 font-semibold block mt-1.5">{parseError}</span>
      </div>
    );
  }

  // Render using @uiw/react-json-view package
  return (
    <div className="p-3 bg-secondary/15 border border-border/40 rounded-xl max-h-[500px] overflow-auto select-text w-full font-mono text-xs">
      <JsonView
        value={parsedData}
        style={darkTheme}
        displayDataTypes={false}
        enableClipboard={true}
        collapsed={2}
      />
    </div>
  );
}
