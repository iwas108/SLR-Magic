'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';

interface TokenOccurrenceTableProps {
  tokens: { token: string; count: number; papers: { id: string; title: string }[] }[];
}

export default function TokenOccurrenceTable({ tokens }: TokenOccurrenceTableProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-secondary/40 border-b border-border">
            <th className="p-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Raw Token</th>
            <th className="p-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-right w-24">Occurrences</th>
          </tr>
        </thead>
        <tbody>
          {tokens.length === 0 ? (
            <tr>
              <td colSpan={2} className="p-4 text-center text-muted-foreground">No unique tokens extracted for this key.</td>
            </tr>
          ) : (
            tokens.map(({ token, count, papers }) => (
              <tr key={token} className="border-b border-border/40 hover:bg-secondary/10 group">
                <td className="p-2 font-semibold font-mono text-foreground flex items-center gap-1.5">
                  {token}
                  <div className="relative group/tooltip inline-block cursor-help">
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground" />
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden group-hover/tooltip:block bg-card border border-border p-2 rounded-lg shadow-xl z-50 w-64 max-h-40 overflow-y-auto pointer-events-none">
                      <span className="font-bold text-[9px] uppercase tracking-wide text-muted-foreground block mb-1">Extracted in Papers:</span>
                      <ul className="space-y-1 text-[10px] list-disc pl-3">
                        {papers.map((p) => (
                          <li key={p.id} className="text-foreground leading-snug">
                            <span className="font-bold font-mono">{p.id}</span>: {p.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </td>
                <td className="p-2 font-bold text-right text-primary w-24 font-mono">{count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
