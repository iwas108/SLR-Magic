import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle, Loader2 } from 'lucide-react';

interface BatchImportSlotProps {
  slotNumber: number;
  reviewerName: string | null;
  papersReviewed: number | null;
  onUpload: (file: File) => Promise<boolean>;
  isUploading: boolean;
}

export default function BatchImportSlot({
  slotNumber,
  reviewerName,
  papersReviewed,
  onUpload,
  isUploading
}: BatchImportSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await onUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await onUpload(e.target.files[0]);
    }
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={triggerInput}
      className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 transition-all duration-300 cursor-pointer ${
        reviewerName 
          ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50' 
          : isDragActive
          ? 'bg-primary/5 border-primary hover:border-primary'
          : 'bg-card border-border hover:border-primary/50'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".slr"
        onChange={handleChange}
        className="hidden"
      />

      {isUploading ? (
        <div className="flex flex-col items-center space-y-2 py-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground">Uploading and parsing review data...</p>
        </div>
      ) : reviewerName ? (
        <div className="flex flex-col items-center space-y-2 py-2 text-center animate-in fade-in duration-200">
          <div className="bg-emerald-500/10 p-2.5 rounded-full border border-emerald-500/20">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Reviewer Slot {slotNumber} Filled</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5 max-w-[150px] truncate">{reviewerName}</p>
            {papersReviewed !== null && (
              <span className="inline-block bg-emerald-500/10 text-emerald-500 font-bold text-[9px] px-1.5 py-0.5 rounded mt-1.5 border border-emerald-500/10">
                {papersReviewed} Papers
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-2 py-2 text-center">
          <div className="bg-muted p-2.5 rounded-full border border-border">
            <UploadCloud className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Upload Reviewer {slotNumber} (.slr)</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Drag & drop or click to browse</p>
          </div>
        </div>
      )}
    </div>
  );
}
