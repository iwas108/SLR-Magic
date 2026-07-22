import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ParentPaperSelectorProps {
  paperId: string;
  projectId: string;
  editParentPaperId: string;
  setEditParentPaperId: (id: string) => void;
  selectedEditParentPaper: any;
  setSelectedEditParentPaper: (paper: any) => void;
}

export default function ParentPaperSelector({
  paperId,
  projectId,
  editParentPaperId,
  setEditParentPaperId,
  selectedEditParentPaper,
  setSelectedEditParentPaper
}: ParentPaperSelectorProps) {
  const [editParentSearch, setEditParentSearch] = useState('');
  const [showEditParentSuggestions, setShowEditParentSuggestions] = useState(false);
  const [editParentSuggestions, setEditParentSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (editParentSearch.length < 2) {
        setEditParentSuggestions([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/papers?projectId=${projectId}&search=${encodeURIComponent(editParentSearch)}&limit=5${
            paperId ? `&excludeId=${paperId}` : ''
          }`
        );
        if (res.ok) {
          const data = await res.json();
          setEditParentSuggestions(data.papers || []);
        }
      } catch (err) {
        console.error('Error fetching parent suggestions:', err);
      }
    };

    const delay = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(delay);
  }, [editParentSearch, paperId, projectId]);

  if (selectedEditParentPaper) {
    return (
      <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 text-xs text-primary font-semibold">
        <span className="truncate flex-1" title={selectedEditParentPaper.Title || ''}>
          {selectedEditParentPaper.Title || 'Untitled Paper'} ({selectedEditParentPaper.Paper_ID})
        </span>
        <button
          type="button"
          onClick={() => {
            setSelectedEditParentPaper(null);
            setEditParentPaperId('');
            setEditParentSearch('');
          }}
          className="ml-2 text-primary hover:text-primary-foreground focus:outline-none"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="relative flex items-center">
        <input
          type="text"
          value={editParentSearch}
          onChange={(e) => {
            setEditParentSearch(e.target.value);
            setShowEditParentSuggestions(true);
          }}
          onFocus={() => setShowEditParentSuggestions(true)}
          onBlur={() => setTimeout(() => setShowEditParentSuggestions(false), 200)}
          placeholder="Search parent paper by title or ID..."
          className="w-full px-3 py-1.5 pr-8 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
        />
        {editParentSearch && (
          <button
            type="button"
            onClick={() => {
              setEditParentSearch('');
              setEditParentSuggestions([]);
            }}
            className="absolute right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {showEditParentSuggestions && editParentSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-border">
          {editParentSuggestions.map((p) => (
            <div
              key={p.Paper_ID}
              onClick={() => {
                setSelectedEditParentPaper(p);
                setEditParentPaperId(p.Paper_ID);
                setEditParentSearch('');
                setShowEditParentSuggestions(false);
              }}
              className="px-3 py-2 text-xs hover:bg-secondary cursor-pointer transition-colors text-foreground font-semibold flex flex-col gap-0.5"
            >
              <span className="font-bold truncate">{p.Title}</span>
              <span className="text-[10px] text-muted-foreground truncate">
                {p.Authors || 'Unknown authors'} ({p.Year || 'N/A'})
              </span>
            </div>
          ))}
        </div>
      )}
      {showEditParentSuggestions && editParentSearch.trim() && editParentSuggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl px-3 py-2 text-xs text-muted-foreground">
          No matching papers found
        </div>
      )}
    </>
  );
}
