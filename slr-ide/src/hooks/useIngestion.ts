import { useState } from 'react';

export function useIngestion(
  loadPapers: () => Promise<void>,
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void,
  broadcastSync: (event: string) => void
) {
  // Manual Ingress States
  const [manualSource, setManualSource] = useState('Backward Snowball');
  const [manualImportDate, setManualImportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualYear, setManualYear] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthors, setManualAuthors] = useState('');
  const [manualDoi, setManualDoi] = useState('');
  const [manualAbstract, setManualAbstract] = useState('');
  const [manualIngesting, setManualIngesting] = useState(false);

  // CSV States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvSource, setCsvSource] = useState('Database Search');
  const [csvImportDate, setCsvImportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [csvFileId, setCsvFileId] = useState('');
  const [csvFileDoi, setCsvFileDoi] = useState('');
  const [csvFileTitle, setCsvFileTitle] = useState('');
  const [csvFileAuthors, setCsvFileAuthors] = useState('');
  const [csvFileYear, setCsvFileYear] = useState('');
  const [csvFileAbstract, setCsvFileAbstract] = useState('');
  const [csvParsing, setCsvParsing] = useState(false);

  return {
    manualSource, setManualSource,
    manualImportDate, setManualImportDate,
    manualYear, setManualYear,
    manualTitle, setManualTitle,
    manualAuthors, setManualAuthors,
    manualDoi, setManualDoi,
    manualAbstract, setManualAbstract,
    manualIngesting, setManualIngesting,
    csvFile, setCsvFile,
    csvSource, setCsvSource,
    csvImportDate, setCsvImportDate,
    csvFileId, setCsvFileId,
    csvFileDoi, setCsvFileDoi,
    csvFileTitle, setCsvFileTitle,
    csvFileAuthors, setCsvFileAuthors,
    csvFileYear, setCsvFileYear,
    csvFileAbstract, setCsvFileAbstract,
    csvParsing, setCsvParsing
  };
}
